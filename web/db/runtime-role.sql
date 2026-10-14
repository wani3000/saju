-- Run with a migration owner, after db:migrate. Attach a dedicated server login to
-- this NOLOGIN role using your database provider's secret management UI.
-- Browser/anon/authenticated roles must not receive these privileges.
CREATE ROLE saju_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO saju_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO saju_runtime;
REVOKE ALL ON schema_migrations FROM saju_runtime;
GRANT SELECT ON schema_migrations TO saju_runtime;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO saju_runtime;
-- Reapply table grants after future migrations. Keep the migration owner and
-- runtime login separate. No database credential is exposed to a browser.

-- RLS keeps anon/authenticated roles denied even if a host grants table privileges.
CREATE POLICY saju_server_access ON accounts TO saju_runtime USING (true) WITH CHECK (true);
CREATE POLICY saju_server_access ON sessions TO saju_runtime USING (true) WITH CHECK (true);
CREATE POLICY saju_server_access ON drafts TO saju_runtime USING (true) WITH CHECK (true);
CREATE POLICY saju_server_access ON comparisons TO saju_runtime USING (true) WITH CHECK (true);
CREATE POLICY saju_server_access ON free_claims TO saju_runtime USING (true) WITH CHECK (true);
CREATE POLICY saju_server_access ON orders TO saju_runtime USING (true) WITH CHECK (true);
CREATE POLICY saju_server_access ON entitlements TO saju_runtime USING (true) WITH CHECK (true);
CREATE POLICY saju_server_access ON generation_jobs TO saju_runtime USING (true) WITH CHECK (true);
CREATE POLICY saju_server_access ON results TO saju_runtime USING (true) WITH CHECK (true);
CREATE POLICY saju_server_access ON shares TO saju_runtime USING (true) WITH CHECK (true);
CREATE POLICY saju_server_access ON payment_attempts TO saju_runtime USING (true) WITH CHECK (true);
CREATE POLICY saju_server_access ON payment_events TO saju_runtime USING (true) WITH CHECK (true);
CREATE POLICY saju_server_access ON mock_payments TO saju_runtime USING (true) WITH CHECK (true);
CREATE POLICY saju_server_access ON consent_records TO saju_runtime USING (true) WITH CHECK (true);
CREATE POLICY saju_server_access ON rate_limits TO saju_runtime USING (true) WITH CHECK (true);
CREATE POLICY saju_server_access ON auth_identities TO saju_runtime USING (true) WITH CHECK (true);
CREATE POLICY saju_server_access ON oauth_attempts TO saju_runtime USING (true) WITH CHECK (true);
CREATE POLICY saju_server_access ON merge_tickets TO saju_runtime USING (true) WITH CHECK (true);
CREATE POLICY saju_server_access ON operational_events TO saju_runtime USING (true) WITH CHECK (true);
CREATE POLICY saju_server_access ON nicepay_attempts TO saju_runtime USING (true) WITH CHECK (true);
CREATE POLICY saju_server_access ON schema_migrations TO saju_runtime USING (true) WITH CHECK (true);
