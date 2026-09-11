const SUB = '₀₁₂₃₄₅₆₇₈₉';

function subscript(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUB[Number(d)])
    .join('');
}

/**
 * Cookie Chain trades at 1e-8. toFixed() renders "$0.0000" for everything, so
 * prices below 0.001 collapse leading zeros into subscript notation: $0.0₇9539
 */
export function fmtPrice(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || v <= 0) return '—';
  if (v >= 1000) return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (v >= 1) return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (v >= 0.001) return '$' + v.toFixed(5).replace(/0+$/, '').replace(/\.$/, '.0');

  // count zeros after the decimal point
  const s = v.toFixed(20).slice(2);
  const zeros = s.search(/[1-9]/);
  const sig = s.slice(zeros, zeros + 4).replace(/0+$/, '');
  if (zeros < 4) return '$0.' + s.slice(0, zeros + 4).replace(/0+$/, '');
  return `$0.0${subscript(zeros)}${sig}`;
}

export function fmtUsd(v: number | null | undefined, digits = 0): string {
  if (v == null || !Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1_000_000) return '$' + (v / 1_000_000).toFixed(2) + 'M';
  if (Math.abs(v) >= 10_000) return '$' + (v / 1000).toFixed(1) + 'K';
  if (Math.abs(v) < 1 && v !== 0) return fmtPrice(v);
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 2) });
}

export function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

export function fmtInt(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return Math.round(v).toLocaleString('en-US');
}

export function fmtSupply(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v >= 1e12) return (v / 1e12).toFixed(2) + 'T';
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function shortAddr(a: string, n = 4): string {
  return a.length <= n * 2 + 1 ? a : `${a.slice(0, n)}…${a.slice(-n)}`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false,
  }) + ' UTC';
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function fmtAmount(v: number | null | undefined, maxDigits = 4): string {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e4) return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return v.toLocaleString('en-US', { maximumFractionDigits: maxDigits });
}

export function fmtShare(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v > 0 && v < 0.01) return '<0.01%';
  return v.toFixed(2) + '%';
}
