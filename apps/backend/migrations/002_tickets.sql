CREATE TABLE support_ticket_image (
  storage_key text PRIMARY KEY CHECK (char_length(storage_key) BETWEEN 1 AND 255),
  image_bytes bytea NOT NULL CHECK (octet_length(image_bytes) BETWEEN 1 AND 5242880),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_ticket (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('bug', 'improvement')),
  screen text NOT NULL CHECK (screen IN (
    'stock', 'orders', 'sync', 'audit', 'analytics', 'movement', 'diagnostics'
  )),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 4000),
  status text NOT NULL DEFAULT 'open' CHECK (status = 'open'),
  author_id text NOT NULL REFERENCES auth_user(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  image_storage_provider text,
  image_storage_key text,
  image_mime text,
  CONSTRAINT support_ticket_image_pair CHECK (
    (image_storage_provider IS NULL AND image_storage_key IS NULL AND image_mime IS NULL) OR
    (image_storage_provider IS NOT NULL AND image_storage_key IS NOT NULL AND image_mime IS NOT NULL)
  ),
  CONSTRAINT support_ticket_image_provider CHECK (
    image_storage_provider IS NULL OR image_storage_provider IN ('postgres', 'cloudflare-r2')
  ),
  CONSTRAINT support_ticket_image_key CHECK (
    image_storage_key IS NULL OR char_length(image_storage_key) BETWEEN 1 AND 255
  ),
  CONSTRAINT support_ticket_image_mime CHECK (
    image_mime IS NULL OR image_mime IN ('image/png', 'image/jpeg', 'image/webp')
  )
);

CREATE INDEX support_ticket_created_id_idx
  ON support_ticket (created_at DESC, id DESC);
