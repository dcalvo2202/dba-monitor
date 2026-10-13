SELECT
    df.tablespace_name,
    ROUND(df.total_bytes / 1024 / 1024, 2) AS total_mb,
    ROUND((df.total_bytes - NVL(fs.free_bytes, 0)) / 1024 / 1024, 2) AS used_mb,
    ROUND(NVL(fs.free_bytes, 0) / 1024 / 1024, 2) AS free_mb,
    ROUND(
        (df.total_bytes - NVL(fs.free_bytes, 0))
        / NULLIF(df.total_bytes, 0) * 100,
        2
    ) AS used_percent
FROM (
    SELECT
        tablespace_name,
        SUM(bytes) AS total_bytes
    FROM dba_data_files
    GROUP BY tablespace_name
) df
LEFT JOIN (
    SELECT
        tablespace_name,
        SUM(bytes) AS free_bytes
    FROM dba_free_space
    GROUP BY tablespace_name
) fs
    ON df.tablespace_name = fs.tablespace_name
ORDER BY used_percent DESC


