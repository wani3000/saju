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
