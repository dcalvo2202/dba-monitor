                      SELECT sql_id,
                             sql_text,
                             executions,
                             cpu_time_seconds,
                             elapsed_time_seconds,
                             buffer_gets,
                             disk_reads
                      FROM (
                          SELECT sql_id,
                                 MIN(SUBSTR(sql_text, 1, 200)) AS sql_text,
                                 SUM(executions) AS executions,
                                 ROUND(SUM(cpu_time) / 1000000, 3) AS cpu_time_seconds,
                                 ROUND(SUM(elapsed_time) / 1000000, 3) AS elapsed_time_seconds,
                                 SUM(buffer_gets) AS buffer_gets,
                                 SUM(disk_reads) AS disk_reads
                          FROM   v$sql
                          GROUP  BY sql_id
                          HAVING SUM(executions) > 0
                          ORDER  BY SUM(cpu_time) DESC
                      )
                      WHERE ROWNUM <= 10
