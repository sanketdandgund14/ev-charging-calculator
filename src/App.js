import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from "react-router-dom";
import { auth, googleProvider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, query, where, getDocs, orderBy, deleteDoc, doc } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';

// --- SHARED DATA ---
const EV_PRESETS = [
  { name: "Nexon EV", battery: 40.5, icon: "🚗", efficiency: 6.5 },
  { name: "MG ZS EV", battery: 50.3, icon: "🚙", efficiency: 6.2 },
  { name: "Ioniq 5", battery: 72.6, icon: "⚡", efficiency: 6.8 },
  { name: "BMW iX", battery: 111.5, icon: "🏎", efficiency: 5.9 },
  { name: "Ola S1 Pro", battery: 4.0, icon: "🛵", efficiency: 55 },
];

const TARIFF_PRESETS = [
  { label: "Home - Standard", rate: 7.5 },
  { label: "BESCOM EV Tariff", rate: 6.0 },
  { label: "Public DC Fast", rate: 22.0 },
];

// --- MAIN APP COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [dark, setDark] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Shared State for Calculator & Analytics
  const [battery, setBattery] = useState(40.5);
  const [fromPct, setFromPct] = useState(20);
  const [toPct, setToPct] = useState(100);
  const [tariffIdx, setTariffIdx] = useState(0);
  const [activePreset, setActivePreset] = useState(0);
  const [petrolMileage, setPetrolMileage] = useState(15);
  const [petrolPrice, setPetrolPrice] = useState(102);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) fetchHistory(u.uid);
    });
    return () => unsubscribe();
  }, []);

  const fetchHistory = async (uid) => {
    if (!db) return;
    const q = query(collection(db, "calculations"), where("userId", "==", uid), orderBy("time", "desc"));
    const snapshot = await getDocs(q);
    setHistory(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const theme = {
    bg: dark ? "#050505" : "#f5f5f7",
    card: dark ? "#111" : "#fff",
    text: dark ? "#fff" : "#111",
    border: dark ? "#222" : "#ddd"
  };

  return (
    <Router>
      <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, transition: "0.3s", fontFamily: "sans-serif" }}>
        
        {/* LOGOUT SAFETY MODAL */}
        {showLogoutConfirm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
            <div style={{ background: theme.card, padding: "30px", borderRadius: "24px", textAlign: "center", maxWidth: "300px", border: `1px solid ${theme.border}` }}>
              <h3>Logout?</h3>
              <p style={{ color: "#666", marginBottom: "20px" }}>End your secure session?</p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => setShowLogoutConfirm(false)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: "#333", color: "#fff" }}>No</button>
                <button onClick={() => signOut(auth).then(() => setShowLogoutConfirm(false))} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: "#ff4444", color: "white", fontWeight: "bold" }}>Yes</button>
              </div>
            </div>
          </div>
        )}

        {/* PERSISTENT NAVBAR */}
        <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 20px", borderBottom: `1px solid ${theme.border}`, background: theme.card }}>
          <h2 style={{ fontWeight: "900", margin: 0 }}>⚡ EV PRO</h2>
          <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
            <Link to="/" style={{ color: "#22c55e", textDecoration: "none", fontWeight: "bold" }}>Calc</Link>
            <Link to="/analytics" style={{ color: theme.text, textDecoration: "none", fontWeight: "bold" }}>Stats</Link>
            <button onClick={() => setDark(!dark)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem" }}>{dark ? "☀️" : "🌙"}</button>
            {user && <button onClick={() => setShowLogoutConfirm(true)} style={{ background: "#333", border: "none", color: "white", padding: "5px 12px", borderRadius: "15px" }}>Logout</button>}
          </div>
        </nav>

        <Routes>
          <Route path="/" element={
            <CalculatorPage 
              user={user} history={history} battery={battery} setBattery={setBattery}
              fromPct={fromPct} setFromPct={setFromPct} toPct={toPct} setToPct={setToPct}
              tariffIdx={tariffIdx} setTariffIdx={setTariffIdx}
              activePreset={activePreset} setActivePreset={setActivePreset}
              petrolMileage={petrolMileage} setPetrolMileage={setPetrolMileage}
              petrolPrice={petrolPrice} setPetrolPrice={setPetrolPrice}
              fetchHistory={fetchHistory} theme={theme} dark={dark}
            />
          } />
          <Route path="/analytics" element={
            <AnalyticsPage history={history} theme={theme} dark={dark} petrolMileage={petrolMileage} petrolPrice={petrolPrice} />
          } />
        </Routes>
      </div>
    </Router>
  );
}

