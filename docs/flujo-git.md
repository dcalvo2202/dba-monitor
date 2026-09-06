# Flujo de trabajo con Git y GitHub

Este documento define el flujo de trabajo que utilizará el equipo de DBA Monitor.

El objetivo es mantener una rama estable, separar el desarrollo de funcionalidades y conservar un historial que permita identificar claramente los aportes de cada integrante.

---

## 1. Ramas principales

El repositorio utiliza dos ramas principales:

### `main`

Contiene versiones estables del proyecto.

No se debe desarrollar directamente sobre esta rama.

### `develop`

Es la rama de integración del equipo.

Las nuevas funcionalidades se incorporan primero a `develop` mediante Pull Requests.

No se recomienda desarrollar directamente sobre esta rama.

El flujo general es:

```text
feature/...
    |
    v
develop
    |
    v
main
```

---

## 2. Antes de comenzar una funcionalidad

Cambiar a `develop`:

```powershell
git checkout develop
```

Descargar los últimos cambios:

```powershell
git pull origin develop
```

Comprobar que el repositorio esté limpio:

```powershell
git status
```

Se espera:

```text
nothing to commit, working tree clean
```

---

## 3. Crear una rama de trabajo

Cada funcionalidad o corrección debe desarrollarse en su propia rama.

Formato recomendado:

```text
feature/nombre-funcionalidad
```

Ejemplos:

```text
feature/modulo-estado-instancia
feature/monitoreo-rendimiento
feature/gestion-almacenamiento
feature/auditoria-usuarios
```

Crear la rama:

```powershell
git checkout -b feature/nombre-funcionalidad
```

Verificar:

```powershell
git branch
```

El asterisco indica la rama actual:

```text
  main
  develop
* feature/nombre-funcionalidad
```

---

## 4. Realizar cambios y commits

Los commits deben ser pequeños y representar cambios concretos.

Antes de agregar archivos:

```powershell
git status
```

Después:

```powershell
git add archivo1 archivo2
```

o, cuando se haya revisado correctamente todo el contenido:

```powershell
git add .
```

Crear el commit:

```powershell
git commit -m "tipo: descripción del cambio"
```

### Tipos utilizados

```text
feat:      nueva funcionalidad
fix:       corrección de un problema
docs:      documentación
refactor:  reorganización sin cambiar funcionalidad
test:      pruebas
chore:     configuración o mantenimiento del proyecto
```

Ejemplos:

```text
feat: agregar consulta del estado de la instancia

fix: corregir manejo de errores de conexión

docs: documentar configuración local de Oracle

refactor: separar acceso a datos de la lógica del módulo
```

Los mensajes de commits se escribirán en español.

---

## 5. Subir la rama a GitHub

La primera vez que se publica una rama:

```powershell
git push -u origin feature/nombre-funcionalidad
```

Después de establecer el seguimiento remoto, normalmente será suficiente:

```powershell
git push
```

---

## 6. Crear el Pull Request

En GitHub crear un Pull Request utilizando:

```text
base: develop
compare: feature/nombre-funcionalidad
```

Es importante verificar que la rama base sea `develop`.

No se debe crear normalmente un Pull Request directo desde una rama `feature` hacia `main`.

El Pull Request debe explicar brevemente qué incorpora la rama.

Ejemplo:

```text
Se incorpora la configuración inicial de conexión con Oracle:

- lectura de variables de entorno;
- conexión mediante python-oracledb;
- cuenta DBA_MONITOR;
- aplicación inicial del principio de mínimo privilegio;
- consulta básica de V$INSTANCE.
```

---

## 7. Revisión del Pull Request

Cuando sea posible, otro integrante del equipo debe revisar los cambios antes de integrarlos.

La revisión debe comprobar al menos:

- que el código corresponde a la funcionalidad indicada;
- que no existen credenciales o contraseñas;
- que no se incluyen archivos `.env`;
- que las consultas administrativas son comprendidas;
- que los privilegios Oracle están justificados;
- que la estructura del proyecto se mantiene organizada.

El responsable de revisar un módulo debe intentar comprender también su propósito, no solamente confirmar que el código compila.

---

## 8. Integrar el Pull Request

Cuando el Pull Request esté listo, utilizar:

```text
Create a merge commit
```

y posteriormente:

```text
Confirm merge
```

Se prefiere conservar los commits individuales del desarrollo para mantener visible el historial progresivo del proyecto.

No utilizar `Squash and merge` como opción habitual del equipo.

---

## 9. Actualizar `develop` después del merge

Una vez integrado el Pull Request, volver al proyecto local:

```powershell
git checkout develop
```

Actualizar:

```powershell
git pull origin develop
```

Comprobar:

```powershell
git status
```

Se espera:

```text
On branch develop
Your branch is up to date with 'origin/develop'.

nothing to commit, working tree clean
```

---

## 10. Eliminar la rama terminada

Una vez confirmado que la funcionalidad ya está integrada en `develop`, eliminar la rama local:

```powershell
git branch -d feature/nombre-funcionalidad
```

La rama remota puede eliminarse desde GitHub utilizando:

```text
Delete branch
```

o mediante:

```powershell
git push origin --delete feature/nombre-funcionalidad
```

Esto evita acumular ramas que ya no tienen utilidad.

---

## 11. Comenzar la siguiente funcionalidad

Nunca crear una nueva rama a partir de una `feature` anterior.

Primero:

```powershell
git checkout develop
git pull origin develop
```

Después:

```powershell
git checkout -b feature/nueva-funcionalidad
```

De esta manera la nueva rama contiene todos los cambios que ya fueron aprobados e integrados.

---

## 12. Integración hacia `main`

`main` representa una versión estable del proyecto.

Cuando el equipo tenga una versión que desee considerar estable, se realizará un Pull Request:

```text
develop
    |
    v
main
```

No es necesario hacer esto después de cada pequeña funcionalidad.

Ejemplos de posibles versiones estables:

```text
v0.1 - Arquitectura y conexión Oracle
v0.2 - Módulo 1 completo
v0.3 - Módulos 1 y 2
v1.0 - Entrega final
```

---

## 13. Reglas del equipo

1. No desarrollar directamente en `main`.
2. Evitar desarrollar directamente en `develop`.
3. Cada funcionalidad importante debe utilizar una rama `feature/...`.
4. Actualizar `develop` antes de crear una nueva rama.
5. Utilizar commits pequeños y descriptivos.
6. Los mensajes de commit se escribirán en español.
7. No incluir archivos `.env`.
8. No incluir contraseñas, credenciales ni información sensible.
9. Cada integrante debe utilizar su propia cuenta de GitHub.
10. Los Pull Requests deben dirigirse normalmente hacia `develop`.
11. Las ramas terminadas deben eliminarse después de comprobar su integración.
12. Antes de hacer un merge, comprobar que el proyecto sigue funcionando.

---

## 14. Resumen visual

```text
                    ┌─ feature/modulo-instancia ────┐
                    │                                │
                    ├─ feature/almacenamiento ───────┤
                    │                                ▼
main ◄────────── develop ◄──────────────────── Pull Request
                    ▲
                    │
                    └─ feature/rendimiento
```

Para una funcionalidad individual:

```text
develop actualizado
       |
       v
crear feature
       |
       v
programar
       |
       v
commits
       |
       v
push
       |
       v
Pull Request
       |
       v
revisión
       |
       v
merge hacia develop
       |
       v
actualizar develop local
       |
       v
eliminar feature
```