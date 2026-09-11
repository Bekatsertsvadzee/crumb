import type { Metadata } from 'next';
import Portfolio from '@/components/Portfolio';

export const metadata: Metadata = { title: 'Portfolio — Crumb', description: 'Your Cookie Chain holdings, priced by Crumb.' };

export default function PortfolioPage() {
  return <Portfolio />;
}
