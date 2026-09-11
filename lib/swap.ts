import { Program } from '@coral-xyz/anchor';
import { CpAmmIdl, swapQuoteExactInput, type CpAmmTypes, type PoolState } from '@meteora-ag/cp-amm-sdk';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction, type Connection } from '@solana/web3.js';
import BN from 'bn.js';
import { COOKIEBOX_DAMM, METEORA_DAMM } from '@/lib/chain';

/**
 * Cookiebox DAMM (`DAMMjDCE…`) is a byte-identical redeploy of Meteora CP-AMM: same account
 * discriminator, same layout, and a simulated swap against the live program succeeds.
 * We reuse Meteora's IDL and quote math, pointed at whichever program owns the pool.
 */
const PROGRAM_BY_TYPE: Record<string, string> = { 'COOKIEBOX DAMM': COOKIEBOX_DAMM, 'METEORA DAMM': METEORA_DAMM };

export type LoadedPool = {
  programId: PublicKey;
  address: PublicKey;
  state: PoolState;
  program: Program<CpAmmTypes>;
  tokenAProgram: PublicKey;
  tokenBProgram: PublicKey;
};

export async function loadPool(connection: Connection, poolId: string, poolType: string): Promise<LoadedPool> {
  const id = PROGRAM_BY_TYPE[poolType];
  if (!id) throw new Error(`Crumb cannot route through ${poolType} pools yet.`);
  const programId = new PublicKey(id);
  const program = new Program<CpAmmTypes>({ ...CpAmmIdl, address: id } as CpAmmTypes, { connection });
  const address = new PublicKey(poolId);
  const state = await program.account.pool.fetch(address);
  return {
    programId,
    address,
    state,
    program,
    tokenAProgram: state.tokenAFlag === 1 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
    tokenBProgram: state.tokenBFlag === 1 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
  };
}

export type Quote = { out: BN; minOut: BN; fee: BN; priceImpact: number; consumedIn: BN };

export async function quoteSwap(
  connection: Connection,
  pool: LoadedPool,
  inputMint: PublicKey,
  amountIn: BN,
  slippageBps: number,
  decimalsA: number,
  decimalsB: number,
): Promise<Quote> {
  const aToB = pool.state.tokenAMint.equals(inputMint);
  const point = pool.state.activationType ? new BN(Math.floor(Date.now() / 1000)) : new BN(await connection.getSlot());
  const r = swapQuoteExactInput(pool.state, point, amountIn, slippageBps / 100, aToB, false, decimalsA, decimalsB);
  return {
    out: r.outputAmount,
    minOut: r.minimumAmountOut ?? r.outputAmount,
    fee: r.claimingFee.add(r.compoundingFee).add(r.protocolFee).add(r.referralFee),
    priceImpact: Number(r.priceImpact.toString()),
    consumedIn: r.includedFeeInputAmount,
  };
}

export async function buildSwapTx(
  connection: Connection,
  pool: LoadedPool,
  payer: PublicKey,
  inputMint: PublicKey,
  outputMint: PublicKey,
  amountIn: BN,
  minOut: BN,
): Promise<{ tx: VersionedTransaction; lastValidBlockHeight: number }> {
  const { state } = pool;
  const aToB = state.tokenAMint.equals(inputMint);
  const [inProg, outProg] = aToB ? [pool.tokenAProgram, pool.tokenBProgram] : [pool.tokenBProgram, pool.tokenAProgram];
  const inAta = getAssociatedTokenAddressSync(inputMint, payer, false, inProg);
  const outAta = getAssociatedTokenAddressSync(outputMint, payer, false, outProg);

  const ixs: TransactionInstruction[] = [
    createAssociatedTokenAccountIdempotentInstruction(payer, inAta, payer, inputMint, inProg),
    createAssociatedTokenAccountIdempotentInstruction(payer, outAta, payer, outputMint, outProg),
  ];
  // paying with native COOK: wrap exactly the input amount into the wCOOK ATA
  if (inputMint.equals(NATIVE_MINT)) {
    ixs.push(
      SystemProgram.transfer({ fromPubkey: payer, toPubkey: inAta, lamports: BigInt(amountIn.toString()) }),
      createSyncNativeInstruction(inAta),
    );
  }

  const poolAuthority = PublicKey.findProgramAddressSync([Buffer.from('pool_authority')], pool.programId)[0];
  ixs.push(
    await pool.program.methods
      .swap({ amountIn, minimumAmountOut: minOut })
      .accountsPartial({
        poolAuthority,
        pool: pool.address,
        payer,
        inputTokenAccount: inAta,
        outputTokenAccount: outAta,
        tokenAVault: state.tokenAVault,
        tokenBVault: state.tokenBVault,
        tokenAMint: state.tokenAMint,
        tokenBMint: state.tokenBMint,
        tokenAProgram: pool.tokenAProgram,
        tokenBProgram: pool.tokenBProgram,
        referralTokenAccount: null,
      })
      .instruction(),
  );
  // unwrap: close the wCOOK ATA so the user holds native COOK again
  if (inputMint.equals(NATIVE_MINT)) ixs.push(createCloseAccountInstruction(inAta, payer, payer));
  if (outputMint.equals(NATIVE_MINT)) ixs.push(createCloseAccountInstruction(outAta, payer, payer));

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const msg = new TransactionMessage({ payerKey: payer, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message();
  return { tx: new VersionedTransaction(msg), lastValidBlockHeight };
}
