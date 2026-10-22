ALTER TABLE auth_identities ADD COLUMN display_name text;
ALTER TABLE auth_identities ADD COLUMN avatar_url text;
ALTER TABLE sessions ADD COLUMN auth_subject uuid REFERENCES auth_identities(subject);
CREATE INDEX sessions_auth_subject ON sessions(auth_subject) WHERE auth_subject IS NOT NULL;
