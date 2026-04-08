export default function Legend({ layers }) {
  return (
    <div style={{
      position: "absolute",
      bottom: 40,
      left: 20,
      background: "rgba(10,10,20,0.85)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12,
      padding: "16px 20px",
      backdropFilter: "blur(12px)",
      minWidth: 200,
    }}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: "#888", marginBottom: 12 }}>
        LAYERS
      </div>
      {layers.map(({ label, color, enabled, onToggle }) => (
        <div
          key={label}
          onClick={onToggle}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 10,
            cursor: "pointer",
            opacity: enabled ? 1 : 0.4,
            transition: "opacity 0.2s",
          }}
        >
          <div style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            background: color,
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 13, color: "#ddd" }}>{label}</span>
        </div>
      ))}
    </div>
  );
}
