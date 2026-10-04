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
