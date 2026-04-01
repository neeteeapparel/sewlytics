#!/usr/bin/env node
// migrate.js — One-time data migration to Supabase
// Seeds: app_users, defect_master, lines, qc_inspections, alter_queue
//
// Usage:
//   1. Copy these two CSV files into this folder:
//        "QC Inspections-Grid view (2).csv"
//        "Alter Queue-Grid view (2).csv"
//   2. Run: node migrate.js
//
// Requires Node 18+. No external dependencies.

const fs   = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://fvuhyytkgjqvgaluccrr.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_7LQLqSM5oyh3IJ4WJ4cvGA_xt5wXF4r';

const HDR = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
};

// ── CSV parser (handles quoted fields) ───────────────────────────────────────

function parseCSVLine(line) {
  const cols = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      cols.push(cur); cur = '';
    } else cur += ch;
  }
  cols.push(cur);
  return cols;
}

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8').replace(/\r/g, '');
  const lines   = content.split('\n').filter(l => l.trim());
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const obj  = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim(); });
    return obj;
  });
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function clearTable(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=gte.0`, {
    method: 'DELETE',
    headers: HDR,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[${table}] clear failed: ${res.status} ${body}`);
  }
}

async function upsert(table, rows, conflictCol = '') {
  if (!rows.length) return;
  const url = conflictCol
    ? `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${conflictCol}`
    : `${SUPABASE_URL}/rest/v1/${table}`;
  const headers = { ...HDR, Prefer: 'resolution=merge-duplicates,return=minimal' };

  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const res = await fetch(url, {
      method: 'POST', headers,
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`[${table}] batch ${i / 500 + 1} failed: ${res.status} ${body}`);
    }
    process.stdout.write('.');
  }
}

// ── Seed data ─────────────────────────────────────────────────────────────────

const LINES = [
  { line_name:'GF-1',         floor:'Ground Floor',    contractor:'Anmol',       abbr:'GF' },
  { line_name:'GF-2',         floor:'Ground Floor',    contractor:'Anmol',       abbr:'GF' },
  { line_name:'GF-3',         floor:'Ground Floor',    contractor:'Anmol',       abbr:'GF' },
  { line_name:'GF-4',         floor:'Ground Floor',    contractor:'Anmol',       abbr:'GF' },
  { line_name:'GF-5',         floor:'Ground Floor',    contractor:'Anmol',       abbr:'GF' },
  { line_name:'GF-Finishing', floor:'Ground Floor',    contractor:'',            abbr:'GF' },
  { line_name:'MZ-1',         floor:'Sampling',        contractor:'Neetee',      abbr:'MZ' },
  { line_name:'MZ-2',         floor:'Mezzanine Floor', contractor:'Neetee',      abbr:'MZ' },
  { line_name:'MZ-3',         floor:'Mezzanine Floor', contractor:'Pawan',       abbr:'MZ' },
  { line_name:'MZ-4',         floor:'Mezzanine Floor', contractor:'Dheeraj',     abbr:'MZ' },
  { line_name:'MZ-5',         floor:'Mezzanine Floor', contractor:'Ansari',      abbr:'MZ' },
  { line_name:'MZ-6',         floor:'Mezzanine Floor', contractor:'Pcs Rate 1',  abbr:'MZ' },
  { line_name:'MZ-7',         floor:'Mezzanine Floor', contractor:'Pcs Rate 2',  abbr:'MZ' },
  { line_name:'MZ-Finishing', floor:'Mezzanine Floor', contractor:'Neetee',      abbr:'MZ' },
  { line_name:'MZ-Salaried 2',floor:'Mezzanine Floor', contractor:'Neetee',      abbr:'MZ' },
  { line_name:'OF-1',         floor:'Fabricator',      contractor:'',            abbr:'OF' },
  { line_name:'OF-2',         floor:'Fabricator',      contractor:'',            abbr:'OF' },
  { line_name:'OF-3',         floor:'Fabricator',      contractor:'',            abbr:'OF' },
  { line_name:'SF-1',         floor:'Second Floor',    contractor:'Haider',      abbr:'SF' },
  { line_name:'SF-2',         floor:'Second Floor',    contractor:'Haider',      abbr:'SF' },
  { line_name:'SF-3',         floor:'Second Floor',    contractor:'Haider',      abbr:'SF' },
  { line_name:'SF-4',         floor:'Second Floor',    contractor:'Saiyed',      abbr:'SF' },
  { line_name:'SF-5',         floor:'Second Floor',    contractor:'Samshad',     abbr:'SF' },
  { line_name:'SF-6',         floor:'Second Floor',    contractor:'Samshad',     abbr:'SF' },
  { line_name:'SF-7',         floor:'Second Floor',    contractor:'Haider',      abbr:'SF' },
  { line_name:'SF-Finishing', floor:'Second Floor',    contractor:'',            abbr:'SF' },
  { line_name:'SF-Samshad',   floor:'Second Floor',    contractor:'Samshad',     abbr:'SF' },
  { line_name:'ZA-1',         floor:'Sweater',         contractor:'Zenasia',     abbr:'ZA' },
];

