BEGIN;
ALTER TABLE business.catalog_product
  ADD COLUMN sale_price DECIMAL(12,2),
  ADD COLUMN cost DECIMAL(12,2);
ALTER TABLE business.catalog_product
  ADD CONSTRAINT catalog_product_price_check CHECK (sale_price IS NULL OR sale_price >= 0),
  ADD CONSTRAINT catalog_product_cost_check CHECK (cost IS NULL OR cost >= 0);
GRANT UPDATE (sale_price, cost) ON business.catalog_product TO fm_business_runtime;
COMMIT;