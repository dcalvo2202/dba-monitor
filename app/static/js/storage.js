
"use strict";

/*
 * MÓDULO 3 — GESTIÓN DE ALMACENAMIENTO
 * DBA Monitor
 *
 * Este archivo:
 * 1. Consulta los datos de almacenamiento desde FastAPI.
 * 2. Actualiza las tarjetas de resumen.
 * 3. Muestra tablespaces, datafiles y segmentos.
 * 4. Consulta el historial de mediciones.
 * 5. Permite registrar nuevas mediciones.
 *
 * Utiliza los estilos existentes de style.css.
 */

const STORAGE_API = "/api/storage";

// --------------------------------------------------
// 1. FUNCIONES AUXILIARES
// --------------------------------------------------

/**
 * Obtiene un elemento HTML utilizando su ID.
 */
function storageElement(id) {
    return document.getElementById(id);
}

/**
 * Formatea valores numéricos.
 * Ejemplo: 1250.567 -> 1 250,57 aproximadamente,
 * según la configuración regional del navegador.
 */
function storageNumber(value) {
    if (value === null || value === undefined || value === "") {
        return "—";
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "—";
    }

    return number.toLocaleString("es-CR", {
        maximumFractionDigits: 2
    });
}

/**
 * Muestra mensajes informativos o errores.
 */
function storageStatus(message, isError = false) {
    const element = storageElement("status");

    if (!element) {
        return;
    }

    element.textContent = message;

    // Ambas clases ya existen en style.css.
    element.className = isError
        ? "notice"
        : "panel-message";
}

/**
 * Crea una celda de tabla <td>.
 *
 * textContent evita interpretar como HTML
 * los valores que devuelve la base de datos.
 */
function storageCell(row, value, className = "") {
    const cell = document.createElement("td");

    cell.textContent = value === null || value === undefined
        ? "—"
        : String(value);

    if (className) {
        cell.className = className;
    }

    row.appendChild(cell);

    return cell;
}

/**
 * Llena una tabla con registros.
 *
 * id: identificador del tbody.
 * items: arreglo de datos.
 * render: función que construye cada fila.
 */
function storageTable(id, items, render) {
    const body = storageElement(id);

    if (!body) {
        return;
    }

    body.replaceChildren();

    if (!Array.isArray(items) || items.length === 0) {
        const row = document.createElement("tr");

        const cell = storageCell(
            row,
            "No hay registros para mostrar.",
            "table-message"
        );

        cell.colSpan = body
            .closest("table")
            .querySelectorAll("thead th").length;

        body.appendChild(row);
        return;
    }

    items.forEach((item) => {
        const row = document.createElement("tr");

        render(row, item);

        body.appendChild(row);
    });
}

// --------------------------------------------------
// 2. COMUNICACIÓN CON FASTAPI
// --------------------------------------------------

/**
 * Realiza solicitudes HTTP y devuelve JSON.
 *
 * Si FastAPI responde con un error HTTP,
 * se intenta mostrar el detalle del problema.
 */
async function storageRequest(url, options = {}) {
    const response = await fetch(url, options);

    if (!response.ok) {
        let detail = `Error HTTP ${response.status}`;

        try {
            const data = await response.json();

            if (data.detail) {
                detail = typeof data.detail === "string"
                    ? data.detail
                    : JSON.stringify(data.detail);
            }
        } catch (error) {
            // La respuesta podría no contener JSON.
        }

        throw new Error(detail);
    }

    return await response.json();
}

// --------------------------------------------------
// 3. TARJETAS DE RESUMEN
// --------------------------------------------------

/**
 * Actualiza los indicadores principales.
 *
 * GET /api/storage devuelve:
 *
 * {
 *   database_size: {...},
 *   tablespaces: [...],
 *   datafiles: [...],
 *   large_objects: [...]
 * }
 */
