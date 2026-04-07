import { initializeApp } from "firebase/app";
import { getDatabase, ref, update } from "firebase/database";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCMDNODPT-oQSa1IzZnVubenDm6y4PhBsU",
  authDomain: "cold-chain-logistics-monitor.firebaseapp.com",
  databaseURL: "https://cold-chain-logistics-monitor-default-rtdb.firebaseio.com",
  projectId: "cold-chain-logistics-monitor",
  storageBucket: "cold-chain-logistics-monitor.firebasestorage.app",
  messagingSenderId: "892855361000",
  appId: "1:892855361000:web:5522d17cf8ca3680d7585d",
  measurementId: "G-38XY7S679X"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

export function startGpsSimulation() {
  const deviceRef = ref(db, "cold_chain/device_1");
  const baseLatitude = 21.1458;
  const baseLongitude = 79.0882;
  let latitude = baseLatitude;
  let longitude = baseLongitude;
  let heading = Math.PI / 4;
  const stepSize = 0.0002;

  const intervalId = setInterval(async () => {
    // Gradually vary heading so path looks like a smooth drive, not zig-zag jumps.
    heading += (Math.random() - 0.5) * 0.2;

    const driftLat = Math.cos(heading) * stepSize;
    const driftLng = Math.sin(heading) * stepSize;
    const jitterLat = (Math.random() - 0.5) * 0.00003;
    const jitterLng = (Math.random() - 0.5) * 0.00003;

    latitude += driftLat + jitterLat;
    longitude += driftLng + jitterLng;

    // Keep the simulated route within a reasonable area near the base location.
    latitude += (baseLatitude - latitude) * 0.03;
    longitude += (baseLongitude - longitude) * 0.03;

    const temperature = Number((4 + Math.random() * 4).toFixed(2));

    try {
      await update(deviceRef, {
        deviceId: "device_1",
        latitude,
        longitude,
        temperature,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Simulation write error:", error);
    }
  }, 3000);

  return () => clearInterval(intervalId);
}

// Sign in anonymously on app load
signInAnonymously(auth).catch((error) => {
  console.error("Auth error:", error);
});