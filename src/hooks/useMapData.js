import { useState, useEffect } from "react";

export function useMapData(query, ready) {
  const [tracts, setTracts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}data/tracts_merged.geojson`);
        const geojson = await res.json();
        setTracts(geojson);
      } catch (e) {
        console.error("Data load error:", e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [ready]);

  return { tracts, loading };
}
