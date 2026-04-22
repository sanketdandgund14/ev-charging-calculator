import { useState, useEffect } from "react";
import { auth, googleProvider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, query, where, getDocs, orderBy, deleteDoc, doc } from "firebase/firestore";

export default function App() {
  const [user, setUser] = useState(null);
  const [battery, setBattery] = useState(60);
  const [history, setHistory] = useState([]);
  const [darkMode, setDarkMode] = useState(true); // Theme State

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
    try {
      await addDoc(collection(db, "calculations"), { userId: user.uid, cost, battery, time: new Date() });
      fetchHistory(user.uid);
    } catch (e) { alert(e.message); }
  };

  const deleteItem = async (id) => {
    await deleteDoc(doc(db, "calculations", id));
    fetchHistory(user.uid);
  };

  const totalCost = (battery * 7.5).toFixed(2);

  // Theme Colors
  const theme = {
    bg: darkMode ? "#050505" : "#f5f5f7",
    card: darkMode ? "linear-gradient(145deg, #111, #080808)" : "#ffffff",
    text: darkMode ? "#fff" : "#1d1d1f",
    subText: darkMode ? "#666" : "#86868b",
    border: darkMode ? "#222" : "#d2d2d7"
  };

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, transition: "0.3s all", fontFamily: "sans-serif", padding: "40px 20px" }}>
      <div style={{ maxWidth: "450px", margin: "0 auto" }}>
        
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "60px" }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: "800", letterSpacing: "-1px" }}>
            ⚡ EV<span style={{ color: "#22c55e" }}>PRO</span>
          </h2>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button onClick={() => setDarkMode(!darkMode)} style={{ background: "transparent", border: "none", fontSize: "1.2rem", cursor: "pointer" }}>
              {darkMode ? "☀️" : "🌙"}
            </button>
            {user ? (
              <button onClick={() => signOut(auth)} style={{ background: "rgba(128,128,128,0.1)", border: "none", color: theme.subText, padding: "8px 15px", borderRadius: "20px", cursor: "pointer" }}>Logout</button>
            ) : (
              <button onClick={() => signInWithPopup(auth, googleProvider)} style={{ background: "#22c55e", color: "#fff", border: "none", padding: "8px 20px", borderRadius: "20px", fontWeight: "bold", cursor: "pointer" }}>Login</button>
            )}
          </div>
        </div>

        {/* MAIN CONTENT (Conditional) */}
        {!user ? (
          <div style={{ textAlign: "center", marginTop: "100px" }}>
            <h1 style={{ fontSize: "2rem", marginBottom: "15px" }}>Welcome to EV PRO</h1>
            <p style={{ color: theme.subText, lineHeight: "1.6" }}>Log in to calculate your charging costs and track your history across all your devices.</p>
          </div>
        ) : (
          <>
            {/* CALCULATOR CARD */}
            <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "28px", padding: "35px", textAlign: "center", boxShadow: darkMode ? "none" : "0 10px 30px rgba(0,0,0,0.05)", marginBottom: "40px" }}>
              <p style={{ color: theme.subText, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px" }}>Estimated Cost</p>
              <h1 style={{ fontSize: "3.5rem", margin: "10px 0", color: "#22c55e", fontWeight: "800" }}>₹{totalCost}</h1>
              <div style={{ margin: "30px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: theme.subText, marginBottom: "10px" }}>
                  <span>Battery</span><span>{battery} kWh</span>
                </div>
                <input type="range" min="1" max="120" value={battery} onChange={(e) => setBattery(e.target.value)} style={{ width: "100%", accentColor: "#22c55e" }} />
              </div>
              <button onClick={() => saveToHistory(totalCost)} style={{ width: "100%", background: "#22c55e", color: "#fff", border: "none", padding: "16px", borderRadius: "16px", fontWeight: "bold", cursor: "pointer" }}>Save Calculation</button>
            </div>

            {/* HISTORY */}
            {history.length > 0 && (
              <div>
                <h3 style={{ marginBottom: "20px", color: theme.subText }}>Recent Activity</h3>
                {history.map((item) => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: darkMode ? "#111" : "#fff", padding: "15px", borderRadius: "18px", marginBottom: "12px", border: `1px solid ${theme.border}` }}>
                    <div>
                      <div style={{ fontWeight: "bold" }}>₹{item.cost}</div>
                      <div style={{ fontSize: "0.7rem", color: theme.subText }}>{item.battery} kWh • {item.time?.toDate().toLocaleDateString('en-IN')}</div>
                    </div>
                    <button onClick={() => deleteItem(item.id)} style={{ background: "transparent", border: "none", color: "#ff4444", fontSize: "1.2rem", cursor: "pointer" }}>×</button>
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