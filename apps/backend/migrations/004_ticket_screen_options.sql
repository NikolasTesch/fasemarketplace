ALTER TABLE support_ticket
  DROP CONSTRAINT support_ticket_screen_check;

ALTER TABLE support_ticket
  ADD CONSTRAINT support_ticket_screen_check CHECK (screen IN (
    'stock', 'orders', 'sync', 'audit', 'analytics', 'movement',
    'catalog', 'users', 'settings', 'diagnostics'
  ));