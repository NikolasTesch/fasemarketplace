-- CreateEnum
CREATE TYPE "inventory_mode" AS ENUM ('SHARED', 'SEPARATE');

-- CreateEnum
CREATE TYPE "inventory_bucket" AS ENUM ('PHYSICAL_RESERVE', 'SHARED_CHANNEL', 'SHOPEE', 'MERCADO_LIVRE');

-- CreateEnum
CREATE TYPE "stock_movement_type" AS ENUM ('OPENING', 'INBOUND', 'OUTBOUND', 'ADJUSTMENT', 'TRANSFER');

-- CreateTable
CREATE TABLE "inventory_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "mode" "inventory_mode" NOT NULL DEFAULT 'SEPARATE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" VARCHAR(128) NOT NULL,

    CONSTRAINT "inventory_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_stock_policy" (
    "variant_id" UUID NOT NULL,
    "minimum_quantity" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" VARCHAR(128) NOT NULL,

    CONSTRAINT "variant_stock_policy_pkey" PRIMARY KEY ("variant_id")
);

-- CreateTable
CREATE TABLE "stock_movement" (
    "id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "movement_type" "stock_movement_type" NOT NULL,
    "source_bucket" "inventory_bucket",
    "destination_bucket" "inventory_bucket",
    "quantity" INTEGER NOT NULL,
    "reason" VARCHAR(500),
    "idempotency_key" VARCHAR(160) NOT NULL,
    "created_by" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_movement_idempotency_key_key" ON "stock_movement"("idempotency_key");

-- CreateIndex
CREATE INDEX "stock_movement_variant_id_created_at_id_idx" ON "stock_movement"("variant_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "stock_movement_movement_type_created_at_idx" ON "stock_movement"("movement_type", "created_at");

-- AddForeignKey
ALTER TABLE "variant_stock_policy" ADD CONSTRAINT "variant_stock_policy_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "catalog_variant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Create the single pilot settings row after the application schema has been selected.
ALTER TABLE business.inventory_settings
  ADD CONSTRAINT inventory_settings_singleton_check CHECK (id = 1),
  ADD CONSTRAINT inventory_settings_version_check CHECK (version > 0);

ALTER TABLE business.variant_stock_policy
  ADD CONSTRAINT variant_stock_policy_minimum_check CHECK (minimum_quantity >= 0),
  ADD CONSTRAINT variant_stock_policy_version_check CHECK (version > 0);

ALTER TABLE business.stock_movement
  ADD CONSTRAINT stock_movement_quantity_check CHECK (quantity > 0),
  ADD CONSTRAINT stock_movement_idempotency_key_check CHECK (length(btrim(idempotency_key)) > 0),
  ADD CONSTRAINT stock_movement_fields_check CHECK (
    (movement_type = 'OPENING' AND source_bucket IS NULL AND destination_bucket = 'PHYSICAL_RESERVE' AND length(btrim(reason)) > 0) OR
    (movement_type = 'INBOUND' AND source_bucket IS NULL AND destination_bucket IS NOT NULL) OR
    (movement_type = 'OUTBOUND' AND source_bucket IS NOT NULL AND destination_bucket IS NULL AND length(btrim(reason)) > 0) OR
    (movement_type = 'ADJUSTMENT' AND (source_bucket IS NULL) <> (destination_bucket IS NULL) AND length(btrim(reason)) > 0) OR
    (movement_type = 'TRANSFER' AND source_bucket IS NOT NULL AND destination_bucket IS NOT NULL AND source_bucket <> destination_bucket)
  );

INSERT INTO business.inventory_settings (id, mode, version, updated_at, updated_by)
VALUES (1, 'SEPARATE', 1, now(), 'system:inventory-schema');

GRANT USAGE ON TYPE business.inventory_mode, business.inventory_bucket, business.stock_movement_type TO fm_business_runtime;
GRANT SELECT ON business.inventory_settings, business.variant_stock_policy, business.stock_movement TO fm_business_runtime;
GRANT UPDATE (mode, version, updated_at, updated_by) ON business.inventory_settings TO fm_business_runtime;
GRANT INSERT, UPDATE (minimum_quantity, version, updated_at, updated_by) ON business.variant_stock_policy TO fm_business_runtime;
GRANT INSERT ON business.stock_movement TO fm_business_runtime;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "catalog_variant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
