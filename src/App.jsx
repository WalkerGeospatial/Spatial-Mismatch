import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Map from "react-map-gl/maplibre";
import { DeckGL } from "@deck.gl/react";
import { GeoJsonLayer } from "@deck.gl/layers";
import "maplibre-gl/dist/maplibre-gl.css";

import { useDuckDB } from "./hooks/useDuckDB";
import { useMapData } from "./hooks/useMapData";
import Header from "./components/Header";
import IsochroneControls, { MODES } from "./components/IsochroneControls";

const INITIAL_VIEW = {
  longitude: -88.0,
  latitude: 43.05,
  zoom: 10,
  pitch: 45,
  bearing: 0,
};

const MAPSTYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const MAX_ELEVATION = 5000;
const HOVER_DEBOUNCE_MS = 200;

function excessToColor(excess, maxAbs) {
  const t = Math.max(0, Math.min(1, (excess / maxAbs + 1) / 2));
  // alpha: min 180 at midpoint, 255 at extremes
  const alpha = Math.round(180 + 75 * Math.abs(t - 0.5) / 0.5);
  if (t < 0.5) {
    const s = t / 0.5;
    return [
      Math.round(0   + 10  * s),
      Math.round(255 - 245 * s),
      Math.round(80  - 60  * s),
      alpha,
    ];
  } else {
    const s = (t - 0.5) / 0.5;
    return [
      Math.round(10  + 245 * s),
      Math.round(10  - 10  * s),
      Math.round(20  + 160 * s),
      alpha,
    ];
  }
}

