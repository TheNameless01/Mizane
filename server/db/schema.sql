-- Schema for Mizan: Wholesaler Credit Ledger & Debt Collection

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS business_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  nif TEXT,
  nis TEXT,
  rc TEXT,
  ai TEXT,
  default_currency TEXT NOT NULL DEFAULT 'DZD',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  credit_limit_centimes INTEGER CHECK (credit_limit_centimes IS NULL OR credit_limit_centimes >= 0),
  payment_terms_days INTEGER NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  sale_number TEXT NOT NULL UNIQUE,
  sold_at TEXT NOT NULL,
  due_date TEXT NOT NULL,
  note TEXT,
  vat_mode TEXT NOT NULL CHECK (vat_mode IN ('none', 'exclusive')),
  subtotal_ht_centimes INTEGER NOT NULL CHECK (subtotal_ht_centimes >= 0),
  vat_total_centimes INTEGER NOT NULL CHECK (vat_total_centimes >= 0),
  total_ttc_centimes INTEGER NOT NULL CHECK (total_ttc_centimes >= 0),
  voided_at TEXT,
  void_reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  label TEXT NOT NULL CHECK (length(label) > 0),
  unit TEXT NOT NULL DEFAULT 'pcs',
  quantity_thousandths INTEGER NOT NULL CHECK (quantity_thousandths > 0),
  unit_price_centimes INTEGER NOT NULL CHECK (unit_price_centimes >= 0),
  vat_rate_bp INTEGER CHECK (vat_rate_bp IS NULL OR vat_rate_bp >= 0),
  line_total_centimes INTEGER NOT NULL CHECK (line_total_centimes >= 0)
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  amount_centimes INTEGER NOT NULL CHECK (amount_centimes > 0),
  paid_at TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('espèces', 'chèque', 'virement', 'autre')),
  reference TEXT,
  note TEXT,
  voided_at TEXT,
  void_reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  amount_centimes INTEGER NOT NULL CHECK (amount_centimes != 0),
  reason TEXT NOT NULL CHECK (reason IN ('Solde initial', 'Remise', 'Perte/Radiation', 'Correction')),
  note TEXT NOT NULL CHECK (length(note) >= 3),
  adjusted_at TEXT NOT NULL,
  voided_at TEXT,
  void_reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  at TEXT NOT NULL,
  details_json TEXT
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  entity TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

-- Indexes for performance and sorting
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_sales_customer_date ON sales(customer_id, sold_at);
CREATE INDEX IF NOT EXISTS idx_sales_due_date ON sales(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_customer_date ON payments(customer_id, paid_at);
CREATE INDEX IF NOT EXISTS idx_adjustments_customer_date ON adjustments(customer_id, adjusted_at);

-- Core Ledger View: Balance is strictly derived from sales + adjustments - payments, excluding voided records
DROP VIEW IF EXISTS customer_balances;
CREATE VIEW customer_balances AS
SELECT
  c.id,
  c.id AS customer_id,
  c.name,
  c.phone,
  c.address,
  c.notes,
  c.credit_limit_centimes,
  c.payment_terms_days,
  c.created_at,
  c.updated_at,
  c.archived_at,
  COALESCE(s.total_sales, 0) AS total_sales_centimes,
  COALESCE(p.total_payments, 0) AS total_payments_centimes,
  COALESCE(a.total_adjustments, 0) AS total_adjustments_centimes,
  (COALESCE(s.total_sales, 0) + COALESCE(a.total_adjustments, 0) - COALESCE(p.total_payments, 0)) AS balance_centimes,
  MAX(COALESCE(s.last_sale_at, ''), COALESCE(p.last_payment_at, ''), COALESCE(a.last_adjustment_at, '')) AS last_activity_at,
  p.last_payment_at
FROM customers c
LEFT JOIN (
  SELECT customer_id, SUM(total_ttc_centimes) AS total_sales, MAX(sold_at) AS last_sale_at
  FROM sales
  WHERE voided_at IS NULL
  GROUP BY customer_id
) s ON s.customer_id = c.id
LEFT JOIN (
  SELECT customer_id, SUM(amount_centimes) AS total_payments, MAX(paid_at) AS last_payment_at
  FROM payments
  WHERE voided_at IS NULL
  GROUP BY customer_id
) p ON p.customer_id = c.id
LEFT JOIN (
  SELECT customer_id, SUM(amount_centimes) AS total_adjustments, MAX(adjusted_at) AS last_adjustment_at
  FROM adjustments
  WHERE voided_at IS NULL
  GROUP BY customer_id
) a ON a.customer_id = c.id;
