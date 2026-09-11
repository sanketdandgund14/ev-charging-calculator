import React, { useState, useRef, useEffect } from "react";
import { runTool } from "./agentTools";

// ─── THE AGENT LOOP ─────────────────────────────────────────────────────────
// 1. Send full message history to /api/agent
// 2. If Claude's reply contains a tool_use block, run that tool LOCALLY
// 3. Append the tool_result, call /api/agent again
// 4. Repeat until Claude replies with plain text (stop_reason !== "tool_use")
async function runAgentTurn(messages, setMessages) {
  let currentMessages = messages;
  let guard = 0; // safety net against infinite loops

  while (guard < 6) {
    guard++;
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: currentMessages }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Agent error");
    }

    // Add Claude's turn (may contain text + tool_use blocks) to history
    currentMessages = [...currentMessages, { role: "assistant", content: data.content }];
    setMessages(currentMessages);

    if (data.stop_reason !== "tool_use") {
      return; // done — final text answer already in history
    }

    // Execute every tool_use block the model asked for
    const toolResults = [];
    for (const block of data.content) {
      if (block.type === "tool_use") {
        let result;
        try {
          result = runTool(block.name, block.input);
        } catch (e) {
          result = { error: e.message };
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
    }

    // Feed results back as a user turn, loop again
    currentMessages = [...currentMessages, { role: "user", content: toolResults }];
    setMessages(currentMessages);
  }
}

function extractText(content) {
  if (typeof content === "string") return content;
  return content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

export default function ChatAgent({ theme }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    try {
      await runAgentTurn(next, setMessages);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${e.message}` }]);
    }
    setBusy(false);
  };

  // Only render user/assistant turns that have visible text (hide raw tool turns)
  const visible = messages
    .map((m) => ({ role: m.role, text: extractText(m.content) }))
    .filter((m) => m.text && m.text.trim().length > 0);

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 500,
          width: 56, height: 56, borderRadius: "50%", border: "none",
          background: "#22c55e", color: "#000", fontSize: "1.4rem",
          cursor: "pointer", boxShadow: "0 4px 20px rgba(34,197,94,0.4)",
        }}
        aria-label="Open EV assistant"
      >
        {open ? "✕" : "⚡"}
      </button>

      {open && (
        <div style={{
          position: "fixed", bottom: 92, right: 24, zIndex: 500,
          width: 340, maxWidth: "90vw", height: 460, maxHeight: "70vh",
          background: theme?.card || "#111", border: `1px solid ${theme?.border || "#222"}`,
          borderRadius: 20, display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
        }}>
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${theme?.border || "#222"}`, fontWeight: 800, color: "#22c55e", fontSize: "0.9rem" }}>
            ⚡ EV PRO Assistant
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {visible.length === 0 && (
              <p style={{ opacity: 0.5, fontSize: "0.8rem" }}>
                Ask me anything — e.g. "How much to charge my Ioniq 5 from 20% to 80% on the public DC fast tariff?"
              </p>
            )}
            {visible.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                background: m.role === "user" ? "#22c55e" : (theme?.bg || "#050505"),
                color: m.role === "user" ? "#000" : (theme?.text || "#fff"),
                border: m.role === "user" ? "none" : `1px solid ${theme?.border || "#222"}`,
                borderRadius: 14, padding: "8px 12px", fontSize: "0.85rem", maxWidth: "85%",
                whiteSpace: "pre-wrap",
              }}>
                {m.text}
              </div>
            ))}
            {busy && <div style={{ opacity: 0.5, fontSize: "0.8rem" }}>thinking…</div>}
          </div>

          <div style={{ display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${theme?.border || "#222"}` }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask about cost, TCO, cars…"
              style={{ flex: 1, padding: "10px 12px", borderRadius: 12, background: theme?.bg || "#050505", border: `1px solid ${theme?.border || "#222"}`, color: theme?.text || "#fff", fontSize: "0.85rem" }}
            />
            <button onClick={send} disabled={busy} style={{ background: "#22c55e", color: "#000", border: "none", borderRadius: 12, padding: "0 16px", fontWeight: 700, cursor: "pointer" }}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
