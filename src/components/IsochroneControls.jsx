const MODES = [
  { key: "car",  label: "Car",  speed: 833 },  // 50 km/h → m/min
  { key: "bus",  label: "Bus",  speed: 333 },  // 20 km/h
  { key: "foot", label: "Foot", speed: 83  },  //  5 km/h
];

const TIMES = [10, 20, 30];

export { MODES };

export default function IsochroneControls({ mode, minutes, onMode, onMinutes, enabled, onEnabled }) {
  const btn = (active, onClick, children) => (
    <button
      onClick={onClick}
      style={{
        padding: "4px 10px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.15)",
        background: active ? "rgba(255,255,255,0.15)" : "transparent",
        color: active ? "#fff" : "#bbb",
        fontSize: 11,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        transition: "all 0.12s",
      }}
    >
      {children}
    </button>
  );

  return (
    <div style={{
      position: "absolute",
      bottom: 40,
      right: 20,
      background: "rgba(10,10,20,0.88)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12,
      padding: "14px 16px",
      backdropFilter: "blur(12px)",
      minWidth: 190,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: "#aaa" }}>TRAVEL BUFFER</div>
        <div
          onClick={() => onEnabled(!enabled)}
          style={{
            width: 32, height: 18, borderRadius: 9,
            background: enabled ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.15)",
            position: "relative", cursor: "pointer", transition: "background 0.2s",
          }}
        >
          <div style={{
            position: "absolute", top: 2,
            left: enabled ? 14 : 2,
            width: 12, height: 12, borderRadius: "50%",
            background: enabled ? "#fff" : "#555",
            transition: "left 0.2s, background 0.2s",
          }} />
        </div>
      </div>

      <div style={{ opacity: enabled ? 1 : 0.3, pointerEvents: enabled ? "auto" : "none", transition: "opacity 0.2s" }}>
        <div style={{ fontSize: 10, color: "#aaa", marginBottom: 6 }}>MODE</div>
        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
          {MODES.map(({ key, label }) => btn(mode === key, () => onMode(key), label))}
        </div>

        <div style={{ fontSize: 10, color: "#aaa", marginBottom: 6 }}>MINUTES</div>
        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
          {TIMES.map((t) => btn(minutes === t, () => onMinutes(t), `${t}m`))}
        </div>

        <div style={{ fontSize: 10, color: "#888", lineHeight: 1.5 }}>
          Hover a tract to show buffer<br />
          Note: buffers are straight-line distance only<br />and do not reflect route analysis<br />or actual travel time.
        </div>
      </div>
    </div>
  );
}
