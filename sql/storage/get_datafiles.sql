SELECT
    file_id,
    file_name,
    tablespace_name,
    ROUND(bytes / 1024 / 1024, 2) AS size_mb,
    ROUND(maxbytes / 1024 / 1024, 2) AS max_size_mb,
    autoextensible,
    status
FROM dba_data_files
ORDER BY tablespace_name, file_id

