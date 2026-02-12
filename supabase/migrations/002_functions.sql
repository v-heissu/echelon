-- Function to increment scan progress atomically
CREATE OR REPLACE FUNCTION increment_scan_progress(scan_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE scans
  SET completed_tasks = completed_tasks + 1
  WHERE id = scan_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
