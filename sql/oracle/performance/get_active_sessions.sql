SELECT s.sid,
       s.serial# AS serial_number,
       s.username,
       s.status,
       s.machine,
       s.program,
       s.logon_time
FROM   v$session s
WHERE  s.username IS NOT NULL
AND    s.status = 'ACTIVE'
ORDER  BY s.username, s.sid
