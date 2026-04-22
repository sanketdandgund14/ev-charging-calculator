import { useState, useEffect } from "react";
import { auth, googleProvider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, query, where, getDocs, orderBy, deleteDoc, doc } from "firebase/firestore";

const EV_PRESETS = [
  { name: "Nexon EV", battery: 40.5, icon: "🚗", efficiency: 6.5 },
  { name: "MG ZS EV", battery: 50.3, icon: "🚙", efficiency: 6.2 },
  { name: "Ioniq 5", battery: 72.6, icon: "⚡", efficiency: 6.8 },
  { name: "BMW iX", battery: 111.5, icon: "🏎", efficiency: 5.9 },
  { name: "Ola S1", battery: 3.97, icon: "🛵", efficiency: 55 },
];

const TARIFF_PRESETS = [
  { label: "Home - Off Peak", rate: 5.5 },
  { label: "Home - Standard", rate: 7.5 },
  { label: "BESCOM EV Tariff", rate: 6.0 },
  { label: "Public AC Charger", rate: 15.0 },
  { label: "DC Fast Charger", rate: 25.0 },
  { label: "Custom", rate: null },
];

function StatCard({ icon, title, value, sub, dark }) {
  return (
    <div style={{ flex: 1, background: dark ? "rgba(255,255,255,0.03)" : "#fff", borderRadius: 16, padding: "15px", border: dark ? "1px solid #222" : "1px solid #e5e7eb", textAlign: "center" }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
      <div style={{ color: dark ? "#666" : "#8e8e93", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>{title}</div>
      <div style={{ color: dark ? "#fff" : "#1c1c1e", fontSize: 16, fontWeight: 700 }}>{value}</div>
      <div style={{ color: dark ? "#444" : "#aeaeae", fontSize: 10 }}>{sub}</div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [dark, setDark] = useState(true);
  const [battery, setBattery] = useState(40.5);
  const [fromPct, setFromPct] = useState(20);
  const [toPct, setToPct] = useState(100);
  const [tariffIdx, setTariffIdx] = useState(1);
  const [customRate] = useState(7.5); // Fixed for now to remove warning
  const [activePreset, setActivePreset] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) fetchHistory(currentUser.uid);
    });
    return () => unsubscribe();
  }, []);

  const fetchHistory = async (uid) => {
    try {
      const q = query(collection(db, "calculations"), where("userId", "==", uid), orderBy("time", "desc"));
      const snapshot = await getDocs(q);
      setHistory(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
  };

  const saveToHistory = async (cost) => {
    if (!user) return;
    try {
      await addDoc(collection(db, "calculations"), {
        userId: user.uid,
        cost,
        battery,
        car: EV_PRESETS[activePreset]?.name || "Custom",
        time: new Date()
      });
      fetchHistory(user.uid);
    } catch (e) { alert(e.message); }
  };

  const deleteItem = async (id) => {
    await deleteDoc(doc(db, "calculations", id));
    fetchHistory(user.uid);
  };

  const rate = TARIFF_PRESETS[tariffIdx].rate ?? customRate;
  const energyKWh = (battery * (toPct - fromPct)) / 100;
  const totalCost = (energyKWh * rate).toFixed(2);
  const efficiency = EV_PRESETS[activePreset]?.efficiency || 6.5;
  const estRange = (energyKWh * efficiency).toFixed(0);

  return (
    <div style={{ minHeight: "100vh", background: dark ? "#050505" : "#f5f5f7", color: dark ? "#fff" : "#1d1d1f", padding: "20px" }}>
      <div style={{ maxWidth: "500px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
          <h2>⚡ EV PRO</h2>
          <button onClick={() => setDark(!dark)} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }}>{dark ? "☀️" : "🌙"}</button>
          {user ? <button onClick={() => signOut(auth)}>Logout</button> : <button onClick={() => signInWithPopup(auth, googleProvider)}>Login</button>}
        </div>

        {!user ? (
          <div style={{ textAlign: "center", marginTop: "50px" }}><h1>Smart EV Tracking</h1><p>Login to start.</p></div>
        ) : (
          <>
            <div style={{ display: "flex", gap: "10px", overflowX: "auto", marginBottom: "20px" }}>
              {EV_PRESETS.map((ev, i) => (
                <button key={i} onClick={() => {setActivePreset(i); setBattery(ev.battery);}} style={{ padding: "10px", borderRadius: "10px", border: activePreset === i ? "2px solid #22c55e" : "1px solid #333" }}>
                  {ev.icon} {ev.name}
                </button>
              ))}
            </div>

            <div style={{ background: dark ? "#111" : "#fff", padding: "30px", borderRadius: "20px", textAlign: "center", border: "1px solid #333" }}>
              <h1 style={{ fontSize: "3rem", color: "#22c55e" }}>₹{totalCost}</h1>
              <div style={{ margin: "20px 0" }}>
                <input type="range" min="0" max="100" value={fromPct} onChange={e => setFromPct(e.target.value)} />
                <input type="range" min="0" max="100" value={toPct} onChange={e => setToPct(e.target.value)} />
              </div>
              <button onClick={() => saveToHistory(totalCost)} style={{ width: "100%", background: "#22c55e", color: "#fff", padding: "15px", borderRadius: "15px", border: "none", fontWeight: "bold" }}>Save to Mumbai</button>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
               <StatCard dark={dark} icon="📍" title="Range" value={`${estRange} km`} sub="Est. distance" />
               <StatCard dark={dark} icon="💰" title="Per KM" value={`₹${(totalCost/estRange || 0).toFixed(2)}`} sub="EV Economy" />
            </div>

            <div style={{ marginTop: "30px" }}>
              {history.map(item => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "15px", background: dark ? "#111" : "#fff", marginBottom: "10px", borderRadius: "10px", border: "1px solid #222" }}>
                  <span>₹{item.cost} - {item.car}</span>
                  <button onClick={() => deleteItem(item.id)} style={{ color: "red", border: "none", background: "none" }}>×</button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}