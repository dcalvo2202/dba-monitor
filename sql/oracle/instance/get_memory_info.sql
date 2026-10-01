SELECT
    (SELECT SUM(value)
     FROM v$sga) AS sga_allocated_bytes,

    (SELECT NVL(SUM(bytes), 0)
     FROM v$sgastat
     WHERE name = 'free memory') AS sga_free_bytes,

    (SELECT value
     FROM v$pgastat
     WHERE name = 'total PGA allocated') AS pga_allocated_bytes,

    (SELECT value
     FROM v$pgastat
     WHERE name = 'total PGA inuse') AS pga_inuse_bytes
FROM dual