const APP_USERS = [
  { username:'Checker',     password:'123456',      full_name:'Checker',          role:'Checker',  assigned_line:'', floor:'', is_active:true, last_login:'2026-03-31T06:31:02.442Z' },
  { username:'komal',       password:'654321',      full_name:'Komal Panvanda',   role:'Admin',    assigned_line:'', floor:'', is_active:true, last_login:'2026-03-30T10:04:42.692Z' },
  { username:'Rana',        password:'654321',      full_name:'Shailender Singh', role:'Manager',  assigned_line:'', floor:'', is_active:true, last_login:'2026-03-30T09:02:01.046Z' },
  { username:'kamalsidhu',  password:'Kamal@2026',  full_name:'Kamal Sidhu',      role:'Admin',    assigned_line:'', floor:'', is_active:true, last_login:'2026-03-28T09:48:50.176Z' },
  { username:'nawab',       password:'123456',      full_name:'Nawab',            role:'Checker',  assigned_line:'', floor:'', is_active:true, last_login:'2026-03-31T03:49:34.073Z' },
  { username:'ravinder',    password:'Rav123',      full_name:'Ravinder',         role:'Manager',  assigned_line:'', floor:'', is_active:true, last_login:'2026-03-28T11:38:27.401Z' },
  { username:'dhruv',       password:'123456',      full_name:'Dhruv',            role:'Checker',  assigned_line:'', floor:'', is_active:true, last_login:'2026-03-31T03:57:16.148Z' },
  { username:'lalbabu',     password:'123456',      full_name:'Lal Babu',         role:'Checker',  assigned_line:'', floor:'', is_active:true, last_login:'2026-03-31T03:53:59.990Z' },
  { username:'gurvinder',   password:'Gur123',      full_name:'Gurvinder',        role:'Manager',  assigned_line:'', floor:'', is_active:true, last_login:null },
];

