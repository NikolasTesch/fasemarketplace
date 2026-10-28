BEGIN;
ALTER TABLE business.catalog_product DROP CONSTRAINT catalog_product_icon_name_check;
ALTER TABLE business.catalog_product ADD CONSTRAINT catalog_product_icon_name_check CHECK (icon_name IN (
  'checkroom','sports','sports_soccer','water_bottle','sports_tennis','sprint','apparel',
  'sports_basketball','sports_volleyball','fitness_center','pool','backpack','sports_martial_arts',
  'sports_baseball','sports_football','sports_golf','sports_handball','sports_hockey','sports_rugby',
  'sports_mma','sports_cricket','hiking','directions_bike','skateboarding','sports_gymnastics',
  'product_cap','product_shorts','product_socks'
));
COMMIT;
