SELECT
    owner,
    object_name,
    object_type,
    status,
    last_ddl_time
FROM dba_objects
WHERE owner = 'MAINT_DEMO'
  AND status = 'INVALID'
ORDER BY object_type, object_name