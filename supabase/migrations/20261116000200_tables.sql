-- Sync step 2: tables. Shapes: docs/sync-supabase-plan.md §3, product rules: docs/family-view-design.md.
-- Every table gets Row Level Security in the next migration (deny by default).
-- No column holds a sign-in id, an email, an IP address or a plain-text name.

-- ---------------------------------------------------------------------------
-- Families and parents
-- ---------------------------------------------------------------------------
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name_enc bytea,                                     -- family name, encrypted (Vault name key)
  created_at timestamptz not null check (created_at = date_trunc('hour', created_at, 'UTC')),  -- a parent action: rounded to the hour
  last_activity_on date not null default current_date, -- the 7-year retention clock
  deleted_at timestamptz check (deleted_at = date_trunc('hour', deleted_at, 'UTC'))  -- soft delete: hidden, restorable for 48 hours
);

create table public.family_members (                 -- parents
  member_id uuid primary key default gen_random_uuid(), -- family-only id, used for every parent action
  family_id uuid not null references public.families on delete cascade,
  auth_hmac bytea not null,                           -- HMAC of the sign-in id; never the id itself
  role text not null check (role in ('primary', 'parent')),
  joined_at timestamptz not null check (joined_at = date_trunc('hour', joined_at, 'UTC')),
  unique (family_id, auth_hmac)
);
create unique index family_one_primary on public.family_members (family_id) where role = 'primary';
create index family_members_auth on public.family_members (auth_hmac);

-- The admin (project owner). Holds no family data access: being admin grants nothing in any family.
create table public.app_admins (
  auth_hmac bytea primary key
);

-- ---------------------------------------------------------------------------
-- Devices and children
-- ---------------------------------------------------------------------------
create table public.devices (
  id uuid primary key,                                -- generated once per phone, stored locally
  family_id uuid not null references public.families on delete cascade,
  auth_hmac bytea not null unique,                    -- HMAC of the device's anonymous sign-in id
  label_enc bytea,                                    -- "הטלפון של …", encrypted
  linked_at timestamptz not null check (linked_at = date_trunc('hour', linked_at, 'UTC')),  -- paired by a parent
  last_seen_on date,
  revoked_at timestamptz check (revoked_at = date_trunc('hour', revoked_at, 'UTC'))  -- revoked: no access; rows stay
);

create table public.children (                       -- the app's Profile
  id uuid primary key,
  family_id uuid not null references public.families on delete cascade,
  name_enc bytea not null,                            -- nickname, encrypted
  avatar text not null check (length(avatar) between 1 and 16),
  grade int not null check (grade between 1 and 12),
  theme text check (theme is null or theme ~ '^[a-z0-9-]{1,32}$'),
  updated_at timestamptz not null,                    -- last writer wins
  deleted_at timestamptz check (deleted_at = date_trunc('hour', deleted_at, 'UTC')),  -- soft delete, 48 hours
  enrollment jsonb                                    -- reserved, always empty in phase 1
    check (enrollment is null)
);
create index children_family on public.children (family_id);

-- Which children a device may practise as ("who's learning today?"). Set by a parent.
create table public.device_children (
  device_id uuid not null references public.devices on delete cascade,
  child_id uuid not null references public.children on delete cascade,
  family_id uuid not null references public.families on delete cascade,
  primary key (device_id, child_id)
);

-- One-time pairing codes for a child's phone. Only an HMAC of the code is stored.
create table public.device_pairings (
  code_hmac bytea primary key,
  family_id uuid not null references public.families on delete cascade,
  label_enc bytea,
  child_ids uuid[] not null default '{}',
  expires_at timestamptz not null
);

-- ---------------------------------------------------------------------------
-- Progress (written by child devices only)
-- ---------------------------------------------------------------------------
create table public.child_device_totals (             -- grow-only counters, one row per child per device
  child_id uuid not null references public.children on delete cascade,
  device_id uuid not null references public.devices on delete cascade,
  family_id uuid not null references public.families on delete cascade,
  stars int not null default 0 check (stars >= 0),
  sessions int not null default 0 check (sessions >= 0),
  updated_at timestamptz not null,
  primary key (child_id, device_id)
);

create table public.daily_activity (
  child_id uuid not null references public.children on delete cascade,
  device_id uuid not null references public.devices on delete cascade,
  family_id uuid not null references public.families on delete cascade,
  day date not null,
  answered int not null check (answered >= 0),
  primary key (child_id, device_id, day)
);

create table public.topic_progress (
  child_id uuid not null references public.children on delete cascade,
  topic_id text not null check (topic_id ~ '^g[0-9]+\.[a-z0-9-]+\.[a-z0-9-]+$'),
  family_id uuid not null references public.families on delete cascade,
  level int not null check (level between 1 and 3),
  run_correct int not null check (run_correct >= 0),
  run_wrong int not null check (run_wrong >= 0),
  attempts int not null check (attempts >= 0),
  first_try int not null check (first_try >= 0),
  second_try int not null check (second_try >= 0),
  by_level int[] not null check (cardinality(by_level) = 3),
  last_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (child_id, topic_id)
);

create table public.exam_results (                    -- immutable once written
  id uuid primary key,
  child_id uuid not null references public.children on delete cascade,
  family_id uuid not null references public.families on delete cascade,
  pack_id text not null check (length(pack_id) <= 64),
  topic_ids text[] not null check (cardinality(topic_ids) <= 64),
  difficulty text not null check (length(difficulty) <= 16),
  questions int not null check (questions between 0 and 500),
  correct int not null check (correct between 0 and questions),
  score int not null check (score between 0 and 100),
  taken_at timestamptz not null,
  seen_by_parent_at timestamptz check (seen_by_parent_at = date_trunc('hour', seen_by_parent_at, 'UTC'))
);
create index exam_results_child on public.exam_results (child_id);

