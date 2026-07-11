ALTER TABLE "facturas" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facturas_owner" ON "facturas"
  USING ("batch_id" IN (
    SELECT "id" FROM "batches" WHERE "user_id" = current_setting('app.current_user_id', true)::uuid
  ))
  WITH CHECK ("batch_id" IN (
    SELECT "id" FROM "batches" WHERE "user_id" = current_setting('app.current_user_id', true)::uuid
  ));

ALTER TABLE "factura_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "factura_items_owner" ON "factura_items"
  USING ("factura_id" IN (
    SELECT "f"."id" FROM "facturas" "f"
    INNER JOIN "batches" "b" ON "b"."id" = "f"."batch_id"
    WHERE "b"."user_id" = current_setting('app.current_user_id', true)::uuid
  ))
  WITH CHECK ("factura_id" IN (
    SELECT "f"."id" FROM "facturas" "f"
    INNER JOIN "batches" "b" ON "b"."id" = "f"."batch_id"
    WHERE "b"."user_id" = current_setting('app.current_user_id', true)::uuid
  ));
