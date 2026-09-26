DROP TABLE IF EXISTS audit_log CASCADE;
DROP FUNCTION IF EXISTS audit_log_append_only();
DROP TABLE IF EXISTS entitlement, refresh_token, device, terminal, branch, business_membership, business, organization_member, app_user, organization CASCADE;
