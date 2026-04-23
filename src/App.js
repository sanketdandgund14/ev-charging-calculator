import React, { useState, useEffect } from "react";
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
  { label: "Home - Standard", rate: 7.5 },
  { label: "BESCOM EV Tariff", rate: 6.0 },
  { label: "Public DC Fast", rate: 22.0 },
];

function StatCard({ icon, title, value, sub, dark }) {
  return (
    <div style={{ flex: 1, background: dark ? "rgba(255,255,255,0.03)" : "#fff", borderRadius: 16, padding: "15px", border: dark ? "1px solid #222" : "1px solid #e5e7eb", textAlign: "center" }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div style={{ color: dark ? "#666" : "#8e8e93", fontSize: 10, textTransform: "uppercase", fontWeight: "bold" }}>{title}</div>
      <div style={{ color: dark ? "#fff" : "#1c1c1e", fontSize: 16, fontWeight: 800 }}>{value}</div>
      {sub && <div style={{ color: "#4ade80", fontSize: 9, marginTop: 2 }}>{sub}</div>}
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
  const [tariffIdx, setTariffIdx] = useState(0);
  const [activePreset, setActivePreset] = useState(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false); // Safety Feature State

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) fetchHistory(currentUser.uid);
    });
    return () => unsubscribe();
  }, []);

  const fetchHistory = async (uid) => {
    if (!db) return;
    try {
      const q = query(collection(db, "calculations"), where("userId", "==", uid), orderBy("time", "desc"));
      const snapshot = await getDocs(q);
      setHistory(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error("History fetch error", e); }
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
    try {
      await deleteDoc(doc(db, "calculations", id));
      fetchHistory(user.uid);
    } catch (e) { console.error(e); }
  };

  const handleLogout = () => {
    signOut(auth);
    setShowLogoutConfirm(false);
  };

  const rate = TARIFF_PRESETS[tariffIdx].rate;
  const chargeNeeded = Math.max(0, toPct - fromPct);
  const energyKWh = (battery * chargeNeeded) / 100;
  const totalCost = (energyKWh * rate).toFixed(2);
  
  const efficiency = EV_PRESETS[activePreset]?.efficiency || 6.5;
  const estRange = (energyKWh * efficiency).toFixed(0);
  const co2Saved = (energyKWh * 0.74).toFixed(1);
  const petrolCostEquivalent = (estRange / 15) * 102;
  const savings = (petrolCostEquivalent - totalCost).toFixed(0);

  const theme = {
    bg: dark ? "#050505" : "#f5f5f7",
    card: dark ? "#111" : "#ffffff",
    text: dark ? "#fff" : "#1d1d1f",
    border: dark ? "#222" : "#d2d2d7"
  };

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: "sans-serif", padding: "20px", transition: "0.3s" }}>
      <div style={{ maxWidth: "500px", margin: "0 auto" }}>
        
        {/* LOGOUT OVERLAY (Safety confirmation) */}
        {showLogoutConfirm && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
            <div style={{ background: theme.card, padding: "30px", borderRadius: "24px", border: `1px solid ${theme.border}`, textAlign: "center", maxWidth: "320px", width: "100%" }}>
              <h3 style={{ margin: "0 0 10px 0" }}>Logout?</h3>
              <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "20px" }}>Are you sure you want to end your session?</p>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => setShowLogoutConfirm(false)} style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "none", background: "#333", color: "#fff", cursor: "pointer" }}>Cancel</button>
                <button onClick={handleLogout} style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "none", background: "#ff4444", color: "#fff", fontWeight: "bold", cursor: "pointer" }}>Yes, Logout</button>
              </div>
            </div>
          </div>
        )}

        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
          <h2 style={{ fontWeight: "900", letterSpacing: "-1px" }}>⚡ EV<span style={{ color: "#22c55e" }}>PRO</span></h2>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button onClick={() => setDark(!dark)} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }}>{dark ? "☀️" : "🌙"}</button>
            {user ? (
              <button onClick={() => setShowLogoutConfirm(true)} style={{ background: "#333", color: "#fff", border: "none", padding: "8px 15px", borderRadius: "20px", fontSize: "0.8rem", cursor: "pointer" }}>Logout</button>
            ) : (
              <button onClick={() => signInWithPopup(auth, googleProvider)} style={{ background: "#22c55e", color: "#fff", border: "none", padding: "8px 20px", borderRadius: "20px", fontWeight: "bold", cursor: "pointer" }}>Login</button>
            )}
          </div>
        </div>

        {!user ? (
          <div style={{ textAlign: "center", marginTop: "100px" }}>
            <div style={{ fontSize: "4rem", marginBottom: "20px" }}>🔌</div>
            <h1>Smart EV Tracking</h1>
            <p style={{ color: "#666" }}>Login to calculate costs and compare petrol savings.</p>
          </div>
        ) : (
          <>
            {/* CAR SELECTOR */}
            <div style={{ display: "flex", gap: "10px", overflowX: "auto", marginBottom: "20px", paddingBottom: "10px" }}>
              {EV_PRESETS.map((ev, i) => (
                <button key={i} onClick={() => {setActivePreset(i); setBattery(ev.battery);}} style={{ 
                  minWidth: "110px", padding: "12px", borderRadius: "18px", border: activePreset === i ? "2px solid #22c55e" : `1px solid ${theme.border}`,
                  background: theme.card, color: theme.text, cursor: "pointer"
                }}>
                  <div style={{ fontSize: "1.4rem" }}>{ev.icon}</div>
                  <div style={{ fontSize: "0.7rem", fontWeight: "bold", marginTop: "4px" }}>{ev.name}</div>
                </button>
              ))}
            </div>

            {/* MAIN CALCULATOR */}
            <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "30px", padding: "35px", textAlign: "center", marginBottom: "20px" }}>
              <p style={{ color: "#666", fontSize: "0.75rem", fontWeight: "bold", letterSpacing: "1px" }}>ESTIMATED CHARGING COST</p>
              <h1 style={{ fontSize: "4.5rem", margin: "10px 0", color: "#22c55e", fontWeight: "900" }}>₹{totalCost}</h1>
              
              <div style={{ margin: "25px 0", textAlign: "left" }}>
                <label style={{ fontSize: "0.8rem", color: "#666" }}>Battery Capacity: {battery} kWh</label>
                <input type="range" min="1" max="120" value={battery} onChange={e => {setBattery(e.target.value); setActivePreset(null);}} style={{ width: "100%", accentColor: "#22c55e", cursor: "pointer" }} />
                
                <div style={{ display: "flex", gap: "15px", marginTop: "15px" }}>
                   <div style={{ flex: 1 }}>
                      <label style={{ fontSize: "0.7rem", color: "#666" }}>From {fromPct}%</label>
                      <input type="range" min="0" max="99" value={fromPct} onChange={e => setFromPct(e.target.value)} style={{ width: "100%", accentColor: "#4ade80" }} />
                   </div>
                   <div style={{ flex: 1 }}>
                      <label style={{ fontSize: "0.7rem", color: "#666" }}>To {toPct}%</label>
                      <input type="range" min="1" max="100" value={toPct} onChange={e => setToPct(e.target.value)} style={{ width: "100%", accentColor: "#22c55e" }} />
                   </div>
                </div>
              </div>

              <select value={tariffIdx} onChange={e => setTariffIdx(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "12px", background: theme.bg, color: theme.text, border: `1px solid ${theme.border}`, marginBottom: "20px" }}>
                {TARIFF_PRESETS.map((t, i) => <option key={i} value={i}>{t.label} (₹{t.rate}/unit)</option>)}
              </select>

              <button onClick={() => saveToHistory(totalCost)} style={{ width: "100%", background: "#22c55e", color: "#fff", padding: "18px", borderRadius: "18px", border: "none", fontWeight: "bold", fontSize: "1.1rem", cursor: "pointer" }}>
                Save Session
              </button>
            </div>

            {/* QUICK STATS */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
               <StatCard dark={dark} icon="📍" title="Range" value={`${estRange} km`} sub={`+${chargeNeeded}% charge`} />
               <StatCard dark={dark} icon="⛽" title="Saved" value={`₹${savings}`} sub="vs Petrol" />
               <StatCard dark={dark} icon="🌱" title="CO2" value={`${co2Saved}kg`} sub="Environment" />
            </div>

            <button onClick={() => window.open("https://www.google.com/maps/search/ev+charging+station+near+me", "_blank")} style={{ width: "100%", padding: "15px", borderRadius: "15px", border: "1px solid #22c55e", color: "#22c55e", background: "transparent", fontWeight: "bold", marginBottom: "30px", cursor: "pointer" }}>
              🗺️ Find Charging Stations Near Me
            </button>

            {/* HISTORY */}
            {history.length > 0 && (
              <div style={{ marginTop: "20px" }}>
                <h4 style={{ marginBottom: "15px", opacity: 0.6 }}>Recent Activity</h4>
                {history.map(item => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px", background: theme.card, border: `1px solid ${theme.border}`, marginBottom: "10px", borderRadius: "16px" }}>
                    <div>
                      <div style={{ fontWeight: "800", fontSize: "1.1rem" }}>₹{item.cost}</div>
                      <div style={{ fontSize: "0.7rem", color: "#666" }}>{item.car} • {item.battery}kWh • {item.time?.toDate().toLocaleDateString('en-IN')}</div>
                    </div>
                    <button onClick={() => deleteItem(item.id)} style={{ color: "#ff4444", border: "none", background: "none", fontSize: "1.3rem", cursor: "pointer" }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}