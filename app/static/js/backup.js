/*
 * Módulo 4 - Respaldo y recuperación.
 *
 * Carga /api/backup y dibuja:
 *   - Tarjetas de resumen (riesgo, último respaldo, modo de archivado, FRA).
 *   - La interpretación de riesgo con cada hallazgo explicado.
 *   - El último respaldo exitoso y la configuración de recuperación.
 *   - Dos gráficos (resultado de los trabajos y tamaño de cada respaldo).
 *   - El historial de trabajos RMAN.
 *
 * Depende de common.js (setText, fetchJson, createElement...) y de
 * charts.js (DbaCharts). Todo dato que viene de Oracle se escribe con
 * textContent, nunca con innerHTML.
 */

const BACKUP_API = "/api/backup";

// Nivel general de la evaluación: texto visible y clase de color.
const LEVEL_DISPLAY = {
    OK: { text: "Bajo", state: "state-ok" },
    ADVERTENCIA: { text: "Medio", state: "state-warning" },
    CRITICO: { text: "Alto", state: "state-error" },
    // Desde una PDB Oracle no muestra el historial RMAN: no hay evaluación.
    SIN_DATOS: { text: "Sin datos", state: "state-neutral" }
};

// Etiqueta y color de cada hallazgo de la evaluación.
const FINDING_DISPLAY = {
    CRITICO: { text: "Crítico", state: "state-error" },
    ADVERTENCIA: { text: "Advertencia", state: "state-warning" },
    OK: { text: "Correcto", state: "state-ok" },
    INFO: { text: "Info", state: "state-neutral" }
};

// Color del estado de cada trabajo RMAN (campo "state" de la API).
const JOB_STATE_CLASS = {
    ok: "state-ok",
    warning: "state-warning",
    error: "state-error",
    running: "state-neutral"
};

const HISTORY_COLUMNS = 8;

// Descarta respuestas viejas si se pidió otra carga mientras tanto.
let backupLoadSequence = 0;

// Última respuesta dibujada; evita redibujar si nada cambió (la
// actualización automática no debe mover la lectura del usuario).
let lastRenderedSnapshot = null;


/* ------------------------------------------------------------------ */
/* Formato                                                             */
/* ------------------------------------------------------------------ */

/**
 * Tamaño legible a partir de megabytes: "850,3 MB" o "2,41 GB".
 * @param {number|null} megabytes
 * @returns {string}
 */
function formatSize(megabytes) {
    if (megabytes === null || megabytes === undefined) {
        return "—";
    }

    if (megabytes >= 1024) {
        return `${(megabytes / 1024).toLocaleString("es-CR", { maximumFractionDigits: 2 })} GB`;
    }

    return `${megabytes.toLocaleString("es-CR", { maximumFractionDigits: 1 })} MB`;
}

/**
 * Fecha corta para etiquetas de gráficos: "13/10 14:05".
 * @param {string|null} value - Fecha ISO de la API.
 */
