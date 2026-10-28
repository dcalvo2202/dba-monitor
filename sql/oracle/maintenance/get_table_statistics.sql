SELECT
    USER AS owner,
    table_name,
    num_rows,
    blocks,
    last_analyzed,
    stale_stats
FROM user_tab_statistics
WHERE object_type = 'TABLE'
  AND partition_name IS NULL
ORDER BY table_name