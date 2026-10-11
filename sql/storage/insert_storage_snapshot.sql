INSERT INTO dba_monitor_storage_snapshot (
    tablespace_name,
    total_bytes,
    used_bytes,
    free_bytes
)
SELECT
    df.tablespace_name,
    df.total_bytes,
    df.total_bytes - NVL(fs.free_bytes, 0),
    NVL(fs.free_bytes, 0)
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