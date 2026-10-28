/**
 * Módulo 6 - Mantenimiento Preventivo
 * DBA Monitor
 *
 * Funcionalidades:
 * - Consultar estadísticas de tablas.
 * - Consultar objetos inválidos.
 * - Actualizar estadísticas.
 * - Recompilar objetos.
 * - Mostrar resultados y confirmaciones.
 */

const MAINTENANCE_API = "/api/maintenance";

const maintenanceState = {
    tables: [],
    invalidObjects: [],
    lastOperation: "—",
    busy: false
};

const SUPPORTED_OBJECT_TYPES = new Set([
    "PROCEDURE",
    "FUNCTION",
    "PACKAGE",
    "PACKAGE BODY",
    "TRIGGER",
    "VIEW"
]);


// ==========================================
// UTILIDADES
// ==========================================

function maintenanceElement(id) {
    return document.getElementById(id);
}

function maintenanceSetText(id, value) {
    const element = maintenanceElement(id);

    if (element) {
        element.textContent = value ?? "—";
    }
}

function maintenanceFormatDate(value) {
    if (!value) {
        return "Sin analizar";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("es-CR");
}

function maintenanceShowMessage(message, isError = false) {
    const element = maintenanceElement(
        "maintenance-operation-result"
    );

    if (!element) {
        return;
    }

    element.textContent = message;
    element.classList.toggle("state-warning", isError);
}

function maintenanceSetStatus(message) {
    maintenanceSetText("maintenance-status", message);
}

async function maintenanceRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            typeof data.detail === "string"
                ? data.detail
                : `Error HTTP ${response.status}`
        );
    }

    return data;
}

function maintenanceCreateCell(text) {
    const cell = document.createElement("td");
    cell.textContent = text ?? "—";
    return cell;
}

function maintenanceEmptyRow(colspan, message) {
    const row = document.createElement("tr");
    const cell = maintenanceCreateCell(message);

    cell.colSpan = colspan;
    row.appendChild(cell);

    return row;
}


// ==========================================
// CARGAR ESTADÍSTICAS
// ==========================================

async function maintenanceLoadStatistics() {
    const data = await maintenanceRequest(
        `${MAINTENANCE_API}/statistics`
    );

    maintenanceState.tables = data.tables || [];

    maintenanceSetText(
        "maintenance-total-tables",
        maintenanceState.tables.length
    );

    const staleCount = maintenanceState.tables.filter(
        table => table.stale_stats === "YES"
    ).length;

    maintenanceSetText(
        "maintenance-stale-stats",
        staleCount
    );

    maintenanceRenderStatistics();
}

function maintenanceRenderStatistics() {
    const tbody = maintenanceElement(
        "maintenance-statistics-body"
    );

    if (!tbody) {
        return;
    }

    tbody.replaceChildren();

    if (maintenanceState.tables.length === 0) {
        tbody.appendChild(
            maintenanceEmptyRow(
                7,
                "No se encontraron estadísticas de tablas."
            )
        );
        return;
    }

    for (const table of maintenanceState.tables) {
        const row = document.createElement("tr");

        row.appendChild(
            maintenanceCreateCell(table.owner)
        );

        row.appendChild(
            maintenanceCreateCell(table.table_name)
        );

        row.appendChild(
            maintenanceCreateCell(table.num_rows)
        );

        row.appendChild(
            maintenanceCreateCell(table.blocks)
        );

        row.appendChild(
            maintenanceCreateCell(
                maintenanceFormatDate(table.last_analyzed)
            )
        );

        const status = table.stale_stats === "YES"
            ? "Desactualizadas"
            : table.last_analyzed
                ? "Actualizadas"
                : "Sin analizar";

        row.appendChild(
            maintenanceCreateCell(status)
        );

        const actionCell = document.createElement("td");
        const button = document.createElement("button");

        button.type = "button";
        button.className = "refresh-button";
        button.textContent = "Actualizar";
        button.disabled = maintenanceState.busy;

        button.addEventListener("click", () => {
            maintenanceUpdateStatistics(
                table.owner,
                table.table_name
            );
        });

        actionCell.appendChild(button);
        row.appendChild(actionCell);

        tbody.appendChild(row);
    }
}


// ==========================================
// CARGAR OBJETOS INVÁLIDOS
// ==========================================

async function maintenanceLoadInvalidObjects() {
    const data = await maintenanceRequest(
        `${MAINTENANCE_API}/invalid-objects`
    );

    maintenanceState.invalidObjects = data.objects || [];

    maintenanceSetText(
        "maintenance-invalid-count",
        maintenanceState.invalidObjects.length
    );

    maintenanceRenderInvalidObjects();
}