create table public.mistakes (                        -- immutable; newest 200 per child kept on the server
  id uuid primary key,
  child_id uuid not null references public.children on delete cascade,
  family_id uuid not null references public.families on delete cascade,
  topic_id text not null check (length(topic_id) <= 128),
  prompt text not null check (length(prompt) <= 4000),
  expression text check (length(expression) <= 1000),
  given text not null check (length(given) <= 1000),
  correct text not null check (length(correct) <= 1000),
  at timestamptz not null
);
create index mistakes_child_at on public.mistakes (child_id, at desc);

-- ---------------------------------------------------------------------------
-- Parent-made tests
-- ---------------------------------------------------------------------------
create table public.tests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  owner_scope text not null default 'family' check (owner_scope in ('family')),  -- 'grade', 'class' later
  grade int not null check (grade between 1 and 12),
  pack_id text not null check (length(pack_id) <= 64),
  topic_ids text[] not null check (cardinality(topic_ids) <= 64),
  questions jsonb not null check (jsonb_typeof(questions) = 'array' and pg_column_size(questions) <= 200000),
  upcoming jsonb check (upcoming is null or (jsonb_typeof(upcoming) = 'object' and pg_column_size(upcoming) <= 4000)),
  show_immediately boolean not null default false,
  created_by uuid references public.family_members (member_id) on delete set null,
  created_at timestamptz not null check (created_at = date_trunc('hour', created_at, 'UTC'))
);

-- The answer key is kept apart, so a child device can read a test's questions but never its key.
create table public.test_answer_keys (
  test_id uuid primary key references public.tests on delete cascade,
  family_id uuid not null references public.families on delete cascade,
  answers jsonb not null check (jsonb_typeof(answers) = 'array' and pg_column_size(answers) <= 200000)
);

create table public.test_assignments (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests on delete cascade,
  child_id uuid not null references public.children on delete cascade,
  family_id uuid not null references public.families on delete cascade,
  answers jsonb check (answers is null or (jsonb_typeof(answers) = 'array' and pg_column_size(answers) <= 100000)),
  submitted_at timestamptz,                           -- the child's activity: exact
  score int check (score between 0 and 100),          -- set by the server (scoring: a later step)
  note text check (length(note) <= 500),
  reviewed_by uuid references public.family_members (member_id) on delete set null,
  released_by uuid references public.family_members (member_id) on delete set null,
  released_at timestamptz check (released_at = date_trunc('hour', released_at, 'UTC')),
  unique (test_id, child_id)
);

-- ---------------------------------------------------------------------------
-- Invites, deletion, audit, consent
-- ---------------------------------------------------------------------------
create table public.invites (                         -- deleted when accepted or expired
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('primary', 'parent')),
  family_id uuid references public.families on delete cascade,  -- null for a primary-user invite
  email_hmac bytea not null,                          -- HMAC of the lower-cased email; never the email
  expires_at timestamptz not null,
  check ((kind = 'primary') = (family_id is null)),
  unique nulls not distinct (kind, family_id, email_hmac)
);

create table public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families on delete cascade,
  kind text not null check (kind in ('child', 'family', 'remove_member')),
  target_child_id uuid references public.children on delete cascade,
  target_member_id uuid references public.family_members (member_id) on delete cascade,
  requested_by uuid references public.family_members (member_id) on delete set null,
  approvals uuid[] not null default '{}',             -- member ids
  created_at timestamptz not null check (created_at = date_trunc('hour', created_at, 'UTC')),
  expires_at timestamptz,                             -- child and family requests: 7 days
  execute_after timestamptz,                          -- parent removal: 7 days
  check ((kind = 'child') = (target_child_id is not null)),
  check ((kind = 'remove_member') = (target_member_id is not null)),
  check ((kind = 'remove_member') = (execute_after is not null)),
  check ((kind = 'remove_member') = (expires_at is null))
);
create index deletion_requests_family on public.deletion_requests (family_id);

-- Security audit log: member ids and rounded times only. No names, emails or family ids.
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null check (at = date_trunc('hour', at, 'UTC')),
  action text not null check (action ~ '^[a-z_.]{1,64}$'),
  member_id uuid                                      -- no foreign key: entries outlive the family
);

-- Anonymized proof that a deletion was completed (security-privacy.md §10 F). No ids of any kind.
create table public.deletion_proofs (
  id uuid primary key default gen_random_uuid(),
  completed_on date not null,
  request_type text not null check (request_type in ('child', 'family')),
  channel text not null check (channel in ('app', 'verified_request', 'retention')),
  outcome text not null check (outcome in ('erased'))
);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families on delete set null,  -- null once the family is erased (anonymized)
  member_id uuid,                                     -- null once the family is erased
  notice_version text not null check (notice_version ~ '^[0-9A-Za-z.-]{1,16}$'),
  agreed_on date not null,
  share_anonymous_results boolean not null default false  -- future class rollout; off by default
);

-- ---------------------------------------------------------------------------
-- Admin reference lists (empty in phase 1)
-- ---------------------------------------------------------------------------
create table public.ref_schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120)
);
create table public.ref_grades (
  id uuid primary key default gen_random_uuid(),
  grade int not null unique check (grade between 1 and 12),
  label text not null check (length(label) between 1 and 40)
);
