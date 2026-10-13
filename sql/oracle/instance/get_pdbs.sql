SELECT
    name,
    open_mode,
    restricted
FROM v$pdbs
ORDER BY name