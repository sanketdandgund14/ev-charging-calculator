import { useState, useEffect } from "react";
import { auth, googleProvider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, query, where, getDocs, orderBy, deleteDoc, doc } from "firebase/firestore";

// --- PRESETS FROM YOUR ORIGINAL CODE ---
const EV_PRESETS = [
  { name: "Nexon EV", battery: 40.5, icon: "🚗", efficiency: 6.5, link: "https://www.tatamotors.com/cars/nexon-ev/" },
  { name: "MG ZS EV", battery: 50.3, icon: "🚙", efficiency: 6.2, link: "https://www.mgmotor.co.in/vehicles/mg-zs-ev" },
  { name: "Ioniq 5", battery: 72.6, icon: "⚡", efficiency: 6.8, link: "https://www.hyundai.com/in/en/find-a-car/ioniq5/highlights" },
  { name: "BMW iX", battery: 111.5, icon: "🏎", efficiency: 5.9, link: "https://www.bmw.in/en/all-models/bmw-ix/bmw-ix.html" },
  { name: "Ola S1", battery: 3.97, icon: "🛵", efficiency: 55, link: "https://www.olaelectric.com/s1-pro" },
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
      <div style={{ color: dark ? "#666" : "#8e8e93", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{title}</div>
      <div style={{ color: dark ? "#fff" : "#1c1c1e", fontSize: 16, fontWeight: 700 }}>{value}</div>
      <div style={{ color: dark ? "#444" : "#aeaeae", fontSize: 10, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

export default function App() {
  // Authentication & History State
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [dark, setDark] = useState(true);

  // Original Calculator State
  const [battery, setBattery] = useState(40.5);
  const [fromPct, setFromPct] = useState(20);
  const [toPct, setToPct] = useState(100);
  const [tariffIdx, setTariffIdx] = useState(1);
  const [customRate, setCustomRate] = useState(7.5);
  const [activePreset, setActivePreset] = useState(0);
  const [chargesPerDay, setChargesPerDay] = useState(1);
  const [petrolMileage, setPetrolMileage] = useState(15);
  const [petrolPrice, setPetrolPrice] = useState(102);

  // AI State
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

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
        car: activePreset !== null ? EV_PRESETS[activePreset].name : "Custom",
        time: new Date()
      });
      fetchHistory(user.uid);
    } catch (e) { alert(e.message); }
  };

  const deleteItem = async (id) => {
    await deleteDoc(doc(db, "calculations", id));
    fetchHistory(user.uid);
  };

  // --- CALCULATIONS LOGIC ---
  const rate = TARIFF_PRESETS[tariffIdx].rate ?? customRate;
  const chargePct = Math.max(0, toPct - fromPct);
  const energyKWh = (battery * chargePct) / 100;
  const totalCost = (energyKWh * rate).toFixed(2);
  const efficiency = activePreset !== null ? EV_PRESETS[activePreset].efficiency : 6.5;
  const estRange = energyKWh * efficiency;
  const costPerKm = estRange > 0 ? (energyKWh * rate) / estRange : 0;
  const monthlyCost = totalCost * chargesPerDay * 30;
  const petrolMonthly = (petrolPrice / petrolMileage) * estRange * chargesPerDay * 30;
  const monthlySavings = petrolMonthly - monthlyCost;
  const co2Saved = ((energyKWh * 0.82) - (energyKWh * 0.08)).toFixed(2);

  function selectPreset(idx) {
    setActivePreset(idx);
    setBattery(EV_PRESETS[idx].battery);
  }

  // --- UI THEME COLORS ---
  const theme = {
    bg: dark ? "#050505" : "#f5f5f7",
    card: dark ? "#111" : "#ffffff",
    text: dark ? "#fff" : "#1d1d1f",
    sub: dark ? "#666" : "#86868b",
    border: dark ? "#222" : "#d2d2d7"
  };

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: "sans-serif", padding: "20px", transition: "0.3s" }}>
      <div style={{ maxWidth: "500px", margin: "0 auto" }}>
        
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
          <h2 style={{ fontWeight: "800", letterSpacing: "-1px" }}>⚡ EV<span style={{ color: "#22c55e" }}>PRO</span></h2>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => setDark(!dark)} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }}>{dark ? "☀️" : "🌙"}</button>
            {user ? (
              <button onClick={() => signOut(auth)} style={{ background: theme.border, border: "none", color: theme.text, padding: "8px 15px", borderRadius: "20px", fontSize: "0.8rem" }}>Logout</button>
            ) : (
              <button onClick={() => signInWithPopup(auth, googleProvider)} style={{ background: "#22c55e", color: "#fff", border: "none", padding: "8px 20px", borderRadius: "20px", fontWeight: "bold" }}>Login</button>
            )}
          </div>
        </div>

        {!user ? (
          <div style={{ textAlign: "center", marginTop: "100px" }}>
            <h1 style={{ fontSize: "2.5rem", fontWeight: "800" }}>Smart EV Tracking</h1>
            <p style={{ color: theme.sub, fontSize: "1.1rem" }}>Login to access vehicle presets, savings calculators, and your charging history.</p>
          </div>
        ) : (
          <>
            {/* VEHICLE PRESETS */}
            <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "20px", scrollbarWidth: "none" }}>
              {EV_PRESETS.map((ev, i) => (
                <button key={i} onClick={() => selectPreset(i)} style={{ 
                  minWidth: "100px", padding: "15px", borderRadius: "20px", border: activePreset === i ? "2px solid #22c55e" : `1px solid ${theme.border}`,
                  background: activePreset === i ? "rgba(34,197,94,0.1)" : theme.card, color: theme.text, cursor: "pointer"
                }}>
                  <div style={{ fontSize: "1.5rem" }}>{ev.icon}</div>
                  <div style={{ fontSize: "0.7rem", fontWeight: "bold", marginTop: "5px" }}>{ev.name}</div>
                </button>
              ))}
            </div>

            {/* MAIN CALCULATOR CARD */}
            <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "28px", padding: "30px", textAlign: "center", marginBottom: "20px" }}>
              <p style={{ color: theme.sub, fontSize: "0.8rem", letterSpacing: "1px" }}>ESTIMATED COST</p>
              <h1 style={{ fontSize: "4rem", margin: "10px 0", color: "#22c55e", fontWeight: "900" }}>₹{totalCost}</h1>
              
              <div style={{ textAlign: "left", marginBottom: "20px" }}>
                <label style={{ fontSize: "0.8rem", color: theme.sub }}>Battery Size: {battery} kWh</label>
                <input type="range" min="1" max="120" value={battery} onChange={e => {setBattery(e.target.value); setActivePreset(null);}} style={{ width: "100%", accentColor: "#22c55e" }} />
              </div>

              <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "0.8rem", color: theme.sub }}>From %</label>
                  <input type="number" value={fromPct} onChange={e => setFromPct(e.target.value)} style={{ width: "100%", background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text, padding: "10px", borderRadius: "10px" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "0.8rem", color: theme.sub }}>To %</label>
                  <input type="number" value={toPct} onChange={e => setToPct(e.target.value)} style={{ width: "100%", background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text, padding: "10px", borderRadius: "10px" }} />
                </div>
              </div>

              <select value={tariffIdx} onChange={e => setTariffIdx(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "12px", background: theme.bg, color: theme.text, border: `1px solid ${theme.border}`, marginBottom: "20px" }}>
                {TARIFF_PRESETS.map((t, i) => <option key={i} value={i}>{t.label} (₹{t.rate || customRate})</option>)}
              </select>

              <button onClick={() => saveToHistory(totalCost)} style={{ width: "100%", background: "#22c55e", color: "#fff", border: "none", padding: "18px", borderRadius: "18px", fontWeight: "bold", fontSize: "1.1rem" }}>
                Save Calculation
              </button>
            </div>

            {/* STATS GRID */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              <StatCard dark={dark} icon="📍" title="Range" value={`${estRange.toFixed(0)} km`} sub="Est. distance" />
              <StatCard dark={dark} icon="💰" title="Per KM" value={`₹${costPerKm.toFixed(2)}`} sub="EV Economy" />
              <StatCard dark={dark} icon="🌱" title="CO2" value={`${co2Saved} kg`} sub="Saved vs Petrol" />
            </div>

            {/* SAVINGS PANEL */}
            <div style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "20px", padding: "20px", marginBottom: "20px" }}>
              <h4 style={{ margin: "0 0 10px 0", color: "#22c55e" }}>⛽ Monthly Petrol Savings</h4>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: "1.5rem", fontWeight: "bold" }}>₹{monthlySavings.toFixed(0)}</span>
                <span style={{ color: theme.sub, fontSize: "0.8rem" }}>Saved every month</span>
              </div>
            </div>

            {/* HISTORY */}
            {history.length > 0 && (
              <div style={{ marginTop: "40px" }}>
                <h3 style={{ fontSize: "1.1rem", marginBottom: "15px" }}>Recent History</h3>
                {history.map((item) => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", background: theme.card, padding: "15px", borderRadius: "15px", marginBottom: "10px", border: `1px solid ${theme.border}` }}>
                    <div>
                      <div style={{ fontWeight: "bold" }}>₹{item.cost}</div>
                      <div style={{ fontSize: "0.7rem", color: theme.sub }}>{item.car} • {item.battery}kWh • {item.time?.toDate().toLocaleDateString()}</div>
                    </div>
                    <button onClick={() => deleteItem(item.id)} style={{ background: "none", border: "none", color: "#ff4444", fontSize: "1.2rem", cursor: "pointer" }}>×</button>
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