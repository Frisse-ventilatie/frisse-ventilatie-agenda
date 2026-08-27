import { getStore } from "@netlify/blobs";

// One shared store, used by every visitor of the site.
function bookingsStore() {
  return getStore({ name: "fv-bookings", consistency: "strong" });
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

// Morning slots (am1 08:00-11:00 / am2 09:00-12:00) are mutually exclusive,
// so a booking on either one blocks the other for the same day.
function conflictingSlots(slot) {
  if (slot === "am1" || slot === "am2") return ["am1", "am2"];
  return [slot];
}

function isSlotTaken(bookings, date, slot) {
  const blocked = conflictingSlots(slot);
  return bookings.some((b) => b.date === date && blocked.includes(b.slot));
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const store = bookingsStore();

  try {
    if (req.method === "GET") {
      const bookings = (await store.get("bookings", { type: "json" })) || [];
      return json(bookings);
    }

    if (req.method === "POST") {
      const body = await req.json();
      const {
        date, slot, address, contact, email,
        serviceType, additionalInfo, comments, status, override,
      } = body || {};

      if (!date || !slot || !address || !serviceType) {
        return json({ error: "missing_fields" }, 400);
      }

      const bookings = (await store.get("bookings", { type: "json" })) || [];

      // Server-side re-check: this is what actually prevents two different
      // visitors from both landing on the same slot, even if they both saw
      // it as "available" a moment ago on their own screens.
      if (!override && isSlotTaken(bookings, date, slot)) {
        return json({ error: "slot_taken" }, 409);
      }

      const booking = {
        id: "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        date, slot, address,
        contact: contact || "", email: email || "",
        serviceType, additionalInfo: additionalInfo || "", comments: comments || "",
        status: status === "approved" ? "approved" : "pending",
        override: !!override,
        ref: "FV-" + Date.now().toString().slice(-6),
        createdAt: new Date().toISOString(),
      };

      bookings.push(booking);
      await store.setJSON("bookings", bookings);
      return json(booking, 201);
    }

    if (req.method === "PATCH") {
      const { id } = (await req.json()) || {};
      if (!id) return json({ error: "missing_id" }, 400);

      const bookings = (await store.get("bookings", { type: "json" })) || [];
      const idx = bookings.findIndex((b) => b.id === id);
      if (idx === -1) return json({ error: "not_found" }, 404);

      bookings[idx].status = "approved";
      await store.setJSON("bookings", bookings);
      return json(bookings[idx]);
    }

    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "missing_id" }, 400);

      const bookings = (await store.get("bookings", { type: "json" })) || [];
      const next = bookings.filter((b) => b.id !== id);
      await store.setJSON("bookings", next);
      return json({ ok: true });
    }

    return json({ error: "method_not_allowed" }, 405);
  } catch (err) {
    console.error("bookings function error:", err);
    return json({ error: "server_error" }, 500);
  }
};

export const config = { path: "/api/bookings" };
