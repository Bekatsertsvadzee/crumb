export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading token">
      <div className="skeleton" style={{ height: 14, width: 120, margin: '16px 0' }} />
      <div className="skeleton" style={{ height: 40, width: 320, marginBottom: 20 }} />
      <div className="tiles">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="tile"><div className="skeleton" style={{ height: 11, width: 60, marginBottom: 10 }} /><div className="skeleton" style={{ height: 20, width: 90 }} /></div>
        ))}
      </div>
      <div className="grid-main">
        <div className="col">
          <div className="card"><div className="skeleton" style={{ height: 320 }} /></div>
          <div className="card"><div className="skeleton-rows"><i /><i /><i /></div></div>
        </div>
        <aside className="col">
          <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>
        </aside>
      </div>
    </div>
  );
}
