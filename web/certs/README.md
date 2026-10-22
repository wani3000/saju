# Supabase PostgreSQL CA

Public CA downloaded from the new project's Database → Settings → SSL configuration on 2026-10-22:

https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

- File SHA-256: `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`
- Certificate expiry: 2031-04-26 10:56:53 UTC.
- This is a public certificate, not a database password or private key.

The private database URL uses `sslmode=verify-full&sslrootcert=certs/supabase-prod-ca-2021.crt`.
The relative path is resolved from the web project working directory; Next.js server traces include this exact file.
Keep certificate and hostname verification enabled. Recheck the official dashboard before a CA rotation.
