SELECT sql_id,
       sql_text,
       executions,
       total_elapsed_seconds,
       avg_elapsed_seconds
FROM (
    SELECT sql_id,
           MIN(SUBSTR(sql_text, 1, 200)) AS sql_text,
           SUM(executions) AS executions,
           ROUND(SUM(elapsed_time) / 1000000, 3) AS total_elapsed_seconds,
           ROUND(
               SUM(elapsed_time) / NULLIF(SUM(executions), 0) / 1000000,
               6
           ) AS avg_elapsed_seconds
    FROM   v$sql
    GROUP  BY sql_id
    HAVING SUM(executions) > 0
    ORDER  BY SUM(elapsed_time) DESC
)
WHERE ROWNUM <= 10
