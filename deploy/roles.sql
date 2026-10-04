-- The production login role the API connects as (ADR-0051). It inherits muneem_api, so row-level security applies,
-- and owns nothing. Run as the owner role after migrate-up (migration 0001 creates muneem_api), with the password from
-- MUNEEM_APP_DB_PASSWORD (deploy.sh does this on every deploy):
--   MUNEEM_APP_DB_PASSWORD=... psql "$MUNEEM_OWNER_DATABASE_URL" -f roles.sql
-- Idempotent: it creates the role once and resets its password on every run. -v app_role / -v app_password override.
\set QUIET on
\set ON_ERROR_STOP on
SET client_min_messages = warning;
\if :{?app_role}
\else
  \set app_role muneem_app
\endif
\if :{?app_password}
\else
  \getenv app_password MUNEEM_APP_DB_PASSWORD
\endif
\if :{?app_password}
\else
  \set app_password ''
\endif
SELECT length(:'app_password') >= 24 AS password_ok \gset
\if :password_ok
\else
  DO $$ BEGIN RAISE EXCEPTION 'MUNEEM_APP_DB_PASSWORD must be at least 24 characters'; END $$;
\endif
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'app_role', :'app_password')
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_role') \gexec
SELECT format('ALTER ROLE %I WITH LOGIN NOCREATEDB NOCREATEROLE PASSWORD %L', :'app_role', :'app_password') \gexec
SELECT format('GRANT muneem_api TO %I', :'app_role') \gexec

-- The operator tooling's login role (ADR-0057), only when MUNEEM_ADMIN_DB_PASSWORD is set: it inherits muneem_admin
-- (migration 0009), which reads across shops through its own policies and writes only dead-letter resolutions and
-- admin.* audit rows. Without the password the role is not created and the API serves no admin listener.
\getenv admin_password MUNEEM_ADMIN_DB_PASSWORD
\if :{?admin_password}
\else
  \set admin_password ''
\endif
SELECT length(:'admin_password') > 0 AS admin_wanted, length(:'admin_password') >= 24 AS admin_ok \gset
\if :admin_wanted
  \if :admin_ok
  \else
    DO $$ BEGIN RAISE EXCEPTION 'MUNEEM_ADMIN_DB_PASSWORD must be at least 24 characters'; END $$;
  \endif
  SELECT format('CREATE ROLE muneem_admin_app LOGIN PASSWORD %L', :'admin_password')
    WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'muneem_admin_app') \gexec
  SELECT format('ALTER ROLE muneem_admin_app WITH LOGIN NOCREATEDB NOCREATEROLE PASSWORD %L', :'admin_password') \gexec
  GRANT muneem_admin TO muneem_admin_app;
\endif
