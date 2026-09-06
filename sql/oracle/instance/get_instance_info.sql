SELECT
    instance_name,
    host_name,
    version,
    status,
    startup_time,
    ROUND((SYSDATE - startup_time) * 86400) AS uptime_seconds
FROM v$instance