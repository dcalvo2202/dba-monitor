SELECT *
FROM (
    SELECT
        sql_id,
        SUBSTR(sql_text, 1, 200) AS sql_text,
        executions,
        ROUND(elapsed_time / 1000000, 3) AS total_elapsed_seconds,
        ROUND(
            elapsed_time / NULLIF(executions, 0) / 1000000,
            6
        ) AS avg_elapsed_seconds
    FROM v$sql
    WHERE executions > 0
    ORDER BY elapsed_time DESC
)
WHERE ROWNUM <= 10
