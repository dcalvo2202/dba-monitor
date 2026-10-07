SELECT
    snapshot_id,
    captured_at,
    tablespace_name,
    ROUND(total_bytes / 1024 / 1024, 2) AS total_mb,
    ROUND(used_bytes / 1024 / 1024, 2) AS used_mb,
    ROUND(free_bytes / 1024 / 1024, 2) AS free_mb
FROM dba_monitor_storage_snapshot
ORDER BY captured_at DESC, tablespace_name