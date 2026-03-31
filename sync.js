#!/usr/bin/env node
// sync.js — Airtable → Supabase one-way sync (Orders only)
// Syncs from the "Sewlytics_Sync" view in the Orders table.
// Runs hourly via GitHub Actions. Requires Node 18+ (native fetch).
//
// Env vars (set as GitHub Actions secrets):
//   AIRTABLE_TOKEN       — personal access token (pat…)
//   AIRTABLE_BASE        — base ID (app…)
//   SUPABASE_URL         — https://<project>.supabase.co
//   SUPABASE_SERVICE_KEY — service_role key (never expose to frontend)

const { AIRTABLE_TOKEN, AIRTABLE_BASE, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

for (const [k, v] of Object.entries({ AIRTABLE_TOKEN, AIRTABLE_BASE, SUPABASE_URL, SUPABASE_SERVICE_KEY })) {
  if (!v) { console.error(`Missing env var: ${k}`); process.exit(1); }
}

const ORDERS_TABLE = 'Styles In Process';
const ORDERS_VIEW  = 'Sewlytics_Sync';

// ── Airtable helpers ─────────────────────────────────────────────────────────

async function atFetch(table, view) {
  const records = [];
  const base = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(table)}`;
  let url = `${base}?pageSize=100&view=${encodeURIComponent(view)}`;
  let pages = 0;

  while (url && pages++ < 50) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Airtable [${table}/${view}] ${res.status}: ${body}`);
    }
    const data = await res.json();
    records.push(...(data.records || []));
    url = data.offset
      ? `${base}?pageSize=100&view=${encodeURIComponent(view)}&offset=${data.offset}`
      : null;
  }
  return records;
}

// ── Supabase helpers ─────────────────────────────────────────────────────────

async function sbUpsert(table, rows) {
  if (!rows.length) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase upsert [${table}] ${res.status}: ${body}`);
  }
}

// ── Sync ──────────────────────────────────────────────────────────────────────

async function syncOrders() {
  const recs = await atFetch(ORDERS_TABLE, ORDERS_VIEW);
  const now  = new Date().toISOString();

  const rows = recs
    .map(r => ({
      airtable_id: r.id,
      style_id:    r.fields['Style ID']            || '',
      style:       r.fields['Style']               || '',
      color:       r.fields['Color']               || '',
      po:          r.fields['PO']                  || '',
      customer:    r.fields['Customer']            || '',
      description: r.fields['Description']         || '',
      type:        r.fields['Type']                || '',
      order_qty:   r.fields['Order Q']             || 0,
      cut_qty:     r.fields['Q Cut']               || 0,
      sew_qty:     r.fields['Q Sew']               || 0,
      finish_qty:  r.fields['Q Finish']            || 0,
      lines_raw:   r.fields['Line from Cut Issue'] || '',
      synced_at:   now,
    }))
    .filter(o => o.style_id);

  for (let i = 0; i < rows.length; i += 500) {
    await sbUpsert('orders', rows.slice(i, i + 500));
  }
  console.log(`Orders: synced ${rows.length} records from view "${ORDERS_VIEW}"`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  try {
    await syncOrders();
    console.log('Sync complete');
  } catch (err) {
    console.error('Sync failed:', err.message);
    process.exit(1);
  }
})();
