-- ═══════════════════════════════════════════════════════════════
-- Sewlytics — Supabase schema  (run ONCE in SQL Editor)
-- ═══════════════════════════════════════════════════════════════

-- ── 1. ORDERS — synced hourly from Airtable "Sewlytics_Sync" view ────────────
create table if not exists orders (
  airtable_id  text primary key,
  style_id     text    not null,
  style        text    not null default '',
  color        text    not null default '',
  po           text    not null default '',
  customer     text    not null default '',
  description  text    not null default '',
  type         text    not null default '',
  order_qty    integer not null default 0,
  cut_qty      integer not null default 0,
  sew_qty      integer not null default 0,
  finish_qty   integer not null default 0,
  lines_raw    text    not null default '',
  synced_at    timestamptz not null default now()
);

-- ── 2. LINES — static, managed directly in Supabase Table Editor ─────────────
create table if not exists lines (
  id           bigserial primary key,
  line_name    text    not null,
  floor        text    not null default '',
  contractor   text    not null default '',
  abbr         text    not null default ''
);

-- ── 3. APP USERS — managed in Supabase ───────────────────────────────────────
create table if not exists app_users (
  id            bigserial primary key,
  username      text    not null unique,
  password      text    not null,
  full_name     text    not null default '',
  role          text    not null default 'Checker',
  assigned_line text    not null default '',
  floor         text    not null default '',
  is_active     boolean not null default true,
  last_login    timestamptz
);

-- ── 4. DEFECT MASTER — managed in Supabase ───────────────────────────────────
create table if not exists defect_master (
  id           bigserial primary key,
  defect_code  text    not null default '',
  name_en      text    not null,
  name_hi      text    not null default '',
  category     text    not null default 'Others',
  is_active    boolean not null default true,
  sort_order   integer not null default 99,
  item_type    text    not null default ''
);

-- ── 5. QC INSPECTIONS — written by the app ───────────────────────────────────
create table if not exists qc_inspections (
  id                     bigserial primary key,
  style_id               text    not null default '',
  style                  text    not null default '',
  color                  text    not null default '',
  po                     text    not null default '',
  customer               text    not null default '',
  item_type              text    not null default '',
  line_name              text    not null default '',
  floor                  text    not null default '',
  result                 text    not null,
  defect_name_en         text    not null default '',
  defect_name_hi         text    not null default '',
  defect_category        text    not null default '',
  pieces_count           integer not null default 1,
  is_alter_reinspection  boolean not null default false,
  original_record_id     bigint,
  inspection_datetime    timestamptz not null default now(),
  inspection_date        text    not null default '',
  inspection_hour        numeric,
  session_id             text    not null default '',
  cut_qty_snapshot       integer not null default 0,
  checker_name           text    not null default '',
  checker_username       text    not null default '',
  group_id               text    not null default '',
  is_primary             boolean,
  all_defects            text    not null default '',
  created_at             timestamptz not null default now()
);

-- ── 6. ALTER QUEUE — written by the app ──────────────────────────────────────
create table if not exists alter_queue (
  id                      bigserial primary key,
  original_inspection_id  bigint,
  style_id                text    not null default '',
  style                   text    not null default '',
  color                   text    not null default '',
  line_name               text    not null default '',
  defect_name_en          text    not null default '',
  pieces_count            integer not null default 1,
  date_sent               text    not null default '',
  status                  text    not null default 'Pending',
  reinspection_datetime   timestamptz,
  reinspection_result     text    not null default '',
  reinspection_defect     text    not null default '',
  tat_hours               numeric,
  checker_name            text    not null default '',
  customer                text    not null default '',
  po                      text    not null default '',
  item_type               text    not null default '',
  created_at              timestamptz not null default now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists orders_style_id_idx        on orders          (style_id);
create index if not exists lines_line_name_idx         on lines           (line_name);
create index if not exists qc_style_line_idx           on qc_inspections  (style_id, po, line_name);
create index if not exists qc_datetime_idx             on qc_inspections  (inspection_datetime);
create index if not exists aq_status_line_idx          on alter_queue     (status, line_name);

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table orders         enable row level security;
alter table lines          enable row level security;
alter table app_users      enable row level security;
alter table defect_master  enable row level security;
alter table qc_inspections enable row level security;
alter table alter_queue    enable row level security;

-- orders: read-only
create policy "read orders"         on orders         for select using (true);

-- lines: read-only
create policy "read lines"          on lines          for select using (true);

-- app_users: read + update (login + last_login update)
create policy "read app_users"      on app_users      for select using (true);
create policy "update app_users"    on app_users      for update using (true);

-- defect_master: read + insert (managers can add defects)
create policy "read defect_master"  on defect_master  for select using (true);
create policy "insert defect_master"on defect_master  for insert with check (true);

-- qc_inspections: read + insert
create policy "read qc_inspections" on qc_inspections for select using (true);
create policy "insert qc_inspections" on qc_inspections for insert with check (true);

-- alter_queue: read + insert + update (re-inspection updates status)
create policy "read alter_queue"    on alter_queue    for select using (true);
create policy "insert alter_queue"  on alter_queue    for insert with check (true);
create policy "update alter_queue"  on alter_queue    for update using (true);
