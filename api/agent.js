// ─── /api/agent ─────────────────────────────────────────────────────────────
// Vercel serverless function. Keeps ANTHROPIC_API_KEY server-side (never
// exposed to the browser). The client sends the running message history;
// this function just forwards it to Claude with the system prompt + tool
// definitions attached, and returns the raw response for the client to
// interpret (and loop again if Claude wants to call a tool).

// ── THE "SKILL": how the agent should behave ────────────────────────────────
const SYSTEM_PROMPT = `You are the EV PRO assistant, built into an EV charging cost & ownership calculator app for Indian EV owners.

Rules you must follow:
- For ANY question involving a cost in ₹, energy in kWh, range in km, break-even years, or ROI — you MUST call a tool. Never compute or guess these numbers yourself.
- For questions about EV model specs (battery size, efficiency, price) — call list_ev_presets. Never invent a spec.
- If the user doesn't give you enough info to call a tool (e.g. they don't say what rate they pay), ask ONE short clarifying question, or use sensible Indian defaults (₹7.5/kWh home rate, 15 km/L petrol mileage, ₹102/L petrol) and say you're using a default.
- Keep answers short and conversational — 2-4 sentences. This is a chat widget, not a report.
- Always use ₹ for currency, and give amounts rounded sensibly (no decimals on large ₹ figures).
- If asked something unrelated to EVs, charging, or this app, politely redirect.`;

const TOOL_DEFINITIONS = [
  {
    name: "calculate_charging_cost",
    description:
      "Calculate the cost and energy for charging an EV from one battery percentage to another, at a given electricity rate. Use this for ANY question involving ₹ cost, kWh, or range for a charging session.",
    input_schema: {
      type: "object",
      properties: {
        batteryKWh: { type: "number", description: "Battery capacity in kWh" },
        fromPct: { type: "number", description: "Starting charge percentage (0-100)" },
        toPct: { type: "number", description: "Target charge percentage (0-100)" },
        ratePerKWh: { type: "number", description: "Electricity rate in ₹ per kWh" },
        efficiency: { type: "number", description: "EV efficiency in km per kWh (optional, defaults to 6.5)" },
      },
      required: ["batteryKWh", "fromPct", "toPct", "ratePerKWh"],
    },
  },
  {
    name: "calculate_tco",
    description:
      "Calculate total cost of ownership comparison between an EV and a petrol car over N years, including break-even point and ROI.",
    input_schema: {
      type: "object",
      properties: {
        evPrice: { type: "number" },
        icePrice: { type: "number" },
        dailyKm: { type: "number" },
        petrolPricePerL: { type: "number" },
        petrolMileage: { type: "number" },
        elecRate: { type: "number" },
        evEfficiency: { type: "number" },
        years: { type: "number" },
      },
      required: ["evPrice", "icePrice", "dailyKm", "petrolPricePerL", "petrolMileage", "elecRate", "evEfficiency", "years"],
    },
  },
  {
    name: "list_ev_presets",
    description: "Get the list of EV models this app supports, with real battery size, efficiency, and price.",
    input_schema: { type: "object", properties: {} },
  },
];

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY not set on the server" });
    return;
  }

  const { messages } = req.body;
  if (!Array.isArray(messages)) {
    res.status(400).json({ error: "messages array required" });
    return;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: TOOL_DEFINITIONS,
        messages,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json(data);
      return;
    }
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || "Agent request failed" });
  }
};