function maintenanceRenderInvalidObjects() {
    const tbody = maintenanceElement(
        "maintenance-invalid-body"
    );

    if (!tbody) {
        return;
    }

    tbody.replaceChildren();

    if (maintenanceState.invalidObjects.length === 0) {
        tbody.appendChild(
            maintenanceEmptyRow(
                6,
                "No se encontraron objetos inválidos."
            )
        );
        return;
    }

    for (const object of maintenanceState.invalidObjects) {
        const row = document.createElement("tr");

        row.appendChild(
            maintenanceCreateCell(object.owner)
        );

        row.appendChild(
            maintenanceCreateCell(object.object_name)
        );

        row.appendChild(
            maintenanceCreateCell(object.object_type)
        );

        row.appendChild(
            maintenanceCreateCell(object.status)
        );

        row.appendChild(
            maintenanceCreateCell(
                maintenanceFormatDate(object.last_ddl_time)
            )
        );

        const actionCell = document.createElement("td");

        if (SUPPORTED_OBJECT_TYPES.has(object.object_type)) {
            const button = document.createElement("button");

            button.type = "button";
            button.className = "refresh-button";
            button.textContent = "Recompilar";
            button.disabled = maintenanceState.busy;

            button.addEventListener("click", () => {
                maintenanceRecompileObject(
                    object.owner,
                    object.object_name,
                    object.object_type
                );
            });

            actionCell.appendChild(button);
        } else {
            actionCell.textContent = "No disponible";
        }

        row.appendChild(actionCell);
        tbody.appendChild(row);
    }
}


// ==========================================
// ACTUALIZAR ESTADÍSTICAS
// ==========================================

async function maintenanceUpdateStatistics(owner, tableName) {
    if (maintenanceState.busy) {
        return;
    }

    const confirmed = window.confirm(
        `¿Deseas actualizar las estadísticas de ${owner}.${tableName}?`
    );

    if (!confirmed) {
        return;
    }

    maintenanceState.busy = true;
    maintenanceSetStatus("Actualizando estadísticas...");
    maintenanceRenderStatistics();
    maintenanceRenderInvalidObjects();

    try {
        const result = await maintenanceRequest(
            `${MAINTENANCE_API}/update-statistics`,
            {
                method: "POST",
                body: JSON.stringify({
                    owner,
                    table_name: tableName,
                    confirm: true
                })
            }
        );

        maintenanceState.lastOperation = result.success
            ? "Exitosa"
            : "Con observaciones";

        maintenanceSetText(
            "maintenance-last-operation",
            maintenanceState.lastOperation
        );

        maintenanceShowMessage(result.message);

        await maintenanceRefresh();

    } catch (error) {
        maintenanceState.lastOperation = "Error";

        maintenanceSetText(
            "maintenance-last-operation",
            "Error"
        );

        maintenanceShowMessage(error.message, true);
        maintenanceSetStatus("Error al actualizar estadísticas.");

    } finally {
        maintenanceState.busy = false;
        maintenanceRenderStatistics();
        maintenanceRenderInvalidObjects();
    }
}


// ==========================================
// RECOMPILAR OBJETOS
// ==========================================

async function maintenanceRecompileObject(
    owner,
    objectName,
    objectType
) {
    if (maintenanceState.busy) {
        return;
    }

    const confirmed = window.confirm(
        `¿Deseas recompilar ${owner}.${objectName} (${objectType})?`
    );

    if (!confirmed) {
        return;
    }

    maintenanceState.busy = true;
    maintenanceSetStatus("Recompilando objeto...");
    maintenanceRenderStatistics();
    maintenanceRenderInvalidObjects();

    try {
        const result = await maintenanceRequest(
            `${MAINTENANCE_API}/recompile`,
            {
                method: "POST",
                body: JSON.stringify({
                    owner,
                    object_name: objectName,
                    object_type: objectType,
                    confirm: true
                })
            }
        );

        maintenanceState.lastOperation = result.success
            ? "Exitosa"
            : "Con observaciones";

        maintenanceSetText(
            "maintenance-last-operation",
            maintenanceState.lastOperation
        );

        maintenanceShowMessage(result.message, !result.success);

        await maintenanceRefresh();

    } catch (error) {
        maintenanceState.lastOperation = "Error";

        maintenanceSetText(
            "maintenance-last-operation",
            "Error"
        );

        maintenanceShowMessage(error.message, true);
        maintenanceSetStatus("Error al recompilar el objeto.");

    } finally {
        maintenanceState.busy = false;
        maintenanceRenderStatistics();
        maintenanceRenderInvalidObjects();
    }
}


// ==========================================
// ACTUALIZAR PANEL
// ==========================================

async function maintenanceRefresh() {
    maintenanceSetStatus("Consultando información de Oracle...");

    const results = await Promise.allSettled([
        maintenanceLoadStatistics(),
        maintenanceLoadInvalidObjects()
    ]);

    const errors = results
        .filter(result => result.status === "rejected")
        .map(result => result.reason.message);

    if (errors.length > 0) {
        maintenanceSetStatus(
            "No fue posible cargar toda la información."
        );

        maintenanceShowMessage(
            errors.join(" | "),
            true
        );

        return;
    }

    maintenanceSetStatus(
        "Información de mantenimiento actualizada."
    );
}


// ==========================================
// INICIALIZACIÓN
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    maintenanceRefresh();

    const refreshButton = maintenanceElement("refresh-button");

    if (refreshButton) {
        refreshButton.addEventListener(
            "click",
            maintenanceRefresh
        );
    }
});