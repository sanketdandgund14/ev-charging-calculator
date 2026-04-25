import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate } from "react-router-dom";
import { auth, googleProvider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, query, where, getDocs, orderBy, deleteDoc, doc } from "firebase/firestore";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, BarChart, Bar
} from "recharts";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const EV_PRESETS = [
  { name: "Nexon EV",   battery: 40.5,  icon: "🚗", efficiency: 6.5,  price: 1500000 },
  { name: "MG ZS EV",  battery: 50.3,  icon: "🚙", efficiency: 6.2,  price: 2200000 },
  { name: "Ioniq 5",   battery: 72.6,  icon: "⚡", efficiency: 6.8,  price: 4500000 },
  { name: "BMW iX",    battery: 111.5, icon: "🏎", efficiency: 5.9,  price: 11500000 },
  { name: "Ola S1 Pro",battery: 4.0,   icon: "🛵", efficiency: 55.0, price: 150000  },
];

const TARIFF_PRESETS = [
  { label: "Home - Standard",  rate: 7.5  },
  { label: "BESCOM EV Tariff", rate: 6.0  },
  { label: "Public DC Fast",   rate: 22.0 },
];

// IIT Madras 2025: ICE 53.84t vs EV 33t over 300,000 km → 69.47g CO₂ saved per km
const CO2_SAVED_PER_KM = 69.47; // grams

