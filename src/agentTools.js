// ─── AGENT TOOLS ────────────────────────────────────────────────────────────
// These wrap the EXACT same formulas used in App.js, so the agent's answers
// always match what the calculator itself shows. Never let the model guess
// a number — always route through one of these.

export const EV_PRESETS = [
  { name: "Nexon EV",    battery: 40.5,  efficiency: 6.5,  price: 1500000 },
  { name: "MG ZS EV",    battery: 50.3,  efficiency: 6.2,  price: 2200000 },
  { name: "Ioniq 5",     battery: 72.6,  efficiency: 6.8,  price: 4500000 },
  { name: "BMW iX",      battery: 111.5, efficiency: 5.9,  price: 11500000 },
  { name: "Ola S1 Pro",  battery: 4.0,   efficiency: 55.0, price: 150000 },
];

export const TARIFF_PRESETS = [
  { label: "Home - Standard",  rate: 7.5 },
  { label: "BESCOM EV Tariff", rate: 6.0 },
  { label: "Public DC Fast",   rate: 22.0 },
];

const CO2_SAVED_PER_KM = 69.47; // grams, IIT Madras 2025 study

// ─── Tool schemas (sent to the model so it knows what it can call) ─────────

export const TOOL_DEFINITIONS = [
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
      "Calculate total cost of ownership comparison between an EV and a petrol car over N years, including break-even point and ROI. Use this for any 'is it worth it' / 'when do I break even' / 'how much will I save' question.",
    input_schema: {
      type: "object",
      properties: {
        evPrice: { type: "number", description: "EV purchase price in ₹" },
        icePrice: { type: "number", description: "Petrol car price in ₹" },
        dailyKm: { type: "number", description: "Average km driven per day" },
        petrolPricePerL: { type: "number", description: "Petrol price in ₹ per litre" },
        petrolMileage: { type: "number", description: "Petrol car mileage in km/L" },
        elecRate: { type: "number", description: "Electricity rate in ₹/kWh" },
        evEfficiency: { type: "number", description: "EV efficiency in km/kWh" },
        years: { type: "number", description: "Analysis period in years" },
      },
      required: ["evPrice", "icePrice", "dailyKm", "petrolPricePerL", "petrolMileage", "elecRate", "evEfficiency", "years"],
    },
  },
  {
    name: "list_ev_presets",
    description:
      "Get the list of EV models this app supports, with their real battery size, efficiency, and price. Use this when the user asks to compare cars or asks about specs — never invent a spec.",
    input_schema: { type: "object", properties: {} },
  },
];

// ─── Tool implementations (run entirely client-side, no server needed) ─────

export function runTool(name, input) {
  switch (name) {
    case "calculate_charging_cost": {
      const { batteryKWh, fromPct, toPct, ratePerKWh, efficiency = 6.5 } = input;
      const chargeNeeded = Math.max(0, toPct - fromPct);
      const energyKWh = (batteryKWh * chargeNeeded) / 100;
      const cost = energyKWh * ratePerKWh;
      const estRangeKm = energyKWh * efficiency;
      const co2SavedG = estRangeKm * CO2_SAVED_PER_KM;
      return {
        energyKWh: +energyKWh.toFixed(2),
        cost: +cost.toFixed(2),
        estRangeKm: Math.round(estRangeKm),
        co2SavedG: Math.round(co2SavedG),
      };
    }
    case "calculate_tco": {
      const {
        evPrice, icePrice, dailyKm, petrolPricePerL,
        petrolMileage, elecRate, evEfficiency, years,
      } = input;
      const annualKm = dailyKm * 365;
      const annualElec = (annualKm / evEfficiency) * elecRate;
      const annualPetrol = (annualKm / petrolMileage) * petrolPricePerL;
      const annualSaving = annualPetrol - annualElec;
      const evPremium = evPrice - icePrice;
      const breakevenYears = evPremium > 0 ? +(evPremium / annualSaving).toFixed(1) : 0;
      const roi = evPremium > 0 ? +((annualSaving / evPremium) * 100).toFixed(1) : null;
      const totalEvCost = evPrice + annualElec * years;
      const totalIceCost = icePrice + annualPetrol * years;
      const totalSaved = Math.round(totalIceCost - totalEvCost);
      return { breakevenYears, roi, totalSaved, annualSaving: Math.round(annualSaving) };
    }
    case "list_ev_presets":
      return { presets: EV_PRESETS, tariffs: TARIFF_PRESETS };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
