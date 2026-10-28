SELECT
    owner,
    object_name,
    object_type,
    status,
    last_ddl_time
FROM all_objects
WHERE status = 'INVALID'
ORDER BY owner, object_type, object_name