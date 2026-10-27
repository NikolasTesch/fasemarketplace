BEGIN;
-- CreateTable
CREATE TABLE "business"."catalog_product" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(2000) NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" VARCHAR(128) NOT NULL,
    "updated_by" VARCHAR(128) NOT NULL,

    CONSTRAINT "catalog_product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business"."catalog_variant" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "sku" VARCHAR(64) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" VARCHAR(128) NOT NULL,
    "updated_by" VARCHAR(128) NOT NULL,

    CONSTRAINT "catalog_variant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "catalog_product_created_at_id_idx" ON "business"."catalog_product"("created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_variant_sku_key" ON "business"."catalog_variant"("sku");

-- CreateIndex
CREATE INDEX "catalog_variant_product_id_created_at_id_idx" ON "business"."catalog_variant"("product_id", "created_at", "id");

-- AddForeignKey
ALTER TABLE "business"."catalog_variant" ADD CONSTRAINT "catalog_variant_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "business"."catalog_product"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE business.catalog_product ADD CONSTRAINT catalog_product_fields_check
  CHECK (length(btrim(name)) > 0 AND version > 0);
ALTER TABLE business.catalog_variant ADD CONSTRAINT catalog_variant_fields_check
  CHECK (length(btrim(name)) > 0 AND version > 0 AND sku ~ '^[A-Z0-9][A-Z0-9._-]{0,63}$');

GRANT SELECT, INSERT ON business.catalog_product, business.catalog_variant TO fm_business_runtime;
GRANT UPDATE (name, description, active, version, updated_at, updated_by) ON business.catalog_product TO fm_business_runtime;
GRANT UPDATE (name, active, version, updated_at, updated_by) ON business.catalog_variant TO fm_business_runtime;
COMMIT;