const DEFECTS = [
  { defect_code:'STITUN-1',  name_en:'Uneven Stitch',       name_hi:'टेढ़ी सिलाई',         category:'Stitching', is_active:true, sort_order:1  },
  { defect_code:'STITJO-2',  name_en:'Joint Out',            name_hi:'जॉइंट बाहर',          category:'Stitching', is_active:true, sort_order:2  },
  { defect_code:'STITRA-3',  name_en:'Raw Stitch',           name_hi:'कच्ची सिलाई',          category:'Stitching', is_active:true, sort_order:3  },
  { defect_code:'STITOP-4',  name_en:'Open Seam',            name_hi:'सीम खुली',             category:'Stitching', is_active:true, sort_order:4  },
  { defect_code:'STITJU-5',  name_en:'Jump Stitch',          name_hi:'जंप स्टिच',            category:'Stitching', is_active:true, sort_order:5  },
  { defect_code:'STITLO-6',  name_en:'Loose Stitch',         name_hi:'ढीली सिलाई',           category:'Stitching', is_active:true, sort_order:6  },
  { defect_code:'STITOP-7',  name_en:'Open Stitch',          name_hi:'स्टिच खुली',           category:'Stitching', is_active:true, sort_order:7  },
  { defect_code:'STITDO-8',  name_en:'Down Stitch',          name_hi:'नीचे सिलाई',           category:'Stitching', is_active:true, sort_order:8  },
  { defect_code:'STITBR-9',  name_en:'Broken Stitch',        name_hi:'टूटी सिलाई',           category:'Stitching', is_active:true, sort_order:9  },
  { defect_code:'STITWA-10', name_en:'Wavy Stitch',          name_hi:'लहरदार सिलाई',         category:'Stitching', is_active:true, sort_order:10 },
  { defect_code:'STITWR-11', name_en:'Wrong Seam Turn',      name_hi:'गलत सीम टर्न',         category:'Stitching', is_active:true, sort_order:11 },
  { defect_code:'STITMI-12', name_en:'Missing Operation',    name_hi:'ऑपरेशन छूटा',          category:'Stitching', is_active:true, sort_order:12 },
  { defect_code:'STITWR-13', name_en:'Wrong Part Attach',    name_hi:'गलत पार्ट लगा',        category:'Stitching', is_active:true, sort_order:13 },
  { defect_code:'STITPI-14', name_en:'Pinching',             name_hi:'पिंचिंग',              category:'Stitching', is_active:true, sort_order:14 },
  { defect_code:'STITUN-15', name_en:'Uneven Gaping',        name_hi:'गैपिंग असमान',         category:'Stitching', is_active:true, sort_order:15 },
  { defect_code:'STITBA-16', name_en:'Balancing Out',        name_hi:'बैलेंसिंग गड़बड़',     category:'Stitching', is_active:true, sort_order:16 },
  { defect_code:'STITWR-17', name_en:'Wrong Shape',          name_hi:'गलत शेप',              category:'Stitching', is_active:true, sort_order:17 },
  { defect_code:'STITWR-18', name_en:'Wrong Side Margin',    name_hi:'गलत साइड मार्जिन',    category:'Stitching', is_active:true, sort_order:18 },
  { defect_code:'STITRA-19', name_en:'Raw Edge / Margin',    name_hi:'कच्चा किनारा',         category:'Stitching', is_active:true, sort_order:19 },
  { defect_code:'STITDA-20', name_en:'Damage pcs',           name_hi:'कटा हुआ',              category:'Stitching', is_active:true, sort_order:20 },
];

// ── Transform CSV rows → Supabase rows ───────────────────────────────────────

function toQCInspections(rows) {
  return rows.map(r => ({
    style_id:              r['Style ID']              || '',
    style:                 r['Style']                 || '',
    color:                 r['Color']                 || '',
    po:                    r['PO']                    || '',
    customer:              r['Customer']              || '',
    item_type:             r['Item Type']             || '',
    line_name:             r['Line Name']             || '',
    floor:                 r['Floor']                 || '',
    result:                r['Result']                || 'Pass',
    defect_name_en:        r['Defect Name EN']        || '',
    defect_name_hi:        r['Defect Name HI']        || '',
    defect_category:       r['Defect Category']       || '',
    pieces_count:          parseInt(r['Pieces Count']) || 1,
    is_alter_reinspection: r['Is Alter Reinspection'] === 'checked',
    original_record_id:    r['Original Record ID'] ? parseInt(r['Original Record ID']) : null,
    inspection_datetime:   r['Inspection DateTime']   || new Date().toISOString(),
    inspection_date:       r['Inspection Date']       || '',
    inspection_hour:       r['Inspection Hour'] ? parseFloat(r['Inspection Hour']) : null,
    session_id:            r['Session ID']            || '',
    cut_qty_snapshot:      parseInt(r['Cut Qty Snapshot']) || 0,
    checker_name:          r['Checker Name']          || '',
    checker_username:      r['Checker Username']      || '',
    group_id:              r['Group ID']              || '',
    is_primary:            r['Is Primary'] === 'checked' ? true : null,
    all_defects:           r['All Defects']           || '',
  })).filter(r => r.result);
}