function tractCentroid(feature) {
  const coords = feature.geometry?.coordinates?.[0];
  if (!coords?.length) return null;
  return {
    lon: coords.reduce((s, c) => s + c[0], 0) / coords.length,
    lat: coords.reduce((s, c) => s + c[1], 0) / coords.length,
  };
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function App() {
  const { ready, error, query } = useDuckDB();
  const { tracts, loading } = useMapData(query, ready);

  const [isoMode, setIsoMode]       = useState("car");
  const [isoMinutes, setIsoMinutes] = useState(10);
  const [isoEnabled, setIsoEnabled] = useState(false);
  const [hovered, setHovered]       = useState(null); // { geoid, centroid }
  const [isMobile, setIsMobile]     = useState(window.innerWidth < 640);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  const debounceRef = useRef(null);

  const countySummary = useMemo(() => {
    if (!tracts) return null;
    let mkeWorkers = 0, mkeJobs = 0, subWorkers = 0, subJobs = 0;
    for (const f of tracts.features) {
      const isMke = f.properties.tract_geoid?.startsWith("55079");
      const workers = f.properties.workers_below_200pct ?? 0;
      const jobs = f.properties.jobs_low ?? 0;
      if (isMke) { mkeWorkers += workers; mkeJobs += jobs; }
      else        { subWorkers += workers; subJobs += jobs; }
    }
    return { mkeWorkers, mkeJobs, subWorkers, subJobs,
             mkeExcess: mkeWorkers - mkeJobs,
             subExcess: subJobs - subWorkers };
  }, [tracts]);

  const maxAbsExcess = useMemo(() => {
    if (!tracts) return 1;
    return Math.max(
      ...tracts.features.map((f) =>
        Math.abs((f.properties.workers_below_200pct ?? 0) - (f.properties.jobs_low ?? 0))
      )
    );
  }, [tracts]);

  // Pre-compute centroid for every tract
  const tractCentroids = useMemo(() => {
    if (!tracts) return {};
    const map = {};
    for (const f of tracts.features) {
      const c = tractCentroid(f);
      if (c) map[f.properties.tract_geoid] = c;
    }
    return map;
  }, [tracts]);

  // Buffer radius in meters
  const bufferRadius = useMemo(() => {
    const m = MODES.find((m) => m.key === isoMode);
    return (m?.speed ?? 83) * isoMinutes;
  }, [isoMode, isoMinutes]);

  // Set of geoids within radius of hovered centroid (excluding origin)
  const inRange = useMemo(() => {
    if (!hovered || !isoEnabled) return null;
    const set = new Set();
    for (const [geoid, c] of Object.entries(tractCentroids)) {
      if (geoid === hovered.geoid) continue;
      const d = haversineMeters(hovered.centroid.lat, hovered.centroid.lon, c.lat, c.lon);
      if (d <= bufferRadius) set.add(geoid);
    }
    return set;
  }, [hovered, bufferRadius, tractCentroids]);

  const onHover = useCallback(({ object }) => {
    clearTimeout(debounceRef.current);
    if (!object) {
      setHovered(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      const geoid = object.properties.tract_geoid;
      const centroid = tractCentroid(object);
      if (centroid) setHovered({ geoid, centroid });
    }, HOVER_DEBOUNCE_MS);
  }, []);

  const getElevation = (f) => {
    const excess = (f.properties.workers_below_200pct ?? 0) - (f.properties.jobs_low ?? 0);
    return (Math.abs(excess) / maxAbsExcess) * MAX_ELEVATION;
  };

  const getFillColor = (f) => {
    const geoid = f.properties.tract_geoid;
    const excess = (f.properties.workers_below_200pct ?? 0) - (f.properties.jobs_low ?? 0);
    const [r, g, b, a] = excessToColor(excess, maxAbsExcess);
    if (hovered && geoid === hovered.geoid) return [r, g, b, a];
    if (inRange?.has(geoid)) return [r, g, b, a];
    return [r, g, b, inRange ? 30 : a];
  };

  const updateTriggers = {
    getFillColor: [maxAbsExcess, hovered?.geoid, inRange],
    getElevation: [maxAbsExcess],
  };

  const layers = [
    tracts &&
      new GeoJsonLayer({
        id: "mismatch",
        data: tracts,
        extruded: true,
        wireframe: true,
        getElevation,
        getFillColor,
        getLineColor: (f) => {
          const excess = (f.properties.workers_below_200pct ?? 0) - (f.properties.jobs_low ?? 0);
          const geoid = f.properties.tract_geoid;
          const dimmed = inRange && !inRange.has(geoid) && hovered?.geoid !== geoid;
          const alpha = dimmed ? 40 : 200;
          return excess > 0 ? [255, 0, 180, alpha] : [0, 255, 100, alpha];
        },
        lineWidthMinPixels: 1,
        pickable: true,
        onHover,
        updateTriggers: {
          ...updateTriggers,
          getLineColor: [hovered?.geoid, inRange],
        },
      }),
  ].filter(Boolean);

  const tooltipContent = ({ object, layer }) => {
    if (!object || layer?.id !== "mismatch") return null;
    const p = object.properties;

    const raceBar = (label, pct, color) => `
      <div style="margin:3px 0">
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px">
          <span style="color:#bbb">${label}</span>
          <span style="color:#fff">${(pct * 100).toFixed(1)}%</span>
        </div>
        <div style="background:#333;border-radius:2px;height:5px">
          <div style="background:${color};width:${(pct * 100).toFixed(1)}%;height:5px;border-radius:2px"></div>
        </div>
      </div>`;

    const raceSection = `
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid #333">
        <div style="font-size:10px;letter-spacing:1px;color:#666;margin-bottom:6px">RACE & ETHNICITY · pop. ${p.pop_total?.toLocaleString()}</div>
        ${raceBar("White", p.pct_white, "#a78bfa")}
        ${raceBar("Black / African American", p.pct_black, "#f472b6")}
        ${raceBar("Hispanic / Latino", p.pct_hispanic, "#fb923c")}
        ${raceBar("Asian", p.pct_asian, "#34d399")}
        ${raceBar("Other / Multiracial", p.pct_other + p.pct_aian, "#94a3b8")}
      </div>`;

    const excess = (p.workers_below_200pct ?? 0) - (p.jobs_low ?? 0);
    return {
      style: {
        backgroundColor: "rgba(10,10,20,0.92)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "8px",
        padding: "10px 14px",
        color: "#ccc",
        maxWidth: "min(260px, 90vw)",
        left: isMobile ? "5vw" : undefined,
        right: isMobile ? "5vw" : undefined,
        transform: isMobile ? "none" : undefined,
      },
      html: `
        <div style="font-size:12px;min-width:200px">
          <b>${excess > 0 ? "+" : ""}${excess.toLocaleString()} ${excess > 0 ? "excess workers" : "job surplus"}</b><br/>
          <span style="color:#aaa;font-size:11px">${p.workers_below_200pct?.toLocaleString()} workers (≤200% poverty) · ${p.jobs_low?.toLocaleString()} low-wage jobs</span>
          ${raceSection}
        </div>`,
    };
  };

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <Header />

      <DeckGL
        initialViewState={INITIAL_VIEW}
        controller
        layers={layers}
        getTooltip={tooltipContent}
      >
        <Map mapStyle={MAPSTYLE} />
      </DeckGL>

      {/* ── Desktop layout ── */}
      {!isMobile && (<>
        <div style={{
          position: "absolute", bottom: 40, left: 20,
          background: "rgba(10,10,20,0.85)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12, padding: "16px 20px", backdropFilter: "blur(12px)", minWidth: 220,
        }}>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "#ccc", marginBottom: 10 }}>JOB SURPLUS / WORKER SURPLUS</div>
          <div style={{ height: 10, borderRadius: 4, background: "linear-gradient(to right, #00ff64, transparent, #ff00b4)", marginBottom: 6 }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#ddd" }}>
            <span>Job surplus</span><span>Worker surplus</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: "#aaa", lineHeight: 1.5 }}>
            Working-age pop. ≤200% poverty − low-wage jobs<br />Elevation = magnitude of imbalance<br />ACS 2022 · LODES 2022
          </div>
        </div>

        {countySummary && (
          <div style={{
            position: "absolute", top: 80, right: 20,
            background: "rgba(10,10,20,0.85)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12, padding: "16px 20px", backdropFilter: "blur(12px)", maxWidth: 280, zIndex: 10,
          }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: "#ccc", marginBottom: 10 }}>COUNTY COMPARISON</div>
            <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.8 }}>
              <span style={{ color: "#ff00b4", fontWeight: 600 }}>Milwaukee County</span> has{" "}
              <strong style={{ color: "#ccc" }}>{countySummary.mkeWorkers.toLocaleString()}</strong> low-income workers
              but only <strong style={{ color: "#ccc" }}>{countySummary.mkeJobs.toLocaleString()}</strong> low-wage jobs
              — a deficit of <strong style={{ color: "#ff00b4" }}>{countySummary.mkeExcess.toLocaleString()}</strong>.
            </div>
            <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.8, marginTop: 8 }}>
              <span style={{ color: "#00ff64", fontWeight: 600 }}>Surrounding suburbs</span> have{" "}
              <strong style={{ color: "#ccc" }}>{countySummary.subJobs.toLocaleString()}</strong> low-wage jobs
              but only <strong style={{ color: "#ccc" }}>{countySummary.subWorkers.toLocaleString()}</strong> low-income workers
              — a surplus of <strong style={{ color: "#00ff64" }}>{countySummary.subExcess.toLocaleString()}</strong>.
            </div>
          </div>
        )}

        <IsochroneControls
          mode={isoMode} minutes={isoMinutes}
          onMode={setIsoMode} onMinutes={setIsoMinutes}
          enabled={isoEnabled} onEnabled={setIsoEnabled}
        />
      </>)}

      {/* ── Mobile bottom drawer ── */}
      {isMobile && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 50 }}>
        <button onClick={() => setDrawerOpen(o => !o)} style={{
          position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
          background: "rgba(10,10,20,0.9)", border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 20, padding: "10px 24px", color: "#ccc", fontSize: 12,
          letterSpacing: 1, cursor: "pointer", pointerEvents: "all",
        }}>
          {drawerOpen ? "CLOSE" : "INFO & CONTROLS"}
        </button>

        {drawerOpen && (
          <div style={{
            position: "absolute", bottom: 60, left: 0, right: 0,
            background: "rgba(10,10,20,0.97)", borderTop: "1px solid rgba(255,255,255,0.1)",
            padding: "20px 20px 28px", overflowY: "auto", maxHeight: "65vh",
            pointerEvents: "all",
          }}>
            {/* Legend */}
            <div style={{ fontSize: 10, letterSpacing: 2, color: "#ccc", marginBottom: 8 }}>JOB SURPLUS / WORKER SURPLUS</div>
            <div style={{ height: 8, borderRadius: 4, background: "linear-gradient(to right, #00ff64, transparent, #ff00b4)", marginBottom: 4 }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#ddd", marginBottom: 4 }}>
              <span>Job surplus</span><span>Worker surplus</span>
            </div>
            <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.5, marginBottom: 16 }}>
              Working-age pop. ≤200% poverty − low-wage jobs · ACS 2022 · LODES 2022
            </div>

            {/* County comparison */}
            {countySummary && (<>
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#ccc", marginBottom: 8 }}>COUNTY COMPARISON</div>
              <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.8, marginBottom: 8 }}>
                <span style={{ color: "#ff00b4", fontWeight: 600 }}>Milwaukee County</span> has{" "}
                <strong style={{ color: "#ccc" }}>{countySummary.mkeWorkers.toLocaleString()}</strong> low-income workers
                but only <strong style={{ color: "#ccc" }}>{countySummary.mkeJobs.toLocaleString()}</strong> low-wage jobs,
                a deficit of <strong style={{ color: "#ff00b4" }}>{countySummary.mkeExcess.toLocaleString()}</strong>.
              </div>
              <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.8, marginBottom: 16 }}>
                <span style={{ color: "#00ff64", fontWeight: 600 }}>Surrounding suburbs</span> have{" "}
                <strong style={{ color: "#ccc" }}>{countySummary.subJobs.toLocaleString()}</strong> low-wage jobs
                but only <strong style={{ color: "#ccc" }}>{countySummary.subWorkers.toLocaleString()}</strong> low-income workers,
                a surplus of <strong style={{ color: "#00ff64" }}>{countySummary.subExcess.toLocaleString()}</strong>.
              </div>
            </>)}

            {/* Isochrone controls */}
            <IsochroneControls
              mode={isoMode} minutes={isoMinutes}
              onMode={setIsoMode} onMinutes={setIsoMinutes}
              enabled={isoEnabled} onEnabled={setIsoEnabled}
              inline
            />
          </div>
        )}
        </div>
      )}

      {(!ready || loading) && (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "rgba(10,10,20,0.9)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 10,
          padding: "12px 24px",
          fontSize: 13,
          color: "#888",
        }}>
          {!ready ? "Initializing DuckDB..." : "Loading data..."}
        </div>
      )}

      {error && (
        <div style={{
          position: "absolute",
          bottom: 40,
          right: 20,
          background: "rgba(180,0,0,0.8)",
          borderRadius: 10,
          padding: "12px 18px",
          fontSize: 13,
          color: "#fff",
        }}>
          Error: {error.message}
        </div>
      )}
    </div>
  );
}
