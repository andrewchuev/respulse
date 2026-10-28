-- Retention deletes by age across all monitors, which the (monitor_id, checked_at) index cannot serve.
CREATE INDEX IF NOT EXISTS idx_check_results_checked_at ON check_results(checked_at);
