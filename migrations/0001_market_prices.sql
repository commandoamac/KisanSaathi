CREATE TABLE IF NOT EXISTS markets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  district TEXT NOT NULL,
  state TEXT NOT NULL,
  lat REAL,
  lng REAL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)),
  CHECK (lng IS NULL OR (lng >= -180 AND lng <= 180))
);

CREATE INDEX IF NOT EXISTS markets_district_idx ON markets (district COLLATE NOCASE);
CREATE UNIQUE INDEX IF NOT EXISTS markets_name_location_idx
  ON markets (name COLLATE NOCASE, district COLLATE NOCASE, state COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS crops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS reporters (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('trader', 'shopkeeper')),
  verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
  display_name TEXT NOT NULL,
  is_sample INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0, 1)),
  token_hash TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS price_reports (
  id TEXT PRIMARY KEY,
  crop_id TEXT NOT NULL REFERENCES crops(id),
  market_id TEXT NOT NULL REFERENCES markets(id),
  price_per_quintal REAL NOT NULL CHECK (price_per_quintal > 0),
  reporter_id TEXT NOT NULL REFERENCES reporters(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS price_reports_crop_market_date_idx
  ON price_reports (crop_id, market_id, created_at);

CREATE INDEX IF NOT EXISTS price_reports_reporter_crop_market_date_idx
  ON price_reports (reporter_id, crop_id, market_id, created_at);

INSERT OR IGNORE INTO crops (id, name) VALUES
  ('tomato', 'Tomato'),
  ('onion', 'Onion'),
  ('potato', 'Potato'),
  ('wheat', 'Wheat'),
  ('paddy', 'Paddy');
