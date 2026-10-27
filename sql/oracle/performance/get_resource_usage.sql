SELECT *
FROM (
    SELECT
        s.sid,
        s.serial# AS serial_number,
        s.username,
        s.status,
        s.program,
        p.spid AS process_id,
        ROUND(st.value / 100, 2) AS cpu_seconds,
        ROUND(p.pga_used_mem / 1024 / 1024, 2) AS pga_used_mb
    FROM v$session s
    JOIN v$process p
        ON s.paddr = p.addr
    JOIN v$sesstat st
        ON s.sid = st.sid
    JOIN v$statname sn
        ON st.statistic# = sn.statistic#
    WHERE sn.name = 'CPU used by this session'
      AND s.username IS NOT NULL
    ORDER BY st.value DESC
)
WHERE ROWNUM <= 10
