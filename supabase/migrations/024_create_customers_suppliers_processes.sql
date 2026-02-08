-- Customers
CREATE TABLE IF NOT EXISTS parameter_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parameter_customers_active ON parameter_customers (is_active);
CREATE INDEX IF NOT EXISTS idx_parameter_customers_sort ON parameter_customers (sort_order);

-- Suppliers
CREATE TABLE IF NOT EXISTS parameter_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parameter_suppliers_active ON parameter_suppliers (is_active);
CREATE INDEX IF NOT EXISTS idx_parameter_suppliers_sort ON parameter_suppliers (sort_order);

-- Welding processes
CREATE TABLE IF NOT EXISTS parameter_welding_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parameter_welding_processes_active ON parameter_welding_processes (is_active);
CREATE INDEX IF NOT EXISTS idx_parameter_welding_processes_sort ON parameter_welding_processes (sort_order);

INSERT INTO parameter_welding_processes (label, sort_order)
VALUES
  ('111 - Elektrodesveis', 1),
  ('131 - MIG-sveis kompakttråd', 2),
  ('135 - MAG-sveis kompakttråd', 3),
  ('136 - MAG-sveis flussfylt-tråd', 4),
  ('138 - MAG-sveis pulverfylt-tråd', 5),
  ('141 - TIG-sveis med tilsett', 6)
ON CONFLICT (label) DO NOTHING;
