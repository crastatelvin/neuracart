-- Align the original design schema with the LocalMart specification.
-- Existing migrations are immutable; this migration preserves existing rows
-- where possible and backfills values before adding NOT NULL constraints.

-- 1. Canonical enum name (values are unchanged).
ALTER TYPE "ROLE" RENAME TO "Role";

-- 2. User login auditing.
ALTER TABLE "users" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- 3. OTPs store a hash, never the six-digit code.
ALTER TABLE "otp_codes" RENAME COLUMN "code" TO "codeHash";
DROP INDEX "otp_codes_userId_idx";
CREATE INDEX "otp_codes_userId_createdAt_idx" ON "otp_codes"("userId", "createdAt");
CREATE INDEX "otp_codes_expiresAt_idx" ON "otp_codes"("expiresAt");

-- 4. Refresh tokens store a hash, never the JWT itself.
ALTER TABLE "refresh_tokens" RENAME COLUMN "token" TO "tokenHash";
ALTER INDEX "refresh_tokens_token_key" RENAME TO "refresh_tokens_tokenHash_key";

-- 5. Products: default stock and query indexes.
ALTER TABLE "products" ALTER COLUMN "stock" SET DEFAULT 0;
DROP INDEX "products_category_idx";
DROP INDEX "products_isActive_idx";
CREATE INDEX "products_category_isActive_idx" ON "products"("category", "isActive");
CREATE INDEX "products_isFeatured_idx" ON "products"("isFeatured");
CREATE INDEX "products_name_idx" ON "products"("name");

-- 6. Orders: idempotency, bounded text, and composite indexes.
ALTER TABLE "orders"
  ADD COLUMN "idempotencyKey" TEXT,
  ALTER COLUMN "notes" SET DATA TYPE VARCHAR(500),
  ALTER COLUMN "cancelReason" SET DATA TYPE VARCHAR(300);
DROP INDEX "orders_customerId_idx";
DROP INDEX "orders_deliveryPartnerId_idx";
DROP INDEX "orders_status_idx";
CREATE UNIQUE INDEX "orders_idempotencyKey_key" ON "orders"("idempotencyKey");
CREATE INDEX "orders_customerId_createdAt_idx" ON "orders"("customerId", "createdAt");
CREATE INDEX "orders_deliveryPartnerId_status_idx" ON "orders"("deliveryPartnerId", "status");
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt");
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

-- 7. Order items and history: supporting indexes and bounded notes.
CREATE INDEX "order_items_productId_idx" ON "order_items"("productId");
ALTER TABLE "order_status_history" ALTER COLUMN "note" SET DATA TYPE VARCHAR(300);
DROP INDEX "order_status_history_orderId_idx";
CREATE INDEX "order_status_history_orderId_createdAt_idx" ON "order_status_history"("orderId", "createdAt");

-- 8. Tracking: align field names and store longitude with the real store.
ALTER TABLE "order_tracking"
  RENAME COLUMN "partnerLatitude" TO "latitude";
ALTER TABLE "order_tracking"
  RENAME COLUMN "partnerLongitude" TO "longitude";
ALTER TABLE "order_tracking" ALTER COLUMN "storeLongitude" SET DEFAULT 77.5946;
ALTER TABLE "order_tracking" ALTER COLUMN "updatedAt" DROP DEFAULT;
UPDATE "order_tracking" SET "storeLongitude" = 77.5946 WHERE "storeLongitude" = 12.9716;

-- 9. Delivery partners: payout ledger, required vehicle number, availability index.
UPDATE "delivery_partners" SET "vehicleNumber" = 'KA-01-AA-0000' WHERE "vehicleNumber" IS NULL;
ALTER TABLE "delivery_partners"
  ADD COLUMN "earnings" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ALTER COLUMN "vehicleType" SET DEFAULT 'BIKE',
  ALTER COLUMN "vehicleNumber" SET NOT NULL;
CREATE INDEX "delivery_partners_isAvailable_isVerified_idx" ON "delivery_partners"("isAvailable", "isVerified");

-- 10. Store singleton: plural table name, full address, contact and fee fields.
ALTER TABLE "store" RENAME TO "stores";
ALTER TABLE "stores" RENAME CONSTRAINT "store_pkey" TO "stores_pkey";
ALTER TABLE "stores"
  ADD COLUMN "city" TEXT NOT NULL DEFAULT 'Bengaluru',
  ADD COLUMN "state" TEXT NOT NULL DEFAULT 'Karnataka',
  ADD COLUMN "pincode" TEXT NOT NULL DEFAULT '560001',
  ADD COLUMN "deliveryFee" DECIMAL(10,2) NOT NULL DEFAULT 40,
  ADD COLUMN "freeDeliveryAbove" DECIMAL(10,2) NOT NULL DEFAULT 500,
  ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "stores"
SET
  "name" = CASE WHEN "name" = 'Local Cart' THEN 'LocalMart Central' ELSE "name" END,
  "phone" = COALESCE("phone", '+91 80 4000 1234'),
  "email" = COALESCE("email", 'store@localmart.app'),
  "updatedAt" = CURRENT_TIMESTAMP;
ALTER TABLE "stores"
  ALTER COLUMN "name" SET DEFAULT 'LocalMart Central',
  ALTER COLUMN "latitude" SET DEFAULT 12.9716,
  ALTER COLUMN "longitude" SET DEFAULT 77.5946,
  ALTER COLUMN "phone" SET NOT NULL,
  ALTER COLUMN "email" SET NOT NULL,
  ALTER COLUMN "updatedAt" SET NOT NULL;

-- 11. Enforce at most one default address per customer at the database level.
CREATE UNIQUE INDEX "addresses_one_default_per_user"
  ON "addresses"("userId")
  WHERE "isDefault" = true;
