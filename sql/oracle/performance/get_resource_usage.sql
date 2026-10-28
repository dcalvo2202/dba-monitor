SELECT sid,
       serial_number,
       username,
       status,
       program,
       process_id,
       cpu_seconds,
       pga_used_mb
FROM (
    SELECT s.sid,
           s.serial# AS serial_number,
           s.username,
           s.status,
           s.program,
           p.spid AS process_id,
           ROUND(st.value / 100, 2) AS cpu_seconds,
           ROUND(p.pga_used_mem / 1024 / 1024, 2) AS pga_used_mb
    FROM   v$session s
    JOIN   v$process p
           ON p.addr = s.paddr
    JOIN   v$sesstat st
           ON st.sid = s.sid
    JOIN   v$statname sn
           ON sn.statistic# = st.statistic#
    WHERE  sn.name = 'CPU used by this session'
    AND    s.username IS NOT NULL
    ORDER  BY st.value DESC
)
WHERE ROWNUM <= 10
