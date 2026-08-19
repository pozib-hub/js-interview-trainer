export default function Loading() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Interview Trainer</h1>
        <div className="spacer" />
      </header>
      <div className="main" style={{ alignItems: "center", justifyContent: "center" }}>
        <span className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
      </div>
    </div>
  );
}
