export default function Loading() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Interview Trainer</h1>
        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
          <span className="spinner" style={{ marginRight: 6 }} />
          Загрузка…
        </span>
        <div className="spacer" />
      </header>
      <div className="app-body">
        <aside className="sidebar" style={{ width: 280, flexShrink: 0 }}>
          <div style={{ padding: 16 }}>
            <div className="skeleton skeleton-line" style={{ width: "60%" }} />
            <div className="skeleton skeleton-line" style={{ width: "80%" }} />
            <div className="skeleton skeleton-line" style={{ width: "50%" }} />
            <div className="skeleton skeleton-line" style={{ width: "70%" }} />
          </div>
        </aside>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
        </div>
      </div>
    </div>
  );
}
