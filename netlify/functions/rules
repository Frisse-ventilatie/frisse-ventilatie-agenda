import { getStore } from "@netlify/blobs";

// One shared store, used by every visitor of the site — same pattern as bookings.js/holidays.js.
function rulesStore() {
  return getStore({ name: "fv-rules", consistency: "strong" });
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const DEFAULT_RULES = { mon: 4, tue: 2, wed: 2, thu: 2, fri: 7 };
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri"];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function sanitize(input) {
  const out = {};
  for (const key of DAY_KEYS) {
    const v = Number(input?.[key]);
    out[key] = Number.isFinite(v) && v >= 0 ? Math.floor(v) : DEFAULT_RULES[key];
  }
  return out;
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const store = rulesStore();

  try {
    if (req.method === "GET") {
      const rules = (await store.get("rules", { type: "json" })) || DEFAULT_RULES;
      return json(rules);
    }

    if (req.method === "POST") {
      const body = await req.json();
      const rules = sanitize(body);
      await store.setJSON("rules", rules);
      return json(rules);
    }

    return json({ error: "method_not_allowed" }, 405);
  } catch (err) {
    console.error("rules function error:", err);
    return json({ error: "server_error" }, 500);
  }
};

export const config = { path: "/api/rules" };
