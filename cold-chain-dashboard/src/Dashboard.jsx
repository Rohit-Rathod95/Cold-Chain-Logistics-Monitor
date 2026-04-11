import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { db, devicePath } from "./firebase";

const ui = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background:
      "radial-gradient(circle at top left, rgba(56, 189, 248, 0.18), transparent 35%), radial-gradient(circle at top right, rgba(14, 165, 233, 0.16), transparent 28%), linear-gradient(180deg, #07111f 0%, #0b1728 100%)",
    zIndex: 0,
  },
  page: {
    maxWidth: "1150px",
    margin: "0 auto",
    padding: "40px 20px 56px",
    fontFamily: "'Inter', 'DM Sans', 'Segoe UI', sans-serif",
    color: "#e5eef7",
    minHeight: "100vh",
    position: "relative",
    zIndex: 1,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "32px",
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 700,
    color: "#f8fafc",
    letterSpacing: "-0.2px",
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#94a3b8",
    fontSize: "14px",
  },
  headerRight: {
    display: "flex",
    alignItems: "flex-end",
    gap: "12px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    flexDirection: "column",
  },
  livePill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#dbeafe",
    letterSpacing: "0.3px",
    background: "rgba(15, 23, 42, 0.72)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
  },
  liveDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
  },
  updatedText: {
    margin: 0,
    fontSize: "12px",
    color: "#94a3b8",
    textAlign: "right",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "20px",
    marginBottom: "20px",
  },
  card: {
    background: "rgba(8, 15, 29, 0.82)",
    borderRadius: "20px",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    boxShadow: "0 18px 50px rgba(2, 6, 23, 0.36)",
    padding: "22px",
    backdropFilter: "blur(14px)",
  },
  label: {
    margin: 0,
    fontSize: "11px",
    color: "#7dd3fc",
    letterSpacing: "1px",
    textTransform: "uppercase",
    fontWeight: 700,
  },
  value: {
    margin: "10px 0 0",
    fontSize: "40px",
    fontWeight: 800,
    color: "#f8fafc",
    lineHeight: 1.1,
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "8px",
    marginTop: "14px",
    fontSize: "14px",
  },
  infoKey: {
    color: "#94a3b8",
  },
  infoValue: {
    fontWeight: 600,
    color: "#e2e8f0",
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.2px",
  },
  wideCard: {
    background: "rgba(8, 15, 29, 0.82)",
    borderRadius: "20px",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    boxShadow: "0 18px 50px rgba(2, 6, 23, 0.36)",
    padding: "22px",
    backdropFilter: "blur(14px)",
    marginTop: "20px",
  },
  mapCard: {
    background: "rgba(8, 15, 29, 0.82)",
    borderRadius: "20px",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    boxShadow: "0 18px 50px rgba(2, 6, 23, 0.36)",
    padding: "22px",
    backdropFilter: "blur(14px)",
    marginTop: "20px",
  },
  mapWrap: {
    marginTop: "14px",
    borderRadius: "16px",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    overflow: "hidden",
    minHeight: "300px",
    background: "rgba(15, 23, 42, 0.72)",
  },
  mapFrame: {
    width: "100%",
    height: "360px",
    border: 0,
    display: "block",
  },
  mapFallback: {
    margin: 0,
    minHeight: "300px",
    display: "grid",
    placeItems: "center",
    color: "#94a3b8",
    fontSize: "14px",
    padding: "20px",
    textAlign: "center",
  },
  rawPayload: {
    margin: "16px 0 0",
    padding: "14px 16px",
    borderRadius: "14px",
    background: "rgba(15, 23, 42, 0.72)",
    border: "1px solid rgba(148, 163, 184, 0.12)",
    color: "#cbd5e1",
    fontSize: "13px",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
  },
  centerPanel: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    position: "relative",
    zIndex: 1,
    color: "#f8fafc",
  },
  centerCard: {
    padding: "28px 32px",
    borderRadius: "20px",
    background: "rgba(8, 15, 29, 0.88)",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    boxShadow: "0 18px 50px rgba(2, 6, 23, 0.36)",
    textAlign: "center",
    maxWidth: "520px",
  },
  centerTitle: {
    margin: 0,
    fontSize: "20px",
  },
  centerText: {
    margin: "10px 0 0",
    color: "#cbd5e1",
  },
};

function parseFirebaseTimestamp(rawTimestamp) {
  if (rawTimestamp == null) {
    return null;
  }

  if (typeof rawTimestamp === "number") {
    return rawTimestamp < 1_000_000_000_000 ? rawTimestamp * 1000 : rawTimestamp;
  }

  if (typeof rawTimestamp === "string") {
    const numeric = Number(rawTimestamp);
    if (!Number.isNaN(numeric)) {
      return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
    }

    const parsedDate = Date.parse(rawTimestamp);
    return Number.isNaN(parsedDate) ? null : parsedDate;
  }

  return null;
}

