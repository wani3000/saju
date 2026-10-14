ALTER TABLE accounts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES accounts(id);
CREATE TABLE IF NOT EXISTS auth_identities (
 subject uuid PRIMARY KEY, owner_id uuid NOT NULL UNIQUE REFERENCES accounts(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS oauth_attempts (
 token_hash text PRIMARY KEY, owner_id uuid NOT NULL REFERENCES accounts(id), expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes', used_at timestamptz
);
CREATE TABLE IF NOT EXISTS merge_tickets (
 token_hash text PRIMARY KEY, source_id uuid NOT NULL REFERENCES accounts(id), target_id uuid NOT NULL REFERENCES accounts(id), expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes', used_at timestamptz
);
CREATE TABLE IF NOT EXISTS operational_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, kind text NOT NULL, outcome text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shares_expiry ON shares(expires_at);
ALTER TABLE free_claims ALTER CONSTRAINT free_claims_owner_id_comparison_id_fkey DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE orders ALTER CONSTRAINT orders_owner_id_comparison_id_fkey DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE entitlements ALTER CONSTRAINT entitlements_owner_id_comparison_id_fkey DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE entitlements ALTER CONSTRAINT entitlements_owner_id_order_id_fkey DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE generation_jobs ALTER CONSTRAINT generation_jobs_owner_id_comparison_id_fkey DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE results ALTER CONSTRAINT results_owner_id_comparison_id_fkey DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE shares ALTER CONSTRAINT shares_owner_id_comparison_id_fkey DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE orders DROP CONSTRAINT orders_provider_check;
ALTER TABLE orders ADD CONSTRAINT orders_provider_check CHECK(provider IN ('mock','toss-test','nicepay-test'));
CREATE TABLE nicepay_attempts (
 order_id uuid PRIMARY KEY REFERENCES orders(id), return_hash text NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '20 minutes'
);
