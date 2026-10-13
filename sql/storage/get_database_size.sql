SELECT
    ROUND(SUM(bytes) / 1024 / 1024, 2) AS total_mb,
    ROUND(SUM(bytes) / 1024 / 1024 / 1024, 2) AS total_gb
FROM dba_data_files

//Esta consulta no nos muestra los archivos temporales, solo lo que esta denrto del contenedor