function parseCoordinateValue(value) {
  if (value == null) {
    return null;
  }

  const numericValue = typeof value === "string" ? Number(value.trim()) : Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function extractCoordinates(data) {
  const latitude =
    parseCoordinateValue(data?.latitude) ??
    parseCoordinateValue(data?.lattitude) ??
    parseCoordinateValue(data?.lat) ??
    parseCoordinateValue(data?.location?.latitude) ??
    parseCoordinateValue(data?.location?.lattitude) ??
    parseCoordinateValue(data?.location?.lat);

  const longitude =
    parseCoordinateValue(data?.longitude) ??
    parseCoordinateValue(data?.lng) ??
    parseCoordinateValue(data?.lon) ??
    parseCoordinateValue(data?.longtitude) ??
    parseCoordinateValue(data?.location?.longitude) ??
    parseCoordinateValue(data?.location?.lng) ??
    parseCoordinateValue(data?.location?.lon) ??
    parseCoordinateValue(data?.location?.longtitude);

  if (latitude == null || longitude == null) {
    return null;
  }

  return { latitude, longitude };
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdatedMs, setLastUpdatedMs] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const dataRef = ref(db, devicePath);

    const unsubscribe = onValue(
      dataRef,
      (snapshot) => {
        try {
          const value = snapshot.val();
          if (value) {
            const firebaseTimestamp =
              parseFirebaseTimestamp(value.timestamp) ??
              parseFirebaseTimestamp(value.lastUpdated) ??
              parseFirebaseTimestamp(value.updatedAt);

            setData(value);
            setError(null);
            setLastUpdatedMs(firebaseTimestamp ?? Date.now());
          } else {
            setError("No data available at this path");
          }
        } catch (err) {
          setError("Error reading data: " + err.message);
        } finally {
          setLoading(false);
        }
      },
      (readError) => {
        setError("Firebase error: " + readError.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const timerId = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(timerId);
  }, []);

  if (loading) {
    return (
      <>
        <div style={ui.backdrop} />
        <div style={ui.centerPanel}>
          <div style={ui.centerCard}>
            <h2 style={ui.centerTitle}>Loading dashboard...</h2>
            <p style={ui.centerText}>Waiting for the first Firebase payload from the DS18B20 sensor.</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div style={ui.backdrop} />
        <div style={ui.centerPanel}>
          <div style={ui.centerCard}>
            <h2 style={ui.centerTitle}>Dashboard error</h2>
            <p style={{ ...ui.centerText, color: "#fda4af" }}>{error}</p>
          </div>
        </div>
      </>
    );
  }

  const temperature = Number(data?.temperature);
  const hasTemperature = Number.isFinite(temperature);
  const isAlert = hasTemperature && temperature > 8;
  const statusText = hasTemperature ? (isAlert ? "ALERT" : "SAFE") : "NO DATA";
  const statusStyle = !hasTemperature
    ? { borderLeft: "4px solid #64748b", color: "#cbd5e1" }
    : isAlert
      ? { borderLeft: "4px solid #f87171", color: "#fca5a5" }
      : { borderLeft: "4px solid #34d399", color: "#86efac" };
  const deviceId = data?.deviceId || "device_1";
  const isLive = lastUpdatedMs != null && nowMs - lastUpdatedMs <= 10000;
  const lastUpdatedLabel = lastUpdatedMs == null ? "N/A" : new Date(lastUpdatedMs).toLocaleString();
  const coordinates = extractCoordinates(data);
  const hasCoordinates = coordinates != null;
  const latitudeLabel = hasCoordinates ? coordinates.latitude.toFixed(6) : "N/A";
  const longitudeLabel = hasCoordinates ? coordinates.longitude.toFixed(6) : "N/A";
  const gpsFix = data?.gpsFix === true;
  const satellites = Number.isFinite(Number(data?.satellites)) ? Number(data.satellites) : null;
  const speedKmph = Number.isFinite(Number(data?.speedKmph)) ? Number(data.speedKmph) : null;
  const altitudeMeters = Number.isFinite(Number(data?.altitudeMeters)) ? Number(data.altitudeMeters) : null;
  const mapsLink = hasCoordinates
    ? `https://www.google.com/maps?q=${coordinates.latitude},${coordinates.longitude}`
    : null;
  const mapDelta = 0.004;
  const embeddedMapUrl = hasCoordinates
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${(coordinates.longitude - mapDelta).toFixed(6)}%2C${(coordinates.latitude - mapDelta).toFixed(6)}%2C${(coordinates.longitude + mapDelta).toFixed(6)}%2C${(coordinates.latitude + mapDelta).toFixed(6)}&layer=mapnik&marker=${coordinates.latitude}%2C${coordinates.longitude}`
    : null;
  const rawPayload = JSON.stringify(data, null, 2);

  return (
    <>
      <div style={ui.backdrop} />
      <main style={ui.page}>
        <header style={ui.header}>
          <div>
            <h1 style={ui.title}>Cold Chain Logistics Monitor</h1>
            <p style={ui.subtitle}>Live DS18B20 temperature readings streamed from Firebase Realtime Database</p>
          </div>
          <div style={ui.headerRight}>
            <div style={ui.livePill}>
              <span
                style={{
                  ...ui.liveDot,
                  background: isLive ? "#22c55e" : "#ef4444",
                  animation: isLive ? "pulse-live-dot 1s ease-in-out infinite" : "none",
                }}
              />
              {isLive ? "Live" : "Offline"}
            </div>
            <p style={ui.updatedText}>Last updated: {lastUpdatedLabel}</p>
          </div>
        </header>

        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap'); @keyframes pulse-live-dot { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.45; transform: scale(0.82); } 100% { opacity: 1; transform: scale(1); } }`}</style>

        {data && (
          <>
            <section style={ui.grid}>
              <article style={{ ...ui.card, ...statusStyle }}>
                <p style={ui.label}>Device ID</p>
                <p style={ui.value}>{deviceId}</p>
                <div style={{ ...ui.infoRow, marginTop: "14px" }}>
                  <span style={ui.infoKey}>Status</span>
                  <span style={ui.statusPill}>{statusText}</span>
                </div>
              </article>

              <article style={ui.card}>
                <p style={ui.label}>Temperature</p>
                <p style={ui.value}>{hasTemperature ? `${temperature.toFixed(2)}°C` : "N/A"}</p>
                <div style={ui.infoRow}>
                  <span style={ui.infoKey}>Safe limit</span>
                  <span style={ui.infoValue}>8.0°C</span>
                </div>
              </article>

              <article style={ui.card}>
                <p style={ui.label}>Last Reading</p>
                <p style={ui.value}>{lastUpdatedLabel}</p>
                <div style={ui.infoRow}>
                  <span style={ui.infoKey}>Source</span>
                  <span style={ui.infoValue}>Firebase RTDB</span>
                </div>
              </article>
            </section>

            <section style={ui.wideCard}>
              <p style={ui.label}>Telemetry Details</p>
              <div style={ui.infoRow}>
                <span style={ui.infoKey}>Latitude</span>
                <span style={ui.infoValue}>{latitudeLabel}</span>
              </div>
              <div style={ui.infoRow}>
                <span style={ui.infoKey}>Longitude</span>
                <span style={ui.infoValue}>{longitudeLabel}</span>
              </div>
              <div style={ui.infoRow}>
                <span style={ui.infoKey}>GPS Fix</span>
                <span style={ui.infoValue}>{gpsFix ? "Yes" : "No"}</span>
              </div>
              <div style={ui.infoRow}>
                <span style={ui.infoKey}>Satellites</span>
                <span style={ui.infoValue}>{satellites ?? "N/A"}</span>
              </div>
              <div style={ui.infoRow}>
                <span style={ui.infoKey}>Speed</span>
                <span style={ui.infoValue}>{speedKmph == null ? "N/A" : `${speedKmph.toFixed(2)} km/h`}</span>
              </div>
              <div style={ui.infoRow}>
                <span style={ui.infoKey}>Altitude</span>
                <span style={ui.infoValue}>{altitudeMeters == null ? "N/A" : `${altitudeMeters.toFixed(1)} m`}</span>
              </div>
              <div style={{ ...ui.infoRow, marginBottom: hasCoordinates ? 0 : "14px" }}>
                <span style={ui.infoKey}>Database Path</span>
                <span style={ui.infoValue}>{devicePath}</span>
              </div>
              {mapsLink && (
                <div style={{ ...ui.infoRow, marginTop: "14px" }}>
                  <span style={ui.infoKey}>Map</span>
                  <a
                    href={mapsLink}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#7dd3fc", fontWeight: 700, textDecoration: "none" }}
                  >
                    Open location
                  </a>
                </div>
              )}
              {!hasCoordinates && (
                <p style={{ margin: "14px 0 0", color: "#94a3b8", fontSize: "13px" }}>
                  Waiting for GPS coordinates from the ESP32 module.
                </p>
              )}
              <pre style={ui.rawPayload}>{rawPayload}</pre>
            </section>

            <section style={ui.mapCard}>
              <p style={ui.label}>Live Location Map</p>
              <div style={ui.mapWrap}>
                {embeddedMapUrl ? (
                  <iframe
                    title="Sensor location map"
                    src={embeddedMapUrl}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    style={ui.mapFrame}
                  />
                ) : (
                  <p style={ui.mapFallback}>Waiting for GPS coordinates to render the map.</p>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}