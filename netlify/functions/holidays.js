import { getStore } from "@netlify/blobs";

// One shared store, used by every visitor of the site — same pattern as bookings.js.
function holidaysStore() {
  return getStore({ name: "fv-holidays", consistency: "strong" });
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const store = holidaysStore();

  try {
    if (req.method === "GET") {
      const holidays = (await store.get("holidays", { type: "json" })) || [];
      return json(holidays);
    }

    if (req.method === "POST") {
      const body = await req.json();

      // Bulk add (used by "Add Dutch public holidays"): body.items = [{date,name,type}, ...]
      if (Array.isArray(body?.items)) {
        const holidays = (await store.get("holidays", { type: "json" })) || [];
        const existingDates = new Set(holidays.map((h) => h.date));
        const added = [];
        for (const item of body.items) {
          if (!item?.date || !item?.name) continue;
          if (existingDates.has(item.date)) continue;
          const entry = {
            id: "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            date: item.date,
            name: item.name,
            type: item.type === "half" ? "half" : "full",
          };
          holidays.push(entry);
          existingDates.add(entry.date);
          added.push(entry);
        }
        await store.setJSON("holidays", holidays);
        return json(holidays, 201);
      }

      // Single add
      const { date, name, type } = body || {};
      if (!date || !name) return json({ error: "missing_fields" }, 400);

      const holidays = (await store.get("holidays", { type: "json" })) || [];
      const entry = {
        id: "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        date, name,
        type: type === "half" ? "half" : "full",
      };
      holidays.push(entry);
      await store.setJSON("holidays", holidays);
      return json(entry, 201);
    }

    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const id = url.searchParams.get("id");
      const date = url.searchParams.get("date");
      if (!id && !date) return json({ error: "missing_id_or_date" }, 400);

      const holidays = (await store.get("holidays", { type: "json" })) || [];
      const next = holidays.filter((h) => (id ? h.id !== id : h.date !== date));
      await store.setJSON("holidays", next);
      return json({ ok: true });
    }

    return json({ error: "method_not_allowed" }, 405);
  } catch (err) {
    console.error("holidays function error:", err);
    return json({ error: "server_error" }, 500);
  }
};

export const config = { path: "/api/holidays" };
