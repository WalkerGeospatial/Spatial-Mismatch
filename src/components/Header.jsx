export default function Header() {
  return (
    <div style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      padding: "16px 20px",
      background: "linear-gradient(to bottom, rgba(10,10,20,0.95) 0%, transparent 100%)",
      zIndex: 10,
      pointerEvents: "none",
    }}>
      <div style={{ fontSize: 11, letterSpacing: 3, color: "#ff00b4", marginBottom: 6 }}>
        MILWAUKEE METRO · SPATIAL MISMATCH
      </div>
      <h1 style={{
        fontSize: "clamp(16px, 4vw, 28px)",
        fontWeight: 700,
        letterSpacing: -0.5,
        lineHeight: 1.1,
        color: "#fff",
        maxWidth: 480,
      }}>
        Jobs Are in the Suburbs.<br />
        Workers Are in the City.<br />
        <span style={{ fontSize: 16, fontWeight: 400, letterSpacing: 0 }}>A Case Study of Milwaukee, Wisconsin</span>
      </h1>
      <p style={{
        marginTop: 8,
        fontSize: "clamp(11px, 2.5vw, 13px)",
        color: "#aaa",
        maxWidth: 440,
        lineHeight: 1.6,
        display: window.innerWidth < 640 ? "none" : "block",
      }}>
        Working-age residents below 200% of the poverty line versus available
        low-wage jobs, by census tract. Pink = more workers than jobs.
        Green = job surplus.
      </p>
    </div>
  );
}
