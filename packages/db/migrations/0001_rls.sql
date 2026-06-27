ALTER TABLE "sii_credentials" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sii_credentials_owner" ON "sii_credentials"
  USING ("user_id" = current_setting('app.current_user_id', true)::uuid)
  WITH CHECK ("user_id" = current_setting('app.current_user_id', true)::uuid);

ALTER TABLE "batches" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batches_owner" ON "batches"
  USING ("user_id" = current_setting('app.current_user_id', true)::uuid)
  WITH CHECK ("user_id" = current_setting('app.current_user_id', true)::uuid);

ALTER TABLE "boletas" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "boletas_owner" ON "boletas"
  USING ("batch_id" IN (
    SELECT "id" FROM "batches" WHERE "user_id" = current_setting('app.current_user_id', true)::uuid
  ))
  WITH CHECK ("batch_id" IN (
    SELECT "id" FROM "batches" WHERE "user_id" = current_setting('app.current_user_id', true)::uuid
  ));
