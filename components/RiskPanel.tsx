import type { Risk } from '@/lib/analytics';

function Icon({ level }: { level: Risk['level'] }) {
  if (level === 'ok')
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (level === 'info')
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l10 18H2L12 3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const LABEL: Record<Risk['level'], string> = { high: 'High', warn: 'Warning', ok: 'OK', info: 'Note' };

export default function RiskPanel({ risks }: { risks: Risk[] }) {
  const high = risks.filter((r) => r.level === 'high').length;
  const warn = risks.filter((r) => r.level === 'warn').length;
  return (
    <section className="card">
      <div className="card-hd">
        <div>
          <h2>Risk</h2>
          <p className="mute">
            {high ? `${high} high` : 'No high-severity flags'}
            {warn ? `, ${warn} warning${warn > 1 ? 's' : ''}` : ''}
          </p>
        </div>
      </div>
      <ul className="risk-list">
        {risks.map((r) => (
          <li key={r.title} className={`risk risk-${r.level}`}>
            <Icon level={r.level} />
            <div>
              <div className="risk-t">
                {r.title} <span className="risk-lv">{LABEL[r.level]}</span>
              </div>
              <div className="risk-d">{r.detail}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
