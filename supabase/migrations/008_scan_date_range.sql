-- Add date range columns to scans for incremental fetching
-- date_from: start of the time window (NULL = from the beginning of time)
-- date_to: end of the time window (NULL = no upper bound / "now")
ALTER TABLE scans ADD COLUMN IF NOT EXISTS date_from TIMESTAMPTZ;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS date_to TIMESTAMPTZ;

-- Notify PostgREST to pick up schema changes
NOTIFY pgrst, 'reload schema';
