import { useState, useEffect } from "react";
import { auth, googleProvider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, query, where, getDocs, orderBy, deleteDoc, doc } from "firebase/firestore";

export default function App() {
  const [user, setUser] = useState(null);
  const [battery, setBattery] = useState(60);
  const [history, setHistory] = useState([]);

  // 1. Sync with Google Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) fetchHistory(currentUser.uid);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch History from Mumbai (with ID for deleting)
  const fetchHistory = async (uid) => {
    try {
      const q = query(
        collection(db, "calculations"), 
        where("userId", "==", uid), 
        orderBy("time", "desc")
      );
      const snapshot = await getDocs(q);
      setHistory(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Fetch error:", e.message);
    }
  };

  // 3. Save a new calculation
  const saveToHistory = async (cost) => {
    if (!user) return alert("Please login to save your history!");
    try {
      await addDoc(collection(db, "calculations"), {
        userId: user.uid,
        cost: cost,
        battery: battery,
        time: new Date()
      });
      fetchHistory(user.uid);
    } catch (e) {
      alert("Error saving: " + e.message);
    }
  };

  // 4. Delete a specific calculation
  const deleteItem = async (id) => {
    try {
      await deleteDoc(doc(db, "calculations", id));
      fetchHistory(user.uid);
    } catch (e) {
      alert("Error deleting: " + e.message);
    }
  };

  const totalCost = (battery * 7.5).toFixed(2);

  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "'Segoe UI', Roboto, sans-serif", padding: "40px 20px" }}>
      <div style={{ maxWidth: "450px", margin: "0 auto" }}>
        
        {/* HEADER SECTION */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: "800", margin: 0, letterSpacing: "-1px" }}>
            ⚡ EV<span style={{ color: "#22c55e" }}>PRO</span>
          </h2>
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <img src={user.photoURL} style={{ width: "32px", height: "32px", borderRadius: "50%", border: "2px solid #22c55e" }} alt="user" />
              <button onClick={() => signOut(auth)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #333", color: "#eee", padding: "6px 14px", borderRadius: "20px", cursor: "pointer", fontSize: "0.8rem" }}>Logout</button>
            </div>
          ) : (
            <button onClick={() => signInWithPopup(auth, googleProvider)} style={{ background: "#fff", color: "#000", border: "none", padding: "8px 18px", borderRadius: "20px", fontWeight: "bold", cursor: "pointer" }}>Login</button>
          )}
        </div>

        {/* CALCULATOR CARD */}
        <div style={{ background: "linear-gradient(145deg, #111, #080808)", border: "1px solid #222", borderRadius: "28px", padding: "35px", textAlign: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.4)", marginBottom: "40px" }}>
          <p style={{ color: "#666", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "5px" }}>Estimated Cost</p>
          <h1 style={{ fontSize: "3.5rem", margin: "0 0 25px 0", color: "#22c55e", fontWeight: "800" }}>₹{totalCost}</h1>
          
          <div style={{ marginBottom: "35px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.95rem", color: "#aaa", marginBottom: "12px" }}>
              <span>Battery Capacity</span>
              <span style={{ color: "#fff", fontWeight: "bold" }}>{battery} kWh</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="120" 
              value={battery} 
              onChange={(e) => setBattery(e.target.value)} 
              style={{ width: "100%", accentColor: "#22c55e", height: "6px", cursor: "pointer" }} 
            />
          </div>

          <button 
            onClick={() => saveToHistory(totalCost)} 
            style={{ width: "100%", background: "#22c55e", color: "#000", border: "none", padding: "16px", borderRadius: "16px", fontWeight: "bold", fontSize: "1.1rem", cursor: "pointer", boxShadow: "0 10px 20px rgba(34, 197, 94, 0.2)" }}
          >
            Save Calculation
          </button>
        </div>

        {/* HISTORY SECTION */}
        {user && (
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#fff", marginBottom: "20px", paddingLeft: "5px" }}>Recent Activity</h3>
            {history.length > 0 ? (
              history.map((item) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#111", padding: "18px", borderRadius: "18px", marginBottom: "12px", border: "1px solid #1a1a1a" }}>
                  <div>
                    <div style={{ fontWeight: "800", fontSize: "1.2rem", color: "#fff" }}>₹{item.cost}</div>
                    <div style={{ fontSize: "0.8rem", color: "#555", marginTop: "4px" }}>
                      {item.battery} kWh • {item.time?.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteItem(item.id)} 
                    style={{ background: "rgba(255, 68, 68, 0.1)", border: "none", color: "#ff4444", width: "35px", height: "35px", borderRadius: "50%", cursor: "pointer", fontSize: "1.2rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    ×
                  </button>
                </div>
              ))
            ) : (
              <p style={{ color: "#444", textAlign: "center", marginTop: "20px" }}>No history yet. Save your first cost!</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}