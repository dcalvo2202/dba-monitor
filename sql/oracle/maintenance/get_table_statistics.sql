SELECT
    owner,
    table_name,
    num_rows,
    blocks,
    last_analyzed,
    stale_stats
FROM dba_tab_statistics
WHERE owner = 'MAINT_DEMO'
  AND object_type = 'TABLE'
  AND partition_name IS NULL
ORDER BY table_name