function toAlterQueue(rows) {
  return rows.map(r => ({
    original_inspection_id: r['Original Inspection Record ID'] ? parseInt(parseFloat(r['Original Inspection Record ID'])) : null,
    style_id:               r['Style ID']                  || '',
    style:                  r['Style']                     || '',
    color:                  r['Color']                     || '',
    line_name:              r['Line Name']                 || '',
    defect_name_en:         r['Defect Name EN']            || '',
    pieces_count:           parseInt(r['Pieces Count'])    || 1,
    date_sent:              r['Date Sent to Alter']        || '',
    status:                 r['Status']                    || 'Pending',
    reinspection_datetime:  r['Reinspection DateTime']     || null,
    reinspection_result:    r['Reinspection Result']       || '',
    reinspection_defect:    r['Reinspection Defect']       || '',
    tat_hours:              r['TAT Hours'] ? parseFloat(r['TAT Hours']) : null,
    checker_name:           r['Checker Name']              || '',
    customer:               r['Customer']                  || '',
    po:                     r['PO']                        || '',
    item_type:              r['Item Type']                 || '',
  }));
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  const dir = __dirname;

  console.log('\n═══════════════════════════════════════');
  console.log('  Sewlytics → Supabase Migration');
  console.log('═══════════════════════════════════════\n');

  try {
    // 1. Lines (upsert on line_name)
    process.stdout.write('Inserting lines (28 records)  ');
    await upsert('lines', LINES, 'line_name');
    console.log('  ✓');

    // 2. App Users (upsert on username)
    process.stdout.write('Inserting app_users (9 records)  ');
    await upsert('app_users', APP_USERS, 'username');
    console.log('  ✓');

    // 3. Defect Master (upsert on name_en)
    process.stdout.write('Inserting defect_master (20 records)  ');
    await upsert('defect_master', DEFECTS, 'name_en');
    console.log('  ✓');

    // 3. QC Inspections from CSV
    const qcFile = path.join(dir, 'QC Inspections-Grid view.csv');
    if (!fs.existsSync(qcFile)) {
      console.warn('⚠  QC Inspections CSV not found — skipping. Copy file to project folder.');
    } else {
      const qcCSV  = parseCSV(qcFile);
      const qcRows = toQCInspections(qcCSV);
      process.stdout.write(`Clearing old qc_inspections...  `);
      await clearTable('qc_inspections');
      console.log('✓');
      process.stdout.write(`Inserting qc_inspections (${qcRows.length} records)  `);
      await upsert('qc_inspections', qcRows);
      console.log(`  ✓`);
    }

    // 4. Alter Queue from CSV
    const aqFile = path.join(dir, 'Alter Queue-Grid view.csv');
    if (!fs.existsSync(aqFile)) {
      console.warn('⚠  Alter Queue CSV not found — skipping. Copy file to project folder.');
    } else {
      const aqCSV  = parseCSV(aqFile);
      const aqRows = toAlterQueue(aqCSV);
      process.stdout.write(`Clearing old alter_queue...  `);
      await clearTable('alter_queue');
      console.log('✓');
      process.stdout.write(`Inserting alter_queue (${aqRows.length} records)  `);
      await upsert('alter_queue', aqRows);
      console.log(`  ✓`);
    }

    console.log('\n✅ Migration complete!\n');
    console.log('Next: Add your Lines manually in Supabase Table Editor,');
    console.log('then run sync.js (or trigger the GitHub Action) to populate Orders.\n');

  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  }
})();
