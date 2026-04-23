import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate } from "react-router-dom";
import { auth, googleProvider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, query, where, getDocs, orderBy, deleteDoc, doc } from "firebase/firestore";
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;800&family=Outfit:wght@300;700&display=swap');

    :root {
      --accent: #22c55e;
      --glass: rgba(255, 255, 255, 0.03);
      --glass-border: rgba(255, 255, 255, 0.1);
      --glow: 0 0 20px rgba(34, 197, 94, 0.2);
    }

    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: #000 !important;
      letter-spacing: -0.02em;
    }

    .luxury-card {
      background: var(--glass) !important;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--glass-border) !important;
      box-shadow: var(--glow);
    }

    .hero-text {
      font-family: 'Outfit', sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.15em;
    }

    input, select {
      background: rgba(255,255,255,0.05) !important;
      border: 1px solid rgba(255,255,255,0.1) !important;
      transition: 0.3s;
    }

    input:focus {
      border-color: var(--accent) !important;
      box-shadow: 0 0 15px rgba(34, 197, 94, 0.2);
      outline: none;
    }

    ::-webkit-scrollbar { width: 5px; }
    ::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
  `}</style>
);

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

export default function App() {
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [dark, setDark] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Shared State
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
      setLoading(false);
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

  if (loading) return <div style={{background: "#000", height: "100vh"}}></div>;

  return (
    <Router>
      <GlobalStyles />
      <div style={{ minHeight: "100vh", background: "#000", color: theme.text, transition: "0.3s" }}>
        
        {/* LOGOUT MODAL */}
        {showLogoutConfirm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}>
            <div style={{ background: theme.card, padding: "40px", borderRadius: "24px", textAlign: "center", border: `1px solid ${theme.border}` }}>
              <h3>Confirm Logout?</h3>
              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button onClick={() => setShowLogoutConfirm(false)} style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "none", background: "#333", color: "#fff" }}>Stay</button>
                <button onClick={() => signOut(auth).then(() => setShowLogoutConfirm(false))} style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "none", background: "#ff4444", color: "white", fontWeight: "bold" }}>Logout</button>
              </div>
            </div>
          </div>
        )}

        {/* NAVIGATION */}
        {user && (
          <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 25px", borderBottom: `1px solid ${theme.border}`, background: theme.card }}>
            <h2 style={{ fontWeight: "900", color: "#22c55e" }}>EV PRO</h2>
            <div style={{ display: "flex", gap: "25px", alignItems: "center" }}>
              <Link to="/" style={{ color: theme.text, textDecoration: "none", fontWeight: "bold" }}>Calc</Link>
              <Link to="/analytics" style={{ color: theme.text, textDecoration: "none", fontWeight: "bold" }}>Stats</Link>
              <button onClick={() => setDark(!dark)} style={{ background: "none", border: "none", fontSize: "1.2rem" }}>{dark ? "☀️" : "🌙"}</button>
              <button onClick={() => setShowLogoutConfirm(true)} style={{ background: "#333", border: "none", color: "white", padding: "6px 15px", borderRadius: "15px" }}>Logout</button>
            </div>
          </nav>
        )}

        <Routes>
          <Route path="/" element={
            user ? (
              <CalculatorPage 
                user={user} history={history} battery={battery} setBattery={setBattery}
                fromPct={fromPct} setFromPct={setFromPct} toPct={toPct} setToPct={setToPct}
                tariffIdx={tariffIdx} setTariffIdx={setTariffIdx}
                activePreset={activePreset} setActivePreset={setActivePreset}
                petrolMileage={petrolMileage} setPetrolMileage={setPetrolMileage}
                petrolPrice={petrolPrice} setPetrolPrice={setPetrolPrice}
                fetchHistory={fetchHistory} theme={theme}
              />
            ) : (
              <LoginPage theme={theme} />
            )
          } />
          <Route path="/analytics" element={user ? <AnalyticsPage history={history} theme={theme} dark={dark} petrolMileage={petrolMileage} petrolPrice={petrolPrice} /> : <Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}
function LoginPage({ theme }) {
  return (
    <div style={{ textAlign: "center", padding: "0 20px", background: "radial-gradient(circle at top, #0a2e1a 0%, #000 70%)", minHeight: "90vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      
      {/* Cinematic Hero Section */}
      <div className="luxury-card" style={{ maxWidth: "800px", margin: "0 auto", padding: "60px 20px", borderRadius: "40px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "5px", background: "linear-gradient(90deg, transparent, #22c55e, transparent)" }}></div>
        
        <p className="hero-text" style={{ fontSize: "0.8rem", color: "#22c55e", marginBottom: "10px" }}>The Future of Mobility</p>
        <h1 className="hero-text" style={{ fontSize: "clamp(2.5rem, 8vw, 5rem)", fontWeight: "800", margin: 0, lineHeight: "1" }}>
          EV PRO
        </h1>
        <p style={{ color: "#888", fontSize: "1.1rem", marginTop: "20px", maxWidth: "500px", margin: "20px auto" }}>
          Track, calculate, and optimize your transition to electric energy with precision.
        </p>
        
        <div style={{ marginTop: "40px" }}>
          <button onClick={() => signInWithPopup(auth, googleProvider)} style={{ background: "#fff", color: "#000", padding: "20px 50px", border: "none", borderRadius: "100px", fontWeight: "800", fontSize: "1rem", cursor: "pointer", transition: "0.4s" }} onMouseOver={e => e.target.style.background = "#22c55e"}>
            ACCESS DASHBOARD
          </button>
        </div>
      </div>

      <div style={{ marginTop: "40px", opacity: 0.4 }}>
        <p style={{ fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>Designed for the Modern Indian Household</p>
      </div>
    </div>
  );
}

function CalculatorPage({ user, history, battery, setBattery, fromPct, setFromPct, toPct, setToPct, tariffIdx, setTariffIdx, activePreset, setActivePreset, petrolMileage, setPetrolMileage, petrolPrice, setPetrolPrice, fetchHistory, theme }) {
  const navigate = useNavigate();
  const rate = TARIFF_PRESETS[tariffIdx].rate;
  const chargeNeeded = Math.max(0, toPct - fromPct);
  const energyKWh = (battery * chargeNeeded) / 100;
  const totalCost = (energyKWh * rate).toFixed(2);

  const saveToHistory = async () => {
    await addDoc(collection(db, "calculations"), {
      userId: user.uid, cost: totalCost, battery, car: EV_PRESETS[activePreset].name, time: new Date()
    });
    fetchHistory(user.uid);
    navigate("/analytics");
  };

  return (
    <div style={{ maxWidth: "500px", margin: "0 auto", padding: "20px" }}>
      <div style={{ display: "flex", gap: "10px", overflowX: "auto", marginBottom: "25px" }}>
        {EV_PRESETS.map((ev, i) => (
          <button key={i} onClick={() => {setActivePreset(i); setBattery(ev.battery);}} style={{ minWidth: "110px", padding: "12px", borderRadius: "18px", border: activePreset === i ? "2px solid #22c55e" : `1px solid ${theme.border}`, background: theme.card, color: theme.text }}>
            <div style={{fontSize: "1.5rem"}}>{ev.icon}</div><div>{ev.name}</div>
          </button>
        ))}
      </div>

      <div style={{ background: theme.card, borderRadius: "30px", padding: "35px", border: `1px solid ${theme.border}`, marginBottom: "25px" }}>
        <p style={{ fontSize: "0.8rem", opacity: 0.5 }}>CHARGING COST</p>
        <h1 style={{ fontSize: "4.5rem", color: "#22c55e", fontWeight: "900", margin: "10px 0" }}>₹{totalCost}</h1>
        
        <select value={tariffIdx} onChange={e => setTariffIdx(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "12px", background: theme.bg, color: theme.text, border: `1px solid ${theme.border}`, marginBottom: "20px" }}>
          {TARIFF_PRESETS.map((t, i) => <option key={i} value={i}>{t.label} (₹{t.rate}/unit)</option>)}
        </select>

        <div style={{ marginBottom: "20px", textAlign: "left" }}>
          <label style={{ fontSize: "0.8rem", opacity: 0.6 }}>Battery From {fromPct}% to {toPct}%</label>
          <input type="range" min="0" max="100" value={fromPct} onChange={e => setFromPct(e.target.value)} style={{ width: "100%", accentColor: "#22c55e" }} />
        </div>

        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <input type="number" value={petrolPrice} onChange={e => setPetrolPrice(e.target.value)} placeholder="Petrol Price" style={{ flex: 1, padding: "12px", borderRadius: "12px", background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }} />
          <input type="number" value={petrolMileage} onChange={e => setPetrolMileage(e.target.value)} placeholder="Mileage" style={{ flex: 1, padding: "12px", borderRadius: "12px", background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text }} />
        </div>

        <button onClick={saveToHistory} style={{ width: "100%", background: "#22c55e", color: "white", padding: "20px", borderRadius: "18px", border: "none", fontWeight: "bold" }}>SAVE & VIEW STATS</button>
      </div>

      <button onClick={() => window.open("https://www.google.com/maps/search/ev+charging+station+near+me", "_blank")} style={{ width: "100%", padding: "15px", borderRadius: "15px", background: "transparent", color: "#22c55e", border: "1px solid #22c55e", fontWeight: "bold" }}>
        🗺️ FIND NEARBY CHARGING STATIONS
      </button>
    </div>
  );
}

function AnalyticsPage({ history, theme, dark, petrolMileage, petrolPrice }) {
  const chartData = history.slice(0, 10).reverse().map(item => {
    const cost = parseFloat(item.cost);
    const range = (cost / 7.5) * 6.5; 
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
      <h2 style={{ textAlign: "center", marginBottom: "30px" }}>Savings Dashboard</h2>
      <div style={{ background: theme.card, padding: "20px", borderRadius: "20px", border: `1px solid ${theme.border}`, marginBottom: "20px" }}>
        <p style={{ fontSize: "0.8rem", opacity: 0.5 }}>PETROL VS EV COST</p>
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
    </div>
  );
}