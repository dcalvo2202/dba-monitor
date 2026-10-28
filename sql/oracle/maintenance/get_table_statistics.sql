SELECT
    owner,
    table_name,
    num_rows,
    blocks,
    last_analyzed,
    stale_stats
FROM all_tab_statistics
WHERE object_type = 'TABLE'
  AND partition_name IS NULL
ORDER BY owner, table_name

