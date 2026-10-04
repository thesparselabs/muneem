-- 0003 — a member reads a business's snapshots by id before any business scope is set (GET /sync/bootstrap/{id}).
CREATE POLICY snapshot_member ON snapshot FOR SELECT TO muneem_api, muneem_readonly
  USING (EXISTS (SELECT 1 FROM business_membership m WHERE m.business_id = snapshot.business_id AND m.user_id = current_setting('app.user_id', true)));
