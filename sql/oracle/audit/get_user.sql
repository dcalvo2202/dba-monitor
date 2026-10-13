/*
================================================================================
 Archivo     : sql/oracle/audit/get_user.sql
 Módulo      : 5 - Auditoría
 Propósito   : Obtener la información administrativa de un único usuario.
               El servicio la usa también para comprobar que el usuario existe
               antes de consultar sus roles y privilegios.
 Vistas      : DBA_USERS
 Privilegios : SELECT ON SYS.DBA_USERS

 Parámetros (bind):
   :username  Nombre del usuario en mayúsculas.

 Columnas devueltas:
   username, account_status, authentication_type, created, last_login,
   expiry_date, lock_date, default_tablespace, profile, oracle_maintained
================================================================================
*/
SELECT username,
       account_status,
       authentication_type,
       created,
       last_login,
       expiry_date,
       lock_date,
       default_tablespace,
       profile,
       oracle_maintained
FROM   dba_users
WHERE  username = :username
