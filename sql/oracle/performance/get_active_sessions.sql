SELECT
    sid,
    serial# AS serial_number,
    username,
    status,
    machine,
    program,
    logon_time
FROM v$session
WHERE username IS NOT NULL
  AND status = 'ACTIVE'
ORDER BY username, sid
