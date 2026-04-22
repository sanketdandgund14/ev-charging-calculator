import { useState, useEffect } from "react";
import { auth, googleProvider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, query, where, getDocs, orderBy, deleteDoc, doc } from "firebase/firestore";

export default function App() {
  const [user, setUser] = useState(null);
  const [battery, setBattery] = useState(60);
  const [history, setHistory] = useState([]);
  const [darkMode, setDarkMode] = useState(true);

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

  // Dynamic Theme Colors
  const theme = {
    bg: darkMode ? "#050505" : "#f0f2f5",
    card: darkMode ? "linear-gradient(145deg, #111, #080808)" : "#ffffff",
    text: darkMode ? "#ffffff" : "#1c1c1e",
    subText: darkMode ? "#666" : "#8e8e93",
    border: darkMode ? "#222" : "#d1d1d6"
  };

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, transition: "0.3s all", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", padding: "40px 20px" }}>
      <div style={{ maxWidth: "450px", margin: "0 auto" }}>
        
        {/* HEADER AREA */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "60px" }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: "800", letterSpacing: "-1px", margin: 0 }}>
            ⚡ EV<span style={{ color: "#22c55e" }}>PRO</span>
          </h2>
          <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
            <button onClick={() => setDarkMode(!darkMode)} style={{ background: "transparent", border: "none", fontSize: "1.3rem", cursor: "pointer" }}>
              {darkMode ? "☀️" : "🌙"}
            </button>
            {user ? (
              <button onClick={() => signOut(auth)} style={{ background: "rgba(150,150,150,0.1)", border: "none", color: theme.subText, padding: "8px 16px", borderRadius: "20px", cursor: "pointer", fontWeight: "600" }}>Logout</button>
            ) : (
              <button onClick={() => signInWithPopup(auth, googleProvider)} style={{ background: "#22c55e", color: "#fff", border: "none", padding: "10px 22px", borderRadius: "25px", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 12px rgba(34, 197, 94, 0.3)" }}>Login</button>
            )}
          </div>
        </div>

        {/* --- THE GATEKEEPER LOGIC --- */}
        {!user ? (
          /* SHOW THIS ONLY IF NOT LOGGED IN */
          <div style={{ textAlign: "center", marginTop: "80px", padding: "0 20px" }}>
            <div style={{ fontSize: "4rem", marginBottom: "20px" }}>🔋</div>
            <h1 style={{ fontSize: "2.2rem", fontWeight: "800", marginBottom: "15px" }}>Smart EV Tracking</h1>
            <p style={{ color: theme.subText, fontSize: "1.1rem", lineHeight: "1.6", marginBottom: "30px" }}>
              Calculate charging costs and keep a secure history of all your sessions in one place.
            </p>
          </div>
        ) : (
          /* SHOW THIS ONLY IF LOGGED IN */
          <>
            <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "28px", padding: "35px", textAlign: "center", boxShadow: darkMode ? "0 20px 40px rgba(0,0,0,0.4)" : "0 10px 30px rgba(0,0,0,0.05)", marginBottom: "40px" }}>
              <p style={{ color: theme.subText, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: "600" }}>Estimated Cost</p>
              <h1 style={{ fontSize: "3.8rem", margin: "10px 0", color: "#22c55e", fontWeight: "800" }}>₹{totalCost}</h1>
              
              <div style={{ margin: "35px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: theme.subText, marginBottom: "12px", fontSize: "0.95rem" }}>
                  <span>Battery Capacity</span>
                  <span style={{ color: theme.text, fontWeight: "bold" }}>{battery} kWh</span>
                </div>
                <input type="range" min="1" max="120" value={battery} onChange={(e) => setBattery(e.target.value)} style={{ width: "100%", accentColor: "#22c55e", cursor: "pointer" }} />
              </div>

              <button onClick={() => saveToHistory(totalCost)} style={{ width: "100%", background: "#22c55e", color: "#fff", border: "none", padding: "18px", borderRadius: "18px", fontWeight: "800", fontSize: "1.1rem", cursor: "pointer", boxShadow: "0 8px 20px rgba(34, 197, 94, 0.2)" }}>
                Save to History
              </button>
            </div>

            {history.length > 0 && (
              <div>
                <h3 style={{ marginBottom: "20px", fontSize: "1.1rem", color: theme.subText, paddingLeft: "5px" }}>Recent Activity</h3>
                {history.map((item) => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: darkMode ? "rgba(255,255,255,0.03)" : "#fff", padding: "18px", borderRadius: "20px", marginBottom: "12px", border: `1px solid ${theme.border}` }}>
                    <div>
                      <div style={{ fontWeight: "800", fontSize: "1.2rem" }}>₹{item.cost}</div>
                      <div style={{ fontSize: "0.8rem", color: theme.subText, marginTop: "4px" }}>
                        {item.battery} kWh • {item.time?.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                    <button onClick={() => deleteItem(item.id)} style={{ background: "rgba(255,68,68,0.1)", border: "none", color: "#ff4444", width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer", fontSize: "1.2rem", fontWeight: "bold" }}>×</button>
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