function storageRenderSummary(data) {
    const databaseSize = data.database_size || {};

    const tablespaces = Array.isArray(data.tablespaces)
        ? data.tablespaces
        : [];

    const datafiles = Array.isArray(data.datafiles)
        ? data.datafiles
        : [];

    const objects = Array.isArray(data.large_objects)
        ? data.large_objects
        : [];

    // Tamaño de la base de datos.
    storageElement("total-size").textContent =
        databaseSize.total_gb == null
            ? "—"
            : `${storageNumber(databaseSize.total_gb)} GB`;

    // Cantidad de tablespaces.
    storageElement("tablespace-count").textContent =
        tablespaces.length;

    // Cantidad de datafiles.
    storageElement("datafile-count").textContent =
        datafiles.length;

    // Cantidad de objetos devueltos por la consulta.
    // El backend puede limitar la lista a los 20 mayores.
    storageElement("object-count").textContent =
        objects.length;

    // Actualizar tablas.
    storageRenderTablespaces(tablespaces);
    storageRenderDatafiles(datafiles);
    storageRenderObjects(objects);
}

// --------------------------------------------------
// 4. TABLA DE TABLESPACES
// --------------------------------------------------

/**
 * Muestra el espacio utilizado por tablespace.
 *
 * Incluye una barra de progreso que representa
 * el porcentaje de utilización.
 */
function storageRenderTablespaces(tablespaces) {
    storageTable("tablespaces", tablespaces, (row, item) => {
        storageCell(
            row,
            item.tablespace_name,
            "cell-strong"
        );

        storageCell(
            row,
            storageNumber(item.total_mb)
        );

        storageCell(
            row,
            storageNumber(item.used_mb)
        );

        storageCell(
            row,
            storageNumber(item.free_mb)
        );

        // Porcentaje de utilización.
        const rawPercent = Number(item.used_percent);

        const percent = Number.isFinite(rawPercent)
            ? Math.max(0, Math.min(100, rawPercent))
            : 0;

        const cell = storageCell(
            row,
            `${storageNumber(item.used_percent)} %`
        );

        // Barra visual utilizando style.css.
        const track = document.createElement("div");
        track.className = "progress-track";

        track.setAttribute("role", "progressbar");
        track.setAttribute(
            "aria-label",
            `Uso del tablespace ${item.tablespace_name}`
        );
        track.setAttribute("aria-valuemin", "0");
        track.setAttribute("aria-valuemax", "100");
        track.setAttribute("aria-valuenow", String(percent));

        const bar = document.createElement("div");
        bar.className = "progress-bar";
        bar.style.width = `${percent}%`;

        track.appendChild(bar);
        cell.appendChild(track);

        // Advertencia si alcanza el 85 %.
        if (percent >= 85) {
            const warning = document.createElement("span");

            warning.className =
                "table-status state-warning";

            warning.textContent = "Uso alto";

            cell.appendChild(warning);
        }
    });
}

// --------------------------------------------------
// 5. TABLA DE DATAFILES
// --------------------------------------------------

/**
 * Muestra los archivos físicos de almacenamiento.
 */
function storageRenderDatafiles(datafiles) {
    storageTable("datafiles", datafiles, (row, item) => {
        storageCell(row, item.file_id);

        storageCell(
            row,
            item.file_name,
            "cell-note"
        );

        storageCell(
            row,
            item.tablespace_name,
            "cell-strong"
        );

        storageCell(
            row,
            storageNumber(item.size_mb)
        );

        storageCell(
            row,
            item.autoextensible
        );

        storageCell(
            row,
            storageNumber(item.max_size_mb)
        );
    });
}

// --------------------------------------------------
// 6. OBJETOS MÁS GRANDES
// --------------------------------------------------

/**
 * Muestra los segmentos con mayor tamaño.
 */
function storageRenderObjects(objects) {
    storageTable("large-objects", objects, (row, item) => {
        storageCell(row, item.owner);

        storageCell(
            row,
            item.segment_name,
            "cell-strong"
        );

        storageCell(row, item.segment_type);

        storageCell(row, item.tablespace_name);

        storageCell(
            row,
            storageNumber(item.size_mb)
        );
    });
}

// --------------------------------------------------
// 7. HISTORIAL DE ALMACENAMIENTO
// --------------------------------------------------

/**
 * Dibuja los snapshots almacenados en Oracle.
 *
 * GET /api/storage/growth devuelve una lista
 * de mediciones registradas anteriormente.
 */
