export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ height: 40, marginTop: 16 }} />
      <div className="tiles">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="tile"><div className="skeleton" style={{ height: 11, width: 60, marginBottom: 10 }} /><div className="skeleton" style={{ height: 20, width: 90 }} /></div>
        ))}
      </div>
      <div className="card"><div className="skeleton-rows"><i /><i /><i /><i /><i /><i /></div></div>
    </div>
  );
}