// --- PAGE 1: CALCULATOR ---
function CalculatorPage({ user, history, battery, setBattery, fromPct, setFromPct, toPct, setToPct, tariffIdx, setTariffIdx, activePreset, setActivePreset, petrolMileage, setPetrolMileage, petrolPrice, setPetrolPrice, fetchHistory, theme, dark }) {
  const navigate = useNavigate();

  const rate = TARIFF_PRESETS[tariffIdx].rate;
  const chargeNeeded = Math.max(0, toPct - fromPct);
  const energyKWh = (battery * chargeNeeded) / 100;
  const totalCost = (energyKWh * rate).toFixed(2);

  const saveToHistory = async () => {
    if (!user) return;
    await addDoc(collection(db, "calculations"), {
      userId: user.uid, cost: totalCost, battery, car: EV_PRESETS[activePreset].name, time: new Date()
    });
    fetchHistory(user.uid);
    navigate("/analytics"); // Auto-navigate to show the new graph point!
  };

  if (!user) return <div style={{ textAlign: "center", marginTop: "100px" }}><h1>Welcome to EV PRO</h1><button onClick={() => signInWithPopup(auth, googleProvider)} style={{ background: "#22c55e", color: "white", padding: "15px 30px", border: "none", borderRadius: "20px", fontWeight: "bold", fontSize: "1.2rem" }}>Login with Google</button></div>;

  return (
    <div style={{ maxWidth: "500px", margin: "0 auto", padding: "20px" }}>
      {/* Car Selector */}
      <div style={{ display: "flex", gap: "10px", overflowX: "auto", marginBottom: "20px", paddingBottom: "10px" }}>
        {EV_PRESETS.map((ev, i) => (
          <button key={i} onClick={() => {setActivePreset(i); setBattery(ev.battery);}} style={{ minWidth: "100px", padding: "10px", borderRadius: "15px", border: activePreset === i ? "2px solid #22c55e" : `1px solid ${theme.border}`, background: theme.card, color: theme.text }}>
            {ev.icon} {ev.name}
          </button>
        ))}
      </div>

      {/* Calculator Card */}
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "30px", padding: "30px", textAlign: "center", marginBottom: "20px" }}>
        <h1 style={{ fontSize: "4rem", color: "#22c55e", fontWeight: "900" }}>₹{totalCost}</h1>
        <input type="range" min="0" max="100" value={fromPct} onChange={e => setFromPct(e.target.value)} style={{ width: "100%", accentColor: "#22c55e" }} />
        <p style={{ opacity: 0.6 }}>Charge needed: {chargeNeeded}%</p>
        
        {/* Petrol Inputs */}
        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          <input type="number" value={petrolPrice} onChange={e => setPetrolPrice(e.target.value)} placeholder="Petrol Price" style={{ flex: 1, padding: "10px", borderRadius: "10px", background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }} />
          <input type="number" value={petrolMileage} onChange={e => setPetrolMileage(e.target.value)} placeholder="Mileage" style={{ flex: 1, padding: "10px", borderRadius: "10px", background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }} />
        </div>

        <button onClick={saveToHistory} style={{ width: "100%", background: "#22c55e", color: "white", padding: "18px", borderRadius: "18px", border: "none", marginTop: "20px", fontWeight: "bold" }}>Save & View Stats</button>
      </div>
    </div>
  );
}

// --- PAGE 2: ANALYTICS ---
function AnalyticsPage({ history, theme, dark, petrolMileage, petrolPrice }) {
  const chartData = history.slice(0, 10).reverse().map(item => {
    const cost = parseFloat(item.cost);
    const range = (cost / 7.5) * 6.5; // Estimated range
    const petrolCost = (range / petrolMileage) * petrolPrice;
    return {
      name: new Date(item.time?.toDate()).toLocaleDateString('en-IN', { day: 'numeric' }),
      EV: cost,
      Petrol: Math.round(petrolCost),
      CO2: (cost * 0.1).toFixed(1)
    };
  });

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
      <h2 style={{ textAlign: "center" }}>Savings & Impact</h2>
      
      <div style={{ background: theme.card, padding: "20px", borderRadius: "20px", border: `1px solid ${theme.border}`, marginBottom: "20px" }}>
        <p style={{ fontSize: "0.8rem", color: "#666" }}>PETROL VS EV COST</p>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={dark ? "#222" : "#eee"} />
            <XAxis dataKey="name" stroke={theme.text} />
            <YAxis stroke={theme.text} />
            <Tooltip contentStyle={{ background: theme.card }} />
            <Legend />
            <Line type="monotone" dataKey="Petrol" stroke="#ff4444" strokeWidth={3} />
            <Line type="monotone" dataKey="EV" stroke="#22c55e" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background: theme.card, padding: "20px", borderRadius: "20px", border: `1px solid ${theme.border}` }}>
        <p style={{ fontSize: "0.8rem", color: "#666" }}>CO2 SAVED (KG)</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData}>
            <XAxis dataKey="name" hide />
            <Tooltip />
            <Area type="monotone" dataKey="CO2" stroke="#22c55e" fill="#22c55e33" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}