function formatShortDate(value) {
    if (!value) {
        return "—";
    }

    return new Date(value).toLocaleString("es-CR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

/**
 * Crea una insignia de estado (clase table-status de style.css).
 * @param {string} text
 * @param {string} stateClass - state-ok, state-warning, state-error...
 */
function createBadge(text, stateClass) {
    return createElement("span", { className: `table-status ${stateClass}`, text });
}


/* ------------------------------------------------------------------ */
/* Tarjetas de resumen                                                 */
/* ------------------------------------------------------------------ */

function renderSummary(data) {
    // Riesgo general.
    const level = LEVEL_DISPLAY[data.assessment.level] ?? LEVEL_DISPLAY.ADVERTENCIA;
    setText("summary-risk", level.text);
    setStateClass(document.getElementById("summary-risk"), level.state);
    setText("summary-risk-detail", data.assessment.summary);

    // Último respaldo exitoso de la base completa.
    const lastDatabase = data.last_backup.database;

    if (lastDatabase) {
        setText("summary-last-backup", lastDatabase.age_label);
        setText(
            "summary-last-backup-detail",
            `${lastDatabase.type_label} · ${formatDate(lastDatabase.end_time)}`
        );
    } else if (data.assessment.level === "SIN_DATOS") {
        setText("summary-last-backup", "No visible");
        setText("summary-last-backup-detail", "Disponible desde el perfil CDB$ROOT");
    } else {
        setText("summary-last-backup", "Ninguno");
        setText("summary-last-backup-detail", "No hay respaldos exitosos de la base");
    }

    // Modo de archivado.
    const isArchivelog = data.log_mode === "ARCHIVELOG";
    setText("summary-log-mode", data.log_mode);
    setStateClass(
        document.getElementById("summary-log-mode"),
        isArchivelog ? "state-ok" : "state-warning"
    );
    setText(
        "summary-log-mode-detail",
        isArchivelog
            ? "Recuperación hasta el último cambio"
            : "Recuperación solo hasta el último respaldo"
    );

    // Fast Recovery Area.
    const fra = data.recovery_area;

    if (fra) {
        setText("summary-fra", `${fra.usage_percent.toLocaleString("es-CR")} %`);
        setText("summary-fra-detail", `${formatSize(fra.used_mb)} de ${formatSize(fra.limit_mb)}`);
    } else {
        setText("summary-fra", "No visible");
        setText(
            "summary-fra-detail",
            data.container_name === "CDB$ROOT"
                ? "No hay FRA configurada"
                : "Disponible desde el perfil CDB$ROOT"
        );
    }
}


/* ------------------------------------------------------------------ */
/* Interpretación de riesgo                                            */
/* ------------------------------------------------------------------ */

function renderAssessment(assessment) {
    setText("assessment-summary", assessment.summary);

    const items = assessment.findings.map((finding) => {
        const display = FINDING_DISPLAY[finding.level] ?? FINDING_DISPLAY.INFO;
        const item = document.createElement("li");

        item.append(
            createBadge(display.text, display.state),
            createElement("span", { text: finding.message })
        );

        return item;
    });

    document.getElementById("assessment-findings").replaceChildren(...items);
}


/* ------------------------------------------------------------------ */
/* Último respaldo y configuración                                     */
/* ------------------------------------------------------------------ */

function renderLastBackups(lastBackup, noData) {
    const database = lastBackup.database;
    const archivelog = lastBackup.archivelog;
    const missing = noData ? "No visible desde este contenedor" : "Sin respaldos exitosos";

    setText("last-db-type", database?.type_label);
    setText("last-db-end", database ? `${formatDate(database.end_time)} (${database.age_label})` : missing);
    setText("last-db-duration", database?.duration);
    setText("last-db-size", database ? formatSize(database.output_mb) : "—");

    setText("last-arch-end", archivelog ? `${formatDate(archivelog.end_time)} (${archivelog.age_label})` : missing);
    setText("last-arch-size", archivelog ? formatSize(archivelog.output_mb) : "—");
}

function renderRecoveryConfig(data) {
    const fra = data.recovery_area;

    setText("config-database", data.database_name);
    setText("config-container", data.container_name);
    setText("config-log-mode", data.log_mode);
    setText("config-fra-path", fra?.path ?? "No visible desde este contenedor");
    setText("config-fra-limit", fra ? formatSize(fra.limit_mb) : "—");
    setText("config-fra-reclaimable", fra ? formatSize(fra.reclaimable_mb) : "—");
    setText("config-fra-files", fra?.files);

    // Barra de uso: el porcentaje ya descuenta el espacio recuperable.
    const bar = document.getElementById("fra-progress");
    const percent = fra ? Math.min(100, Math.max(0, fra.usage_percent)) : 0;

    bar.style.width = `${percent}%`;
    bar.setAttribute("aria-valuenow", percent.toFixed(1));
    setText("fra-percent", fra ? `${fra.usage_percent.toLocaleString("es-CR")} %` : "—%");
}


/* ------------------------------------------------------------------ */
/* Gráficos                                                            */
/* ------------------------------------------------------------------ */

function renderCharts(data) {
    if (!window.DbaCharts) {
        return;
    }

    const summary = data.summary;

    // Partes de un todo: resultado de los trabajos del historial.
    window.DbaCharts.renderStackedBar(document.getElementById("jobs-result-chart"), {
        segments: [
            { label: "Completados", value: summary.completed },
            { label: "Con advertencias", value: summary.warnings },
            { label: "Fallidos", value: summary.failed },
            { label: "En ejecución", value: summary.running }
        ].filter((segment) => segment.value > 0),
        ariaLabel: "Resultado de los trabajos de respaldo del historial",
        formatValue: (value) => `${value} trabajo(s)`,
        emptyMessage: "No hay trabajos de respaldo registrados."
    });

    // Comparación de magnitudes: tamaño generado por cada trabajo.
    window.DbaCharts.renderBarChart(document.getElementById("backup-size-chart"), {
        items: data.jobs.map((job) => ({
            label: `${job.type_label} · ${formatShortDate(job.start_time)}`,
            value: job.output_mb ?? 0
        })),
        ariaLabel: "Tamaño generado por cada respaldo, en megabytes",
        formatValue: formatSize,
        emptyMessage: "Ningún respaldo generó archivos."
    });
}

function renderChartMessage(id, message) {
    document.getElementById(id).replaceChildren(
        createElement("p", { className: "viz-empty", text: message })
    );
}


/* ------------------------------------------------------------------ */
/* Historial                                                           */
/* ------------------------------------------------------------------ */

function renderHistory(data) {
    const tableBody = document.getElementById("history-table-body");
    const summary = data.summary;

    setText(
        "history-description",
        `${summary.shown} trabajo(s): ${summary.completed} completado(s), `
        + `${summary.warnings} con advertencias y ${summary.failed} fallido(s).`
    );

    // Aviso si la API recortó el historial (parámetro max_rows).
    const truncated = document.getElementById("history-truncated");
    truncated.hidden = summary.total_jobs <= summary.shown;
    truncated.textContent = `Se muestran los ${summary.shown} trabajos más recientes de ${summary.total_jobs}.`;

    if (data.jobs.length === 0) {
        renderTableMessage(
            tableBody,
            HISTORY_COLUMNS,
            data.assessment.level === "SIN_DATOS"
                ? `Oracle no muestra el historial RMAN desde ${data.container_name}. Seleccione el perfil CDB$ROOT.`
                : "No hay respaldos RMAN registrados en el archivo de control."
        );
        return;
    }

    const rows = data.jobs.map((job) => {
        const row = document.createElement("tr");

        const statusCell = document.createElement("td");
        statusCell.appendChild(createBadge(job.status_label, JOB_STATE_CLASS[job.state] ?? "state-neutral"));

        row.append(
            createElement("td", { text: formatDate(job.start_time) }),
            createElement("td", { className: "cell-strong", text: job.type_label }),
            statusCell,
            createElement("td", { text: job.duration }),
            createElement("td", { text: formatSize(job.input_mb) }),
            createElement("td", { text: formatSize(job.output_mb) }),
            createElement("td", {
                text: job.compression_ratio
                    ? `${job.compression_ratio.toLocaleString("es-CR")} : 1`
                    : "—"
            }),
            createElement("td", { text: job.device })
        );

        return row;
    });

    tableBody.replaceChildren(...rows);
}


/* ------------------------------------------------------------------ */
/* Carga de datos                                                      */
/* ------------------------------------------------------------------ */

/** Muestra el error de la API en todas las secciones del módulo. */
function renderLoadError(message) {
    lastRenderedSnapshot = null;

    ["summary-risk", "summary-last-backup", "summary-log-mode", "summary-fra"].forEach((id) => {
        setText(id, "—");
        setStateClass(document.getElementById(id), "state-neutral");
    });
    setText("summary-risk-detail", "Sin datos: la consulta falló");

    setText("assessment-summary", message);
    document.getElementById("assessment-findings").replaceChildren();

    renderChartMessage("jobs-result-chart", message);
    renderChartMessage("backup-size-chart", message);
    renderTableMessage(document.getElementById("history-table-body"), HISTORY_COLUMNS, message);
}

async function loadBackupData() {
    const sequence = ++backupLoadSequence;

    setConnectionState("is-loading", "Actualizando...");
    setRefreshState(true);

    try {
        const data = await fetchJson(BACKUP_API);

        // Una carga posterior ya está en curso: sus datos son los vigentes.
        if (sequence !== backupLoadSequence) {
            return;
        }

        // checked_at cambia en cada consulta; no cuenta como cambio real.
        const snapshot = JSON.stringify({ ...data, checked_at: null });

        if (snapshot !== lastRenderedSnapshot) {
            lastRenderedSnapshot = snapshot;

            renderSummary(data);
            renderAssessment(data.assessment);
            renderLastBackups(data.last_backup, data.assessment.level === "SIN_DATOS");
            renderRecoveryConfig(data);
            renderCharts(data);
            renderHistory(data);
        }

        setConnectionState("is-ok", "Conectado");
        updateLastUpdatedTime();

    } catch (error) {
        if (sequence !== backupLoadSequence) {
            return;
        }

        console.error("No se pudo obtener el estado de los respaldos:", error);
        setConnectionState("is-error", "Sin conexión");
        renderLoadError(error.message);

    } finally {
        if (sequence === backupLoadSequence) {
            setRefreshState(false);
        }
    }
}


/* ------------------------------------------------------------------ */
/* Inicialización                                                      */
/* ------------------------------------------------------------------ */

document.addEventListener("DOMContentLoaded", () => {
    // Un clic mientras hay una carga en curso se ignora (el botón está
    // marcado con aria-disabled, que no impide el clic por sí mismo).
    document.getElementById("refresh-button").addEventListener("click", () => {
        if (!isRefreshBusy()) {
            loadBackupData();
        }
    });

    loadBackupData();
});
