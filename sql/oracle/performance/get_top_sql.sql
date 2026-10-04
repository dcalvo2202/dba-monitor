SELECT *
                      FROM (
                          SELECT
                              sql_id,
                              SUBSTR(sql_text, 1, 200) AS sql_text,
                              executions,
                              ROUND(cpu_time / 1000000, 3) AS cpu_time_seconds,
                              ROUND(elapsed_time / 1000000, 3) AS elapsed_time_seconds,
                              buffer_gets,
                              disk_reads
                          FROM v$sql
                          WHERE executions > 0
                          ORDER BY cpu_time DESC
                      )
                      WHERE ROWNUM <= 10
