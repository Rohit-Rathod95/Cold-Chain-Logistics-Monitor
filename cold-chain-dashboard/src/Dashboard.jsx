import { useEffect, useRef, useState } from "react";
import { db, startGpsSimulation } from "./firebase";
import { ref, onValue } from "firebase/database";
import { GoogleMap, Marker, Polyline, useLoadScript } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "420px",
  borderRadius: "16px",
};

const ui = {
  page: {
    maxWidth: "1150px",
    margin: "0 auto",
    padding: "40px 20px 56px",
    fontFamily: "'Inter', 'DM Sans', 'Segoe UI', sans-serif",
    color: "#1f2937",
    background: "#f8fafc",
    minHeight: "100vh",
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
    fontSize: "24px",
    fontWeight: 600,
    color: "#0f172a",
    letterSpacing: "-0.2px",
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "14px",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  livePill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    borderRadius: "999px",
    padding: "2px 0",
    fontSize: "12px",
    fontWeight: 600,
    color: "#334155",
    letterSpacing: "0.3px",
  },
  liveDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
  },
  updatedText: {
    margin: 0,
    fontSize: "12px",
    color: "#64748b",
    textAlign: "right",
  },
  simControls: {
    display: "inline-flex",
    gap: "8px",
  },
  simButton: {
    border: "none",
    borderRadius: "999px",
    padding: "7px 12px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    color: "#334155",
    background: "#e2e8f0",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
    gap: "20px",
    marginBottom: "28px",
  },
  card: {
    background: "#ffffff",
    borderRadius: "20px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    padding: "22px",
  },
  label: {
    margin: 0,
    fontSize: "11px",
    color: "#94a3b8",
    letterSpacing: "1px",
    textTransform: "uppercase",
    fontWeight: 700,
  },
  value: {
    margin: "10px 0 0",
    fontSize: "36px",
    fontWeight: 800,
    color: "#0f172a",
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
    color: "#334155",
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.2px",
  },
  mapCard: {
    background: "#ffffff",
    borderRadius: "20px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    padding: 0,
    overflow: "hidden",
    position: "relative",
  },
  mapHeader: {
    position: "absolute",
    top: "14px",
    left: "14px",
    zIndex: 2,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(255, 255, 255, 0.68)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  },
  mapTitle: {
    margin: 0,
    fontSize: "13px",
    fontWeight: 700,
    color: "#1e293b",
  },
  mapMeta: {
    fontSize: "12px",
    color: "#64748b",
    margin: 0,
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

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [gpsHistory, setGpsHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdatedMs, setLastUpdatedMs] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const mapRef = useRef(null);
  const stopSimulationRef = useRef(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_MAPS_API_KEY,
  });

  useEffect(() => {
    const dataRef = ref(db, "cold_chain/device_1");

    const unsubscribe = onValue(
      dataRef,
      (snapshot) => {
        try {
          const value = snapshot.val();
          if (value) {
            const latitude = Number(value.latitude);
            const longitude = Number(value.longitude);
            const firebaseTimestamp =
              parseFirebaseTimestamp(value.timestamp) ??
              parseFirebaseTimestamp(value.lastUpdated) ??
              parseFirebaseTimestamp(value.updatedAt);

            setData(value);
            setError(null);
            setLastUpdatedMs(firebaseTimestamp ?? Date.now());

            if (!Number.isNaN(latitude) && !Number.isNaN(longitude)) {
              setGpsHistory((prev) => {
                const nextPoint = { lat: latitude, lng: longitude };
                const lastPoint = prev[prev.length - 1];

                // Prevent duplicate consecutive points and keep last 50 only.
                if (lastPoint && lastPoint.lat === nextPoint.lat && lastPoint.lng === nextPoint.lng) {
                  return prev;
                }

                return [...prev, nextPoint].slice(-50);
              });
            }
          } else {
            setError("No data available at this path");
          }
        } catch (err) {
          setError("Error reading data: " + err.message);
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        setError("Firebase error: " + error.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!mapRef.current || gpsHistory.length === 0) {
      return;
    }

    const latestPoint = gpsHistory[gpsHistory.length - 1];
    mapRef.current.panTo(latestPoint);
  }, [gpsHistory]);

  useEffect(() => {
    const timerId = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    return () => {
      if (stopSimulationRef.current) {
        stopSimulationRef.current();
        stopSimulationRef.current = null;
      }
    };
  }, []);

  const handleStartSimulation = () => {
    if (stopSimulationRef.current) {
      return;
    }

    stopSimulationRef.current = startGpsSimulation();
    setIsSimulationRunning(true);
  };

  const handleStopSimulation = () => {
    if (!stopSimulationRef.current) {
      return;
    }

    stopSimulationRef.current();
    stopSimulationRef.current = null;
    setIsSimulationRunning(false);
  };

  if (!isLoaded || loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "20px", color: "red", textAlign: "center" }}>
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  const isAlert = data?.temperature > 8;
  const currentPoint = gpsHistory[gpsHistory.length - 1] || null;
  const displayLatitude = Number(data?.latitude);
  const displayLongitude = Number(data?.longitude);
  const statusText = isAlert ? "ALERT" : "SAFE";
  const statusStyle = isAlert
    ? { borderLeft: "4px solid #ef4444", color: "#ef4444" }
    : { borderLeft: "4px solid #22c55e", color: "#22c55e" };
  const deviceId = data?.deviceId || "device_1";
  const isLive = lastUpdatedMs != null && nowMs - lastUpdatedMs <= 10000;
  const lastUpdatedLabel =
    lastUpdatedMs == null ? "N/A" : new Date(lastUpdatedMs).toLocaleString();

  return (
    <div style={ui.page}>
      <header style={ui.header}>
        <div>
          <h1 style={ui.title}>Cold Chain Logistics Monitor</h1>
          <p style={ui.subtitle}>Live telemetry and location tracking for refrigerated shipments</p>
        </div>
        <div style={ui.headerRight}>
          <div style={ui.simControls}>
            <button
              type="button"
              onClick={handleStartSimulation}
              disabled={isSimulationRunning}
              style={{
                ...ui.simButton,
                background: isSimulationRunning ? "#e2e8f0" : "#0f172a",
                color: isSimulationRunning ? "#64748b" : "#f8fafc",
                cursor: isSimulationRunning ? "not-allowed" : "pointer",
              }}
            >
              Start Simulation
            </button>
            <button
              type="button"
              onClick={handleStopSimulation}
              disabled={!isSimulationRunning}
              style={{
                ...ui.simButton,
                background: !isSimulationRunning ? "#e2e8f0" : "#ffffff",
                boxShadow: !isSimulationRunning ? "none" : "0 1px 6px rgba(0,0,0,0.08)",
                color: !isSimulationRunning ? "#94a3b8" : "#334155",
                cursor: !isSimulationRunning ? "not-allowed" : "pointer",
              }}
            >
              Stop Simulation
            </button>
          </div>
          <div style={ui.livePill}>
            <span
              style={{
                ...ui.liveDot,
                background: isLive ? "#22c55e" : "#ef4444",
                animation: isLive ? "pulse-live-dot 1s ease-in-out infinite" : "none",
              }}
            ></span>
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
              <p style={ui.value}>{data.temperature}°C</p>
              <div style={ui.infoRow}>
                <span style={ui.infoKey}>Safe limit</span>
                <span style={ui.infoValue}>8.0°C</span>
              </div>
            </article>

            <article style={ui.card}>
              <p style={ui.label}>Latitude</p>
              <p style={ui.value}>
                {Number.isNaN(displayLatitude) ? "N/A" : displayLatitude.toFixed(6)}
              </p>
              <div style={ui.infoRow}>
                <span style={ui.infoKey}>Longitude</span>
                <span style={ui.infoValue}>
                  {Number.isNaN(displayLongitude) ? "N/A" : displayLongitude.toFixed(6)}
                </span>
              </div>
            </article>
          </section>

          <section style={ui.mapCard}>
            <div style={ui.mapHeader}>
              <h2 style={ui.mapTitle}>Route Tracking</h2>
              <p style={ui.mapMeta}>{gpsHistory.length} points</p>
            </div>
            <GoogleMap
              mapContainerStyle={containerStyle}
              center={currentPoint || { lat: 0, lng: 0 }}
              zoom={14}
              onLoad={(map) => {
                mapRef.current = map;
              }}
              options={{
                gestureHandling: "greedy",
                streetViewControl: false,
                mapTypeControl: false,
              }}
            >
              {gpsHistory.length > 1 && (
                <Polyline
                  path={gpsHistory}
                  options={{
                    strokeColor: "#1a73e8",
                    strokeOpacity: 0.95,
                    strokeWeight: 4,
                  }}
                />
              )}
              {currentPoint && (
                <Marker
                  position={currentPoint}
                  title={`Temp: ${data.temperature}°C`}
                />
              )}
            </GoogleMap>
          </section>

          <div
            style={{
              fontSize: "12px",
              color: "#64748b",
              marginTop: "18px",
              textAlign: "right",
            }}
          >
            Real-time data from Firebase Realtime Database
          </div>
        </>
      )}
    </div>
  );
}