BEGIN;
ALTER TABLE business.catalog_product
  ADD COLUMN icon_name VARCHAR(64) NOT NULL DEFAULT 'sports_soccer';
ALTER TABLE business.catalog_product
  ADD CONSTRAINT catalog_product_icon_name_check CHECK (icon_name IN (
    'checkroom','sports','sports_soccer','water_bottle','sports_tennis','sprint',
    'apparel','sports_basketball','sports_volleyball','fitness_center','pool',
    'backpack','sports_martial_arts'
  ));
GRANT UPDATE (icon_name) ON business.catalog_product TO fm_business_runtime;
COMMIT;