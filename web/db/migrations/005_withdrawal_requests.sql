CREATE TABLE withdrawal_requests (
 owner_id uuid PRIMARY KEY REFERENCES accounts(id),
 subject uuid NOT NULL UNIQUE REFERENCES auth_identities(subject),
 stage text NOT NULL DEFAULT 'lookup' CHECK(stage IN ('lookup','kakao_unlink','supabase_delete','complete')),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','running','blocked','unknown','completed')),
 kakao_id text CHECK(kakao_id ~ '^[0-9]{1,30}$'),
 fence integer NOT NULL DEFAULT 0,
 lease_until timestamptz,
 reason text CHECK(reason IN ('CONFIGURATION_REQUIRED','PROVIDER_REJECTED','RESPONSE_UNCERTAIN','IDENTITY_UNAVAILABLE')),
 requested_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 CHECK((stage='complete')=(state='completed')),
 CHECK((state='running')=(lease_until IS NOT NULL))
);
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX withdrawal_requests_pending ON withdrawal_requests(requested_at) WHERE state IN ('pending','blocked');
