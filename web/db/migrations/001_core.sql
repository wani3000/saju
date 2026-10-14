CREATE TABLE IF NOT EXISTS accounts (
 id uuid PRIMARY KEY, kind text NOT NULL DEFAULT 'guest' CHECK(kind IN ('guest','member')),
 recovery_hash text UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, owner_id uuid NOT NULL REFERENCES accounts(id),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days'
);
CREATE TABLE IF NOT EXISTS drafts (
 owner_id uuid PRIMARY KEY REFERENCES accounts(id), data jsonb NOT NULL, revision int NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS comparisons (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES accounts(id), request_key text NOT NULL,
 input_hash text NOT NULL, inputs jsonb NOT NULL, charts jsonb NOT NULL,
 state text NOT NULL CHECK(state IN ('awaiting_payment','queued','processing','ready','failed','cancelled')),
 mode text NOT NULL DEFAULT 'research' CHECK(mode='research'),
 engine_version text NOT NULL, rule_version text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,id), UNIQUE(owner_id,request_key)
);
CREATE TABLE IF NOT EXISTS free_claims (
 owner_id uuid PRIMARY KEY REFERENCES accounts(id), comparison_id uuid,
 state text NOT NULL DEFAULT 'available' CHECK(state IN ('available','reserved','consumed')),
 generation int NOT NULL DEFAULT 0,
 FOREIGN KEY(owner_id,comparison_id) REFERENCES comparisons(owner_id,id)
);
CREATE TABLE IF NOT EXISTS orders (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES accounts(id), comparison_id uuid NOT NULL,
 amount int NOT NULL DEFAULT 2900 CHECK(amount=2900), currency text NOT NULL DEFAULT 'KRW' CHECK(currency='KRW'),
 provider text NOT NULL CHECK(provider IN ('mock','toss-test')),
 state text NOT NULL DEFAULT 'created' CHECK(state IN ('created','confirming','confirmation_unknown','paid','refund_pending','refunded','cancelled')),
 payment_key text UNIQUE, expires_at timestamptz NOT NULL DEFAULT now()+interval '1 day',
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,id), UNIQUE(owner_id,comparison_id),
 FOREIGN KEY(owner_id,comparison_id) REFERENCES comparisons(owner_id,id)
);
CREATE TABLE IF NOT EXISTS entitlements (
 comparison_id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES accounts(id),
 source text NOT NULL CHECK(source IN ('free','paid')), order_id uuid,
 state text NOT NULL CHECK(state IN ('active','revoked')),
 CHECK((source='free' AND order_id IS NULL) OR (source='paid' AND order_id IS NOT NULL)),
 FOREIGN KEY(owner_id,comparison_id) REFERENCES comparisons(owner_id,id),
 FOREIGN KEY(owner_id,order_id) REFERENCES orders(owner_id,id)
);
CREATE TABLE IF NOT EXISTS generation_jobs (
 comparison_id uuid PRIMARY KEY, owner_id uuid NOT NULL,
 state text NOT NULL CHECK(state IN ('queued','running','done','failed','cancelled')),
 attempts int NOT NULL DEFAULT 0, fence int NOT NULL DEFAULT 0, free_generation int,
 lease_until timestamptz, error_code text,
 FOREIGN KEY(owner_id,comparison_id) REFERENCES comparisons(owner_id,id)
);
CREATE TABLE IF NOT EXISTS results (
 comparison_id uuid PRIMARY KEY, owner_id uuid NOT NULL, snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_id,comparison_id),
 FOREIGN KEY(owner_id,comparison_id) REFERENCES comparisons(owner_id,id)
);
CREATE TABLE IF NOT EXISTS shares (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL, comparison_id uuid NOT NULL,
 token_hash text NOT NULL UNIQUE, snapshot jsonb NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days', revoked_at timestamptz,
 FOREIGN KEY(owner_id,comparison_id) REFERENCES results(owner_id,comparison_id)
);
CREATE TABLE IF NOT EXISTS payment_attempts (
 id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES orders(id),
 operation text NOT NULL CHECK(operation IN ('confirm','reconcile','refund')),
 state text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payment_events (
 event_key text PRIMARY KEY, order_id uuid NOT NULL REFERENCES orders(id), processed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mock_payments (
 order_id uuid PRIMARY KEY REFERENCES orders(id), payment_key text NOT NULL UNIQUE,
 amount int NOT NULL CHECK(amount=2900), status text NOT NULL CHECK(status IN ('DONE','CANCELED'))
);
CREATE TABLE IF NOT EXISTS consent_records (
 comparison_id uuid PRIMARY KEY REFERENCES comparisons(id), version text NOT NULL,
 accepted_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rate_limits (
 bucket text PRIMARY KEY, count int NOT NULL, resets_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS comparisons_owner ON comparisons(owner_id,created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_pending ON generation_jobs(state,lease_until);
-- No browser database credentials or anonymous grants: all access is through owner-scoped server services.