// ─── GLOBAL STYLES ───────────────────────────────────────────────────────────

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;800&family=Outfit:wght@300;700&family=DM+Mono:wght@400;500&display=swap');
    :root {
      --accent: #22c55e;
      --accent-dark: #16a34a;
      --glass: rgba(255,255,255,0.03);
      --glass-border: rgba(255,255,255,0.1);
      --glow: 0 0 20px rgba(34,197,94,0.15);
      --blue: #3b82f6;
      --amber: #f59e0b;
      --red: #ef4444;
    }
    * { box-sizing: border-box; }
    body { font-family: 'Plus Jakarta Sans', sans-serif; background: #000 !important; letter-spacing: -0.02em; margin: 0; }
    .mono { font-family: 'DM Mono', monospace; }
    @keyframes reveal {
      0%   { letter-spacing: 0.8em; filter: blur(12px); opacity: 0; transform: scale(1.1); }
      100% { letter-spacing: 0.15em; filter: blur(0); opacity: 1; transform: scale(1); }
    }
    @keyframes float {
      0%   { transform: translateY(0) translateX(0); opacity: 0; }
      50%  { opacity: 0.6; }
      100% { transform: translateY(-100vh) translateX(20px); opacity: 0; }
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .fadeUp { animation: fadeUp 0.5s ease forwards; }
    .luxury-card {
      background: var(--glass) !important;
      backdrop-filter: blur(12px);
      border: 1px solid var(--glass-border) !important;
      box-shadow: var(--glow);
      position: relative;
    }
    .luxury-card::after {
      content: "";
      position: absolute;
      inset: -1px;
      border-radius: inherit;
      padding: 1px;
      background: linear-gradient(90deg, transparent, #22c55e, transparent, #22c55e, transparent);
      background-size: 200% 100%;
      animation: scan 4s linear infinite;
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
    }
    @keyframes scan {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .hero-text { font-family: 'Outfit', sans-serif; text-transform: uppercase; letter-spacing: 0.15em; }
    input[type="range"] { accent-color: var(--accent); }
    input, select, textarea {
      background: rgba(255,255,255,0.05) !important;
      border: 1px solid rgba(255,255,255,0.1) !important;
      transition: 0.3s;
      color: inherit;
    }
    input:focus, select:focus {
      border-color: var(--accent) !important;
      box-shadow: 0 0 15px rgba(34,197,94,0.2);
      outline: none;
    }
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
    .btn-primary {
      background: var(--accent); color: #000; border: none;
      padding: 16px 24px; border-radius: 16px; font-weight: 800;
      font-size: 0.95rem; cursor: pointer; width: 100%;
      transition: 0.2s; font-family: 'Plus Jakarta Sans', sans-serif;
    }
    .btn-primary:hover { background: var(--accent-dark); transform: translateY(-1px); }
    .btn-outline {
      background: transparent; color: var(--accent);
      border: 1px solid var(--accent); padding: 12px 20px;
      border-radius: 14px; font-weight: 600; cursor: pointer;
      transition: 0.2s; font-family: 'Plus Jakarta Sans', sans-serif;
    }
    .btn-outline:hover { background: rgba(34,197,94,0.1); }
    .stat-chip {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px; padding: 16px 18px;
    }
    .stat-chip-label { font-size: 0.7rem; opacity: 0.5; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; }
    .stat-chip-val { font-size: 1.4rem; font-weight: 800; }
  `}</style>
);

// ─── APP ROOT ─────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser]                   = useState(null);
  const [history, setHistory]             = useState([]);
  const [dark, setDark]                   = useState(true);
  const [showLogoutConfirm, setShowLogout] = useState(false);
  const [loading, setLoading]             = useState(true);

  // Shared calculator state
  const [battery, setBattery]           = useState(40.5);
  const [fromPct, setFromPct]           = useState(20);
  const [toPct, setToPct]               = useState(80);
  const [tariffIdx, setTariffIdx]       = useState(0);
  const [customRate, setCustomRate]     = useState("");
  const [activePreset, setActivePreset] = useState(0);
  const [petrolMileage, setPetrolMileage] = useState(15);
  const [petrolPrice, setPetrolPrice]   = useState(102);

  // Live price state
  const [liveElec, setLiveElec]   = useState(null);
  const [livePetrol, setLivePetrol] = useState(null);
  const [priceTS, setPriceTS]     = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) fetchHistory(u.uid);
    });
    fetchLivePrices();
    return () => unsub();
  }, []);

  // ── Live prices (Open Oil API — no key needed for basic petrol) ──
  const fetchLivePrices = async () => {
    try {
      // Petrol: use a CORS-friendly public endpoint
      const res = await fetch(
        "https://api.collectapi.com/economy/gasPrice?country=IN",
        { headers: { "content-type": "application/json", "authorization": "apikey DEMO" } }
      );
      if (res.ok) {
        const data = await res.json();
        const petrol = data?.result?.find(r => r.gasType === "petrol");
        if (petrol) { setLivePetrol(parseFloat(petrol.price)); setPetrolPrice(parseFloat(petrol.price)); }
      }
    } catch (_) { /* fallback to preset */ }
    // Electricity: BESCOM publishes no free API — use POSOCO average (static 2026 India avg)
    setLiveElec(7.5);
    setPriceTS(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
  };

  const fetchHistory = async (uid) => {
    if (!db) return;
    const q = query(collection(db, "calculations"), where("userId", "==", uid), orderBy("time", "desc"));
    const snap = await getDocs(q);
    setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const deleteItem = async (id, uid) => {
    await deleteDoc(doc(db, "calculations", id));
    fetchHistory(uid);
  };

  const theme = {
    bg: dark ? "#050505" : "#f5f5f7",
    card: dark ? "#111" : "#fff",
    text: dark ? "#fff" : "#111",
    border: dark ? "#222" : "#ddd",
    sub: dark ? "#888" : "#555",
  };

  if (loading) return <div style={{ background: "#000", height: "100vh" }} />;

  return (
    <Router>
      <GlobalStyles />
      <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, transition: "0.3s" }}>

        {/* LOGOUT MODAL */}
        {showLogoutConfirm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}>
            <div style={{ background: theme.card, padding: "40px", borderRadius: "24px", textAlign: "center", border: `1px solid ${theme.border}`, minWidth: 300 }}>
              <div style={{ fontSize: "2rem", marginBottom: 12 }}>👋</div>
              <h3 style={{ marginBottom: 8 }}>Confirm Logout?</h3>
              <p style={{ color: theme.sub, fontSize: "0.85rem", marginBottom: 24 }}>Your history is saved in the cloud.</p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowLogout(false)} style={{ flex: 1, padding: 14, borderRadius: 12, border: "none", background: "#333", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Stay</button>
                <button onClick={() => signOut(auth).then(() => setShowLogout(false))} style={{ flex: 1, padding: 14, borderRadius: 12, border: "none", background: "#ef4444", color: "#fff", fontWeight: 800, cursor: "pointer" }}>Logout</button>
              </div>
            </div>
          </div>
        )}

        {/* NAV */}
        {user && (
          <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 24px", borderBottom: `1px solid ${theme.border}`, background: theme.card, position: "sticky", top: 0, zIndex: 100 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "1.1rem" }}>⚡</span>
              <span style={{ fontWeight: 900, color: "#22c55e", fontSize: "1.1rem" }}>EV PRO</span>
            </div>
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <Link to="/"          style={{ color: theme.text, textDecoration: "none", fontWeight: 600, fontSize: "0.9rem" }}>Calc</Link>
              <Link to="/tco"       style={{ color: theme.text, textDecoration: "none", fontWeight: 600, fontSize: "0.9rem" }}>TCO</Link>
              <Link to="/analytics" style={{ color: theme.text, textDecoration: "none", fontWeight: 600, fontSize: "0.9rem" }}>Stats</Link>
              <button onClick={() => setDark(!dark)} style={{ background: "none", border: "none", fontSize: "1.1rem", cursor: "pointer" }}>{dark ? "☀️" : "🌙"}</button>
              <button onClick={() => setShowLogout(true)} style={{ background: "#1a1a1a", border: "1px solid #333", color: "#fff", padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontSize: "0.85rem" }}>Logout</button>
            </div>
          </nav>
        )}

        {/* LIVE PRICE BANNER */}
        {user && priceTS && (
          <div style={{ background: "rgba(34,197,94,0.06)", borderBottom: "1px solid rgba(34,197,94,0.15)", padding: "6px 24px", display: "flex", gap: 20, fontSize: "0.75rem", fontFamily: "'DM Mono', monospace", color: "#22c55e" }}>
            <span>⚡ Elec: ₹{liveElec}/kWh</span>
            {livePetrol && <span>⛽ Petrol: ₹{livePetrol}/L</span>}
            <span style={{ opacity: 0.6 }}>updated {priceTS}</span>
          </div>
        )}

        <Routes>
          <Route path="/" element={
            user ? (
              <CalculatorPage
                user={user} history={history} battery={battery} setBattery={setBattery}
                fromPct={fromPct} setFromPct={setFromPct} toPct={toPct} setToPct={setToPct}
                tariffIdx={tariffIdx} setTariffIdx={setTariffIdx}
                customRate={customRate} setCustomRate={setCustomRate}
                activePreset={activePreset} setActivePreset={setActivePreset}
                petrolMileage={petrolMileage} setPetrolMileage={setPetrolMileage}
                petrolPrice={petrolPrice} setPetrolPrice={setPetrolPrice}
                fetchHistory={fetchHistory} theme={theme} dark={dark}
                deleteItem={deleteItem}
              />
            ) : <LoginPage />
          } />
          <Route path="/tco" element={user ? <TCOPage theme={theme} dark={dark} /> : <Navigate to="/" />} />
          <Route path="/analytics" element={user ? <AnalyticsPage history={history} theme={theme} dark={dark} petrolMileage={petrolMileage} petrolPrice={petrolPrice} deleteItem={deleteItem} user={user} /> : <Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────

function LoginPage() {
  return (
    <>
      {/* Particles */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        {[...Array(20)].map((_, i) => (
          <div key={i} style={{
            position: "absolute", width: 2, height: 2, background: "#22c55e", borderRadius: "50%",
            top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`,
            boxShadow: "0 0 8px #22c55e",
            animation: `float ${Math.random() * 15 + 8}s infinite linear`,
            animationDelay: `${Math.random() * 5}s`,
          }} />
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "0 20px", background: "radial-gradient(circle at top, #0a2e1a 0%, #000 70%)", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <div className="luxury-card" style={{ maxWidth: 720, width: "100%", padding: "60px 40px", borderRadius: 40, overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, transparent, #22c55e, transparent)" }} />
          <p className="hero-text" style={{ fontSize: "0.75rem", color: "#22c55e", marginBottom: 10 }}>The Future of Mobility</p>
          <h1 className="hero-text" style={{ fontSize: "clamp(3rem, 10vw, 5.5rem)", fontWeight: 800, margin: 0, lineHeight: 1, animation: "reveal 2s cubic-bezier(0.19,1,0.22,1) forwards" }}>
            EV PRO
          </h1>
          <p style={{ color: "#888", fontSize: "1rem", margin: "20px auto", maxWidth: 480 }}>
            Track, calculate, and optimise your transition to electric energy — with real data, TCO analysis, and PDF reports.
          </p>

          {/* Feature pills */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", margin: "24px 0" }}>
            {["⚡ Charging Cost", "📊 TCO & ROI", "🌿 CO₂ Savings", "📄 PDF Export", "☁️ Cloud History"].map(f => (
              <span key={f} style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e", borderRadius: 999, padding: "5px 14px", fontSize: "0.75rem", fontWeight: 600 }}>{f}</span>
            ))}
          </div>

          <button
            onClick={() => signInWithPopup(auth, googleProvider)}
            style={{ background: "#fff", color: "#000", padding: "18px 50px", border: "none", borderRadius: 100, fontWeight: 800, fontSize: "1rem", cursor: "pointer", transition: "0.3s", marginTop: 10 }}
            onMouseOver={e => e.currentTarget.style.background = "#22c55e"}
            onMouseOut={e => e.currentTarget.style.background = "#fff"}
          >
            ACCESS DASHBOARD
          </button>
        </div>
        <p style={{ marginTop: 30, fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.35 }}>Designed for the Modern Indian EV Owner</p>
      </div>
    </>
  );
}

// ─── CALCULATOR PAGE ──────────────────────────────────────────────────────────

function CalculatorPage({ user, history, battery, setBattery, fromPct, setFromPct, toPct, setToPct, tariffIdx, setTariffIdx, customRate, setCustomRate, activePreset, setActivePreset, petrolMileage, setPetrolMileage, petrolPrice, setPetrolPrice, fetchHistory, theme, dark, deleteItem }) {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);

  const rate        = customRate ? parseFloat(customRate) : TARIFF_PRESETS[tariffIdx].rate;
  const chargeNeeded = Math.max(0, toPct - fromPct);
  const energyKWh   = (battery * chargeNeeded) / 100;
  const totalCost   = energyKWh * rate;
  const estRange    = energyKWh * EV_PRESETS[activePreset].efficiency;
  const petrolCost  = (estRange / petrolMileage) * petrolPrice;
  const savings     = petrolCost - totalCost;
  const co2Saved    = estRange * CO2_SAVED_PER_KM; // grams

  const saveToHistory = async () => {
    await addDoc(collection(db, "calculations"), {
      userId:      user.uid,
      cost:        totalCost.toFixed(2),
      energy:      energyKWh.toFixed(2),
      range:       Math.round(estRange),
      efficiency:  EV_PRESETS[activePreset].efficiency,
      tariff:      rate,
      tariffLabel: customRate ? "Custom" : TARIFF_PRESETS[tariffIdx].label,
      petrolSaving: savings.toFixed(2),
      co2Saved:    co2Saved.toFixed(0),
      car:         EV_PRESETS[activePreset].name,
      battery,
      fromPct,
      toPct,
      time: new Date(),
    });
    fetchHistory(user.uid);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // PDF export using jsPDF (loaded via CDN in index.html — see setup guide)
  const exportPDF = async () => {
    setExporting(true);
    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const green = [34, 197, 94];
      const W = 210;

      // Header bar
      pdf.setFillColor(...green);
      pdf.rect(0, 0, W, 28, "F");
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(18); pdf.setFont("helvetica", "bold");
      pdf.text("EV PRO", 14, 18);
      pdf.setFontSize(9); pdf.setFont("helvetica", "normal");
      pdf.text("ev-calculator-theta.vercel.app", W - 14, 18, { align: "right" });

      // Title
      pdf.setTextColor(0); pdf.setFontSize(14); pdf.setFont("helvetica", "bold");
      pdf.text("Charging Session Report", 14, 42);
      pdf.setFontSize(9); pdf.setFont("helvetica", "normal"); pdf.setTextColor(100);
      pdf.text(`Generated: ${new Date().toLocaleString("en-IN")}   |   Vehicle: ${EV_PRESETS[activePreset].name}`, 14, 50);

      // Green divider
      pdf.setDrawColor(...green); pdf.setLineWidth(0.5);
      pdf.line(14, 54, W - 14, 54);

      // Metrics grid
      const metrics = [
        ["Charging Cost",    `₹${totalCost.toFixed(2)}`],
        ["Energy Used",      `${energyKWh.toFixed(2)} kWh`],
        ["Estimated Range",  `${Math.round(estRange)} km`],
        ["SoC Delta",        `${fromPct}% → ${toPct}%`],
        ["Tariff Rate",      `₹${rate}/kWh`],
        ["Petrol Equivalent",`₹${petrolCost.toFixed(2)}`],
        ["Money Saved",      `₹${savings.toFixed(2)}`],
        ["CO₂ Saved",        `${co2Saved >= 1000 ? (co2Saved/1000).toFixed(2)+"kg" : co2Saved.toFixed(0)+"g"}`],
      ];
      let y = 64;
      metrics.forEach(([label, val], i) => {
        const x = i % 2 === 0 ? 14 : W / 2 + 5;
        if (i % 2 === 0 && i > 0) y += 22;
        pdf.setFillColor(245, 245, 245);
        pdf.roundedRect(x, y, 88, 18, 3, 3, "F");
        pdf.setFontSize(8); pdf.setFont("helvetica", "normal"); pdf.setTextColor(120);
        pdf.text(label.toUpperCase(), x + 4, y + 7);
        pdf.setFontSize(12); pdf.setFont("helvetica", "bold"); pdf.setTextColor(0);
        pdf.text(val, x + 4, y + 15);
      });
      y += 30;

      // CO2 note
      pdf.setFillColor(240, 253, 244);
      pdf.roundedRect(14, y, W - 28, 14, 3, 3, "F");
      pdf.setFontSize(8); pdf.setFont("helvetica", "italic"); pdf.setTextColor(22, 101, 52);
      pdf.text("CO₂ savings based on IIT Madras (Dec 2025) lifecycle study: EV 33t vs ICE 53.84t CO₂e over 300,000 km", 18, y + 9);

      // Footer
      pdf.setTextColor(160); pdf.setFontSize(8); pdf.setFont("helvetica", "normal");
      pdf.text("EV PRO · India's EV Charging Intelligence Platform · ev-calculator-theta.vercel.app", W / 2, 285, { align: "center" });

      pdf.save(`EVPRO_Session_${Date.now()}.pdf`);
    } catch (e) {
      alert("PDF export failed. Check jsPDF is loaded in index.html (see setup guide).");
    }
    setExporting(false);
  };

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "24px 16px 60px" }}>

      {/* Vehicle presets */}
      <div style={{ display: "flex", gap: 10, overflowX: "auto", marginBottom: 24, paddingBottom: 4 }}>
        {EV_PRESETS.map((ev, i) => (
          <button key={i} onClick={() => { setActivePreset(i); setBattery(ev.battery); }}
            style={{ minWidth: 110, padding: "12px 10px", borderRadius: 18, border: activePreset === i ? "2px solid #22c55e" : `1px solid ${theme.border}`, background: activePreset === i ? "rgba(34,197,94,0.1)" : theme.card, color: theme.text, cursor: "pointer", transition: "0.2s", flexShrink: 0 }}>
            <div style={{ fontSize: "1.5rem" }}>{ev.icon}</div>
            <div style={{ fontWeight: 700, fontSize: "0.8rem", marginTop: 4 }}>{ev.name}</div>
            <div style={{ fontSize: "0.7rem", opacity: 0.5, fontFamily: "'DM Mono',monospace" }}>{ev.battery} kWh</div>
          </button>
        ))}
      </div>

      {/* Main cost card */}
      <div style={{ background: theme.card, borderRadius: 30, padding: "32px 28px", border: `1px solid ${theme.border}`, marginBottom: 20 }}>
        <p style={{ fontSize: "0.7rem", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.12em" }}>Charging Cost</p>
        <h1 style={{ fontSize: "4rem", color: "#22c55e", fontWeight: 900, margin: "8px 0 20px", fontFamily: "'DM Mono',monospace", lineHeight: 1 }}>
          ₹{totalCost.toFixed(2)}
        </h1>

        {/* Tariff selector + custom */}
        <select value={tariffIdx} onChange={e => { setTariffIdx(Number(e.target.value)); setCustomRate(""); }}
          style={{ width: "100%", padding: 12, borderRadius: 12, background: theme.bg, color: theme.text, border: `1px solid ${theme.border}`, marginBottom: 10, fontSize: "0.9rem" }}>
          {TARIFF_PRESETS.map((t, i) => <option key={i} value={i}>{t.label} (₹{t.rate}/kWh)</option>)}
        </select>
        <input type="number" placeholder="Or enter custom rate (₹/kWh)" value={customRate}
          onChange={e => setCustomRate(e.target.value)} min="1" max="50" step="0.5"
          style={{ width: "100%", padding: 12, borderRadius: 12, background: theme.bg, color: theme.text, border: `1px solid ${theme.border}`, marginBottom: 20, fontSize: "0.9rem" }} />

        {/* SoC sliders */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", opacity: 0.6, marginBottom: 6 }}>
            <span>From: <b style={{ color: "#f59e0b" }}>{fromPct}%</b></span>
            <span>To: <b style={{ color: "#22c55e" }}>{toPct}%</b></span>
            <span>Delta: <b>{chargeNeeded}%</b></span>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: "0.75rem", opacity: 0.5 }}>Current charge (from)</label>
            <input type="range" min="0" max="95" value={fromPct}
              onChange={e => { const v = Math.min(Number(e.target.value), toPct - 5); setFromPct(v); }}
              style={{ width: "100%", accentColor: "#f59e0b" }} />
          </div>
          <div>
            <label style={{ fontSize: "0.75rem", opacity: 0.5 }}>Target charge (to)</label>
            <input type="range" min="5" max="100" value={toPct}
              onChange={e => { const v = Math.max(Number(e.target.value), fromPct + 5); setToPct(v); }}
              style={{ width: "100%", accentColor: "#22c55e" }} />
          </div>
        </div>

        {/* Petrol inputs */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: "0.75rem", opacity: 0.5 }}>Petrol ₹/L</label>
            <input type="number" value={petrolPrice} onChange={e => setPetrolPrice(Number(e.target.value))}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 12, background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text, marginTop: 4 }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: "0.75rem", opacity: 0.5 }}>Mileage km/L</label>
            <input type="number" value={petrolMileage} onChange={e => setPetrolMileage(Number(e.target.value))}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 12, background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text, marginTop: 4 }} />
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Energy", val: `${energyKWh.toFixed(2)} kWh`, color: "#3b82f6" },
            { label: "Est. Range", val: `${Math.round(estRange)} km`, color: "#22c55e" },
            { label: "Petrol Cost", val: `₹${petrolCost.toFixed(0)}`, color: "#f59e0b" },
            { label: "You Save", val: `₹${savings.toFixed(0)}`, color: savings >= 0 ? "#22c55e" : "#ef4444" },
            { label: "CO₂ Saved", val: co2Saved >= 1000 ? `${(co2Saved/1000).toFixed(2)} kg` : `${co2Saved.toFixed(0)} g`, color: "#22c55e" },
            { label: "Battery", val: `${battery} kWh`, color: "#888" },
          ].map(({ label, val, color }) => (
            <div key={label} className="stat-chip">
              <div className="stat-chip-label">{label}</div>
              <div className="stat-chip-val" style={{ color }}>{val}</div>
            </div>
          ))}
        </div>

        <button className="btn-primary" onClick={saveToHistory}>
          {saved ? "✅ Saved!" : "⚡ Save Session to History"}
        </button>
      </div>

      {/* Export + Find stations */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button className="btn-outline" style={{ flex: 1 }} onClick={exportPDF} disabled={exporting}>
          {exporting ? "Generating..." : "📄 Export PDF"}
        </button>
        <button className="btn-outline" style={{ flex: 1 }} onClick={() => window.open("https://www.google.com/maps/search/ev+charging+station+near+me", "_blank")}>
          🗺️ Find Stations
        </button>
      </div>

      {/* TCO teaser */}
      <div onClick={() => navigate("/tco")} style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 18, padding: "16px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 700, color: "#22c55e", fontSize: "0.9rem" }}>📊 Total Cost of Ownership</div>
          <div style={{ fontSize: "0.78rem", opacity: 0.6, marginTop: 3 }}>5-year TCO, break-even, ROI analysis →</div>
        </div>
        <span style={{ fontSize: "1.5rem" }}>→</span>
      </div>

      {/* Recent history preview */}
      {history.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: "0.75rem", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Recent Sessions</p>
          {history.slice(0, 3).map(h => (
            <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "12px 16px", marginBottom: 8 }}>
              <span style={{ fontSize: "1.2rem" }}>{EV_PRESETS.find(e => e.name === h.car)?.icon || "⚡"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{h.car}</div>
                <div style={{ fontSize: "0.72rem", opacity: 0.5, fontFamily: "'DM Mono',monospace" }}>{h.fromPct || "?"}% → {h.toPct || "?"}%  ·  {h.range || "?"}km  ·  ₹{h.tariff}/kWh</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "#22c55e", fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>₹{parseFloat(h.cost).toFixed(2)}</div>
                <div style={{ fontSize: "0.7rem", opacity: 0.4 }}>{h.time?.toDate ? h.time.toDate().toLocaleDateString("en-IN") : ""}</div>
              </div>
              <button onClick={() => deleteItem(h.id, user.uid)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "1rem", opacity: 0.6 }}>✕</button>
            </div>
          ))}
          {history.length > 3 && (
            <button className="btn-outline" style={{ width: "100%", marginTop: 6 }} onClick={() => navigate("/analytics")}>
              View all {history.length} sessions →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TCO PAGE ─────────────────────────────────────────────────────────────────

function TCOPage({ theme, dark }) {
  const [evPrice,       setEvPrice]       = useState(1500000);
  const [icePriceInput, setIcePrice]      = useState(800000);
  const [dailyKm,       setDailyKm]       = useState(40);
  const [petrolPriceT,  setPetrolPriceT]  = useState(102);
  const [petrolMileageT,setPetrolMileageT]= useState(15);
  const [elecRate,      setElecRate]      = useState(7.5);
  const [evEfficiency,  setEvEfficiency]  = useState(6.5);
  const [years,         setYears]         = useState(5);
  const [maintenanceSaving, setMaintSave] = useState(15000); // annual

  const annualKm       = dailyKm * 365;
  const annualElec     = (annualKm / evEfficiency) * elecRate;
  const annualPetrol   = (annualKm / petrolMileageT) * petrolPriceT;
  const annualSaving   = annualPetrol - annualElec + maintenanceSaving;
  const evPremium      = evPrice - icePriceInput;
  const breakevenYears = evPremium > 0 ? (evPremium / annualSaving) : 0;
  const roi            = evPremium > 0 ? ((annualSaving / evPremium) * 100) : 0;
  const lifetimeCo2    = annualKm * CO2_SAVED_PER_KM / 1000; // kg/year

  const totalEvCost    = evPrice  + annualElec  * years;
  const totalIceCost   = icePriceInput + annualPetrol * years;
  const totalSaved     = totalIceCost - totalEvCost + maintenanceSaving * years;

  // Chart: year-by-year cumulative cost
  const chartData = Array.from({ length: years }, (_, i) => ({
    year: `Yr ${i + 1}`,
    EV:   Math.round(evPrice  + annualElec  * (i + 1)),
    ICE:  Math.round(icePriceInput + annualPetrol * (i + 1)),
  }));

  const S = (label, val, color="#22c55e") => (
    <div className="stat-chip" key={label}>
      <div className="stat-chip-label">{label}</div>
      <div className="stat-chip-val" style={{ color }}>{val}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 580, margin: "0 auto", padding: "24px 16px 60px" }}>
      <h2 style={{ fontWeight: 800, marginBottom: 4 }}>Total Cost of Ownership</h2>
      <p style={{ opacity: 0.5, fontSize: "0.85rem", marginBottom: 24 }}>Compare 5-year EV vs petrol ownership costs</p>

      {/* Inputs */}
      <div style={{ background: theme.card, borderRadius: 24, padding: "24px 20px", border: `1px solid ${theme.border}`, marginBottom: 20 }}>
        <p style={{ fontSize: "0.7rem", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Vehicle Costs</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          {[
            ["EV Price (₹)", evPrice, setEvPrice],
            ["ICE Car Price (₹)", icePriceInput, setIcePrice],
          ].map(([label, val, set]) => (
            <div key={label}>
              <label style={{ fontSize: "0.75rem", opacity: 0.5 }}>{label}</label>
              <input type="number" value={val} onChange={e => set(Number(e.target.value))}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 12, background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text, marginTop: 4 }} />
            </div>
          ))}
        </div>
        <p style={{ fontSize: "0.7rem", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Usage & Running Costs</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            ["Daily km", dailyKm, setDailyKm],
            ["Petrol ₹/L", petrolPriceT, setPetrolPriceT],
            ["ICE Mileage km/L", petrolMileageT, setPetrolMileageT],
            ["Elec ₹/kWh", elecRate, setElecRate],
            ["EV km/kWh", evEfficiency, setEvEfficiency],
            ["Annual maint. saving ₹", maintenanceSaving, setMaintSave],
          ].map(([label, val, set]) => (
            <div key={label}>
              <label style={{ fontSize: "0.75rem", opacity: 0.5 }}>{label}</label>
              <input type="number" value={val} onChange={e => set(Number(e.target.value))}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 12, background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text, marginTop: 4 }} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: "0.75rem", opacity: 0.5 }}>Analysis period: <b>{years} years</b></label>
          <input type="range" min="1" max="10" value={years} onChange={e => setYears(Number(e.target.value))}
            style={{ width: "100%", marginTop: 6 }} />
        </div>
      </div>

      {/* Results */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {S("EV premium", `₹${Math.abs(evPremium).toLocaleString("en-IN")}`, evPremium > 0 ? "#f59e0b" : "#22c55e")}
        {S("Break-even", breakevenYears > 0 ? `${breakevenYears.toFixed(1)} yrs` : "Already cheaper", breakevenYears < years ? "#22c55e" : "#f59e0b")}
        {S(`${years}yr Total Saved`, `₹${Math.round(totalSaved).toLocaleString("en-IN")}`, totalSaved > 0 ? "#22c55e" : "#ef4444")}
        {S("Annual ROI", `${roi.toFixed(1)}%`, roi > 10 ? "#22c55e" : "#f59e0b")}
        {S("Annual CO₂ saved", `${Math.round(lifetimeCo2)} kg`, "#3b82f6")}
        {S(`${years}yr CO₂ saved`, `${Math.round(lifetimeCo2 * years)} kg`, "#3b82f6")}
      </div>

      {/* Chart */}
      <div style={{ background: theme.card, borderRadius: 20, padding: "20px 16px", border: `1px solid ${theme.border}` }}>
        <p style={{ fontSize: "0.75rem", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Cumulative Cost: EV vs ICE</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="gEV"  x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient>
              <linearGradient id="gICE" x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={dark ? "#1a1a1a" : "#eee"} />
            <XAxis dataKey="year" stroke={dark ? "#555" : "#aaa"} tick={{ fontSize: 11 }} />
            <YAxis stroke={dark ? "#555" : "#aaa"} tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} />
            <Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12 }} formatter={v => `₹${v.toLocaleString("en-IN")}`} />
            <Legend />
            <Area type="monotone" dataKey="EV"  stroke="#22c55e" fill="url(#gEV)"  strokeWidth={2} />
            <Area type="monotone" dataKey="ICE" stroke="#ef4444" fill="url(#gICE)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── ANALYTICS PAGE ───────────────────────────────────────────────────────────

function AnalyticsPage({ history, theme, dark, petrolMileage, petrolPrice, deleteItem, user }) {
  const totalSpent  = history.reduce((s, h) => s + parseFloat(h.cost || 0), 0);
  const totalSaved  = history.reduce((s, h) => s + parseFloat(h.petrolSaving || 0), 0);
  const totalCo2    = history.reduce((s, h) => s + parseFloat(h.co2Saved || 0), 0);
  const totalKm     = history.reduce((s, h) => s + (h.range || 0), 0);

  const chartData = history.slice(0, 10).reverse().map((item, i) => {
    const cost      = parseFloat(item.cost || 0);
    const eff       = item.efficiency || 6.5;
    const tariff    = item.tariff    || 7.5;
    const energyKwh = tariff > 0 ? cost / tariff : 0;
    const range     = item.range || energyKwh * eff;
    const petrolC   = (range / petrolMileage) * petrolPrice;
    return {
      name:   new Date(item.time?.toDate ? item.time.toDate() : item.time).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      EV:     Math.round(cost),
      Petrol: Math.round(petrolC),
      Saved:  Math.round(petrolC - cost),
    };
  });

  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: "24px 16px 60px" }}>
      <h2 style={{ fontWeight: 800, marginBottom: 4 }}>Savings Dashboard</h2>
      <p style={{ opacity: 0.5, fontSize: "0.85rem", marginBottom: 24 }}>{history.length} sessions recorded</p>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <div className="stat-chip"><div className="stat-chip-label">Total spent (EV)</div><div className="stat-chip-val" style={{ color: "#22c55e" }}>₹{totalSpent.toFixed(0)}</div></div>
        <div className="stat-chip"><div className="stat-chip-label">Total saved vs petrol</div><div className="stat-chip-val" style={{ color: "#22c55e" }}>₹{totalSaved.toFixed(0)}</div></div>
        <div className="stat-chip"><div className="stat-chip-label">Total CO₂ saved</div><div className="stat-chip-val" style={{ color: "#3b82f6" }}>{totalCo2 >= 1000 ? `${(totalCo2/1000).toFixed(1)} kg` : `${Math.round(totalCo2)} g`}</div></div>
        <div className="stat-chip"><div className="stat-chip-label">Total km charged for</div><div className="stat-chip-val" style={{ color: "#f59e0b" }}>{totalKm.toLocaleString("en-IN")} km</div></div>
      </div>

      {/* EV vs Petrol chart */}
      {chartData.length > 0 && (
        <div style={{ background: theme.card, padding: "20px 16px", borderRadius: 20, border: `1px solid ${theme.border}`, marginBottom: 20 }}>
          <p style={{ fontSize: "0.75rem", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>EV vs Petrol Cost Per Session</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={dark ? "#1a1a1a" : "#eee"} />
              <XAxis dataKey="name" stroke={dark ? "#555" : "#aaa"} tick={{ fontSize: 10 }} />
              <YAxis stroke={dark ? "#555" : "#aaa"} tick={{ fontSize: 10 }} tickFormatter={v => `₹${v}`} />
              <Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12 }} formatter={v => `₹${v}`} />
              <Legend />
              <Bar dataKey="EV"     fill="#22c55e" radius={[4,4,0,0]} />
              <Bar dataKey="Petrol" fill="#ef4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Savings trend */}
      {chartData.length > 0 && (
        <div style={{ background: theme.card, padding: "20px 16px", borderRadius: 20, border: `1px solid ${theme.border}`, marginBottom: 20 }}>
          <p style={{ fontSize: "0.75rem", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Savings Per Session</p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gSave" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={dark ? "#1a1a1a" : "#eee"} />
              <XAxis dataKey="name" stroke={dark ? "#555" : "#aaa"} tick={{ fontSize: 10 }} />
              <YAxis stroke={dark ? "#555" : "#aaa"} tick={{ fontSize: 10 }} tickFormatter={v => `₹${v}`} />
              <Tooltip contentStyle={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12 }} formatter={v => `₹${v}`} />
              <Area type="monotone" dataKey="Saved" stroke="#22c55e" fill="url(#gSave)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Full history list */}
      <div style={{ marginTop: 8 }}>
        <p style={{ fontSize: "0.75rem", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>All Sessions</p>
        {history.length === 0 && <p style={{ opacity: 0.4, textAlign: "center", padding: "40px 0" }}>No sessions yet. Save a charge from the calculator.</p>}
        {history.map(h => (
          <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "12px 16px", marginBottom: 8 }}>
            <span style={{ fontSize: "1.3rem" }}>{EV_PRESETS.find(e => e.name === h.car)?.icon || "⚡"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{h.car}</div>
              <div style={{ fontSize: "0.72rem", opacity: 0.5, fontFamily: "'DM Mono',monospace" }}>
                {h.energy || "?"}kWh  ·  {h.range || "?"}km  ·  ₹{h.tariff}/kWh  ·  CO₂ {h.co2Saved || "?"}g saved
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "#22c55e", fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>₹{parseFloat(h.cost).toFixed(2)}</div>
              <div style={{ fontSize: "0.7rem", color: "#22c55e", opacity: 0.7 }}>saved ₹{parseFloat(h.petrolSaving || 0).toFixed(0)}</div>
              <div style={{ fontSize: "0.65rem", opacity: 0.35 }}>{h.time?.toDate ? h.time.toDate().toLocaleDateString("en-IN") : ""}</div>
            </div>
            <button onClick={() => deleteItem(h.id, user.uid)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "1rem", opacity: 0.5 }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}