function storageRenderHistory(history) {
    storageTable("history", history, (row, item) => {
        let dateText = "—";

        if (item.captured_at) {
            const date = new Date(item.captured_at);

            if (!Number.isNaN(date.getTime())) {
                dateText = date.toLocaleString("es-CR");
            }
        }

        storageCell(row, dateText);

        storageCell(
            row,
            item.tablespace_name,
            "cell-strong"
        );

        storageCell(
            row,
            storageNumber(item.total_mb)
        );

        storageCell(
            row,
            storageNumber(item.used_mb)
        );

        storageCell(
            row,
            storageNumber(item.free_mb)
        );
    });
}

// --------------------------------------------------
// 8. ACTUALIZAR INFORMACIÓN
// --------------------------------------------------

// Evita que una consulta antigua sobrescriba
// resultados de una consulta más reciente.
let storageLoadSequence = 0;

/**
 * Consulta la información actual y el historial.
 *
 * Promise.allSettled permite procesar una
 * respuesta aunque la otra falle.
 */
async function storageRefresh() {
    const sequence = ++storageLoadSequence;

    const refreshButton = storageElement("refresh");

    if (refreshButton) {
        refreshButton.disabled = true;
    }

    storageStatus("Consultando almacenamiento Oracle…");

    const results = await Promise.allSettled([
        storageRequest(STORAGE_API),
        storageRequest(`${STORAGE_API}/growth`)
    ]);

    // Ignorar respuestas antiguas.
    if (sequence !== storageLoadSequence) {
        return;
    }

    const errors = [];

    // Resultado del resumen.
    if (results[0].status === "fulfilled") {
        storageRenderSummary(results[0].value);
    } else {
        errors.push(
            `Resumen: ${results[0].reason.message}`
        );
    }

    // Resultado del historial.
    if (
        results[1].status === "fulfilled" &&
        Array.isArray(results[1].value)
    ) {
        storageRenderHistory(results[1].value);
    } else {
        const message = results[1].status === "rejected"
            ? results[1].reason.message
            : "La respuesta del historial no es válida.";

        errors.push(`Historial: ${message}`);
    }

    if (errors.length > 0) {
        storageStatus(errors.join("\n"), true);
    } else {
        storageStatus(
            "Datos actualizados correctamente."
        );
    }

    if (refreshButton) {
        refreshButton.disabled = false;
    }
}

// --------------------------------------------------
// 9. REGISTRAR SNAPSHOT
// --------------------------------------------------

/**
 * Registra una medición en Oracle.
 *
 * POST /api/storage/snapshot
 *
 * Después vuelve a consultar el historial.
 */
async function storageSnapshot() {
    const button = storageElement("snapshot");

    if (button) {
        button.disabled = true;
    }

    storageStatus("Registrando medición…");

    try {
        const result = await storageRequest(
            `${STORAGE_API}/snapshot`,
            {
                method: "POST"
            }
        );

        // Actualizar las tablas y el historial.
        await storageRefresh();

        // Mostrar confirmación solo si la recarga fue exitosa.
        if (!storageElement("status").classList.contains("notice")) {
            storageStatus(
                `${result.message || "Medición registrada."} ` +
                `Filas insertadas: ${result.rows_inserted ?? "—"}.`
            );
        }
    } catch (error) {
        storageStatus(
            `No se pudo registrar la medición: ${error.message}`,
            true
        );
    } finally {
        if (button) {
            button.disabled = false;
        }
    }
}

// --------------------------------------------------
// 10. INICIALIZACIÓN DE LA PÁGINA
// --------------------------------------------------

/**
 * Cuando el navegador termina de construir
 * el documento HTML:
 *
 * 1. Conecta los botones con sus funciones.
 * 2. Carga automáticamente los datos.
 */
document.addEventListener("DOMContentLoaded", () => {
    const refreshButton = storageElement("refresh");
    const snapshotButton = storageElement("snapshot");

    if (refreshButton) {
        refreshButton.addEventListener(
            "click",
            storageRefresh
        );
    }

    if (snapshotButton) {
        snapshotButton.addEventListener(
            "click",
            storageSnapshot
        );
    }

    // Primera consulta automática.
    storageRefresh();
});
