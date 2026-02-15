-- Tag-scan junction table for tracking tag frequency per scan (sparkline data)
CREATE TABLE IF NOT EXISTS tag_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(tag_id, scan_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_tag_scans_tag_id ON tag_scans(tag_id);
CREATE INDEX IF NOT EXISTS idx_tag_scans_scan_id ON tag_scans(scan_id);
