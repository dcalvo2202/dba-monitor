SELECT
    s.sid,
    s.serial# AS serial_number,
    s.username,
    s.status,
    s.machine,
    s.program,
    s.blocking_session,
    s.event,
    s.seconds_in_wait
FROM v$session s
WHERE s.blocking_session IS NOT NULL
ORDER BY s.seconds_in_wait DESC
