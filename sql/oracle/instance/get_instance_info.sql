SELECT
    instance_name,
    host_name,
    version,
    status,
    startup_time,
    ROUND((SYSDATE - startup_time) * 86400) AS uptime_seconds,
    SYS_CONTEXT('USERENV', 'DB_NAME') AS database_name,
    SYS_CONTEXT('USERENV', 'CON_NAME') AS container_name,
    SYS_CONTEXT('USERENV', 'SERVICE_NAME') AS service_name
FROM v$instance