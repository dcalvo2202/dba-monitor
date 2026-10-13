/*
 * Módulo 3 - Gestión del almacenamiento.
 *
 * Carga /api/storage y dibuja:
 *   - Tarjetas de resumen (tamaño, tablespaces, archivos, crecimiento).
 *   - Dos gráficos (uso de tablespaces y objetos de mayor tamaño).
 *   - Tablas de tablespaces, historial de crecimiento, archivos de datos y
 *     objetos de mayor tamaño.
 * El botón «Registrar medición» llama a POST /api/storage/snapshot.
 *
 * Depende de common.js (setText, fetchJson, createElement...) y de
 * charts.js (DbaCharts). Todo dato que viene de Oracle se escribe con
 * textContent, nunca con innerHTML.
 */

const STORAGE_API = "/api/storage";

// Color de cada estado de tablespace (campo "state" de la API).
const TABLESPACE_STATE = {
    ok: { text: "Normal", state: "state-ok" },
    warning: { text: "Advertencia", state: "state-warning" },
    critical: { text: "Crítico", state: "state-error" }
};

// Descarta respuestas viejas si se pidió otra carga mientras tanto.
let storageLoadSequence = 0;

// Última respuesta dibujada; evita redibujar si nada cambió (la
// actualización automática no debe mover la lectura del usuario).
let lastStorageSnapshot = null;


/* ------------------------------------------------------------------ */
/* Formato                                                             */
/* ------------------------------------------------------------------ */

/**
 * Tamaño legible a partir de megabytes: "850,3 MB" o "2,41 GB".
 * @param {number|null} megabytes
 */
function formatSize(megabytes) {
    if (megabytes === null || megabytes === undefined) {
        return "—";
    }

    if (Math.abs(megabytes) >= 1024) {
        return `${(megabytes / 1024).toLocaleString("es-CR", { maximumFractionDigits: 2 })} GB`;
    }

    return `${megabytes.toLocaleString("es-CR", { maximumFractionDigits: 1 })} MB`;
}

/** Porcentaje con un decimal: "63,5 %". */
function formatPercent(value) {
    if (value === null || value === undefined) {
        return "—";
    }

    return `${value.toLocaleString("es-CR", { maximumFractionDigits: 1 })} %`;
}

/** Diferencia con signo: "+12,4 MB" o "−3 MB". */
function formatDelta(megabytes) {
    if (megabytes === null || megabytes === undefined) {
        return "—";
    }

    const sign = megabytes > 0 ? "+" : megabytes < 0 ? "−" : "";
    return `${sign}${formatSize(Math.abs(megabytes))}`;
}

function createBadge(text, stateClass) {
    return createElement("span", { className: `table-status ${stateClass}`, text });
}

/** Celda con una barra de progreso y su porcentaje. */
function createUsageCell(percent, label) {
    const cell = document.createElement("td");
    const safe = Math.min(100, Math.max(0, percent ?? 0));

    const track = createElement("div", { className: "progress-track" });
    const bar = createElement("div", { className: "progress-bar" });

    bar.style.width = `${safe}%`;
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-label", label);
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.setAttribute("aria-valuenow", safe.toFixed(1));

    track.appendChild(bar);
    cell.append(createElement("span", { text: formatPercent(percent) }), track);

    return cell;
}


/* ------------------------------------------------------------------ */
/* Tarjetas de resumen                                                 */
/* ------------------------------------------------------------------ */

function renderSummary(data) {
    const size = data.database_size;

    setText("summary-size", formatSize(size.allocated_mb));
    setText(
        "summary-size-detail",
        `${formatSize(size.used_mb)} usados por objetos · ${size.container_name}`
    );

    // Tablespaces: estado según las alertas de los permanentes.
    const { warning, critical } = data.alerts;
    const badge = document.getElementById("summary-tablespaces");

    if (critical > 0) {
        setText("summary-tablespaces", `${critical} crítico(s)`);
        setStateClass(badge, "state-error");
    } else if (warning > 0) {
        setText("summary-tablespaces", `${warning} en advertencia`);
        setStateClass(badge, "state-warning");
    } else {
        setText("summary-tablespaces", "Normal");
        setStateClass(badge, "state-ok");
    }

    setText("summary-tablespaces-detail", `${data.tablespaces.length} tablespaces en ${size.container_name}`);

    const autoextensible = data.datafiles.filter((file) => file.autoextensible).length;
    setText("summary-datafiles", data.datafiles.length);
    setText("summary-datafiles-detail", `${autoextensible} autoextensible(s)`);

    // Crecimiento: solo si hay al menos dos mediciones para comparar.
    const comparison = data.growth.comparison;

    if (comparison) {
        setText("summary-growth", formatDelta(comparison.growth_mb));
        setText(
            "summary-growth-detail",
            `En ${comparison.days.toLocaleString("es-CR")} días`
            + (comparison.mb_per_day !== null ? ` · ${formatDelta(comparison.mb_per_day)}/día` : "")
        );
    } else {
        setText("summary-growth", "—");
        setText(
            "summary-growth-detail",
            data.growth.available ? "Faltan mediciones para comparar" : "Historial no disponible"
        );
    }
}


/* ------------------------------------------------------------------ */
/* Gráficos                                                            */
/* ------------------------------------------------------------------ */

function renderCharts(data) {
    if (!window.DbaCharts) {
        return;
    }

    window.DbaCharts.renderBarChart(document.getElementById("tablespace-chart"), {
        items: data.tablespaces.map((tablespace) => ({
            label: tablespace.tablespace_name,
            value: tablespace.used_mb ?? 0
        })),
        ariaLabel: "Espacio usado por cada tablespace, en megabytes",
        formatValue: formatSize,
        emptyMessage: "No hay tablespaces para mostrar."
    });

    window.DbaCharts.renderBarChart(document.getElementById("objects-chart"), {
        items: data.large_objects.map((object) => ({
            label: `${object.owner}.${object.segment_name}`,
            value: object.size_mb ?? 0
        })),
        ariaLabel: "Objetos que más almacenamiento ocupan, en megabytes",
        formatValue: formatSize,
        emptyMessage: "Sin objetos para mostrar con el filtro actual."
    });
}

function renderChartMessage(id, message) {
    document.getElementById(id).replaceChildren(
        createElement("p", { className: "viz-empty", text: message })
    );
}


/* ------------------------------------------------------------------ */
/* Tablas                                                              */
/* ------------------------------------------------------------------ */

function renderTablespaces(tablespaces) {
    const body = document.getElementById("tablespaces-table-body");

    if (tablespaces.length === 0) {
        renderTableMessage(body, 8, "No hay tablespaces visibles.");
        return;
    }

    body.replaceChildren(...tablespaces.map((tablespace) => {
        const row = document.createElement("tr");
        const display = TABLESPACE_STATE[tablespace.state] ?? TABLESPACE_STATE.ok;

        const stateCell = document.createElement("td");
        stateCell.appendChild(createBadge(display.text, display.state));

        row.append(
            createElement("td", { className: "cell-strong", text: tablespace.tablespace_name }),
            createElement("td", { text: tablespace.contents_label }),
            createElement("td", { text: formatSize(tablespace.used_mb) }),
            createElement("td", { text: formatSize(tablespace.free_mb) }),
            createElement("td", { text: formatSize(tablespace.total_mb) }),
            createElement("td", {
                text: formatSize(tablespace.max_mb),
                title: tablespace.autoextensible ? "Puede crecer por autoextensión" : "No es autoextensible"
            }),
            createUsageCell(tablespace.max_used_percent, `Uso del tablespace ${tablespace.tablespace_name}`),
            stateCell
        );

        return row;
    }));
}

function renderGrowth(growth) {
    const message = document.getElementById("growth-message");
    const comparisonList = document.getElementById("growth-comparison");
    const body = document.getElementById("history-table-body");

    message.textContent = growth.message ?? "";
    message.hidden = !growth.message;

    // Comparación entre la primera y la última medición.
    const comparison = growth.comparison;
    comparisonList.hidden = !comparison;

    if (comparison) {
        setText("growth-period", `${formatDate(comparison.from)} → ${formatDate(comparison.to)} (${comparison.days.toLocaleString("es-CR")} días)`);
        setText("growth-used", `${formatSize(comparison.used_from_mb)} → ${formatSize(comparison.used_to_mb)}`);
        setText(
            "growth-total",
            `${formatDelta(comparison.growth_mb)}`
            + (comparison.growth_percent !== null ? ` (${formatPercent(comparison.growth_percent)})` : "")
        );
        // El servicio solo calcula el ritmo con al menos un día entre mediciones.
        const hasRate = comparison.mb_per_day !== null;

        setText(
            "growth-rate",
            hasRate
                ? `${formatDelta(comparison.mb_per_day)} por día`
                : "Requiere al menos un día de historial"
        );

        let fullText = "No aplica: la base no está creciendo";
        if (!hasRate) {
            fullText = "—";
        } else if (comparison.days_to_full !== null) {
            fullText = `unos ${comparison.days_to_full.toLocaleString("es-CR")} días al ritmo actual`;
        }
        setText("growth-full", fullText);
    }

    if (!growth.available || growth.snapshots.length === 0) {
        renderTableMessage(body, 4, growth.available ? "Todavía no hay mediciones." : growth.message);
        return;
    }

    // Más reciente primero; el cambio se calcula contra la medición anterior.
    const rows = growth.snapshots.map((snapshot, index) => {
        const previous = growth.snapshots[index - 1];
        const row = document.createElement("tr");

        row.append(
            createElement("td", { text: formatDate(snapshot.captured_at) }),
            createElement("td", { text: formatSize(snapshot.used_mb) }),
            createElement("td", { text: formatSize(snapshot.total_mb) }),
            createElement("td", {
                text: previous ? formatDelta(snapshot.used_mb - previous.used_mb) : "Primera medición"
            })
        );

        return row;
    });

    body.replaceChildren(...rows.reverse());
}

function renderDatafiles(datafiles) {
    const body = document.getElementById("datafiles-table-body");

    if (datafiles.length === 0) {
        renderTableMessage(body, 8, "No hay archivos de datos visibles.");
        return;
    }

    body.replaceChildren(...datafiles.map((file) => {
        const row = document.createElement("tr");

        const autoextendCell = document.createElement("td");
        autoextendCell.appendChild(createBadge(
            file.autoextensible ? "Sí" : "No",
            file.autoextensible ? "state-ok" : "state-neutral"
        ));

        row.append(
            createElement("td", { className: "cell-note", text: file.file_name }),
            createElement("td", { className: "cell-strong", text: file.tablespace_name }),
            createElement("td", { text: file.file_type === "TEMPORAL" ? "Temporal" : "Datos" }),
            createElement("td", { text: formatSize(file.size_mb) }),
            createElement("td", { text: formatSize(file.max_mb) }),
            autoextendCell,
            createElement("td", { text: file.autoextensible ? formatSize(file.increment_mb) : "—" }),
            createElement("td", { text: file.status })
        );

        return row;
    }));
}

function renderObjects(objects) {
    const body = document.getElementById("objects-table-body");

    if (objects.length === 0) {
        renderTableMessage(
            body,
            6,
            document.getElementById("include-oracle").checked
                ? "No hay objetos para mostrar."
                : "No hay objetos de aplicaciones en este contenedor. Marque «Incluir objetos internos de Oracle» para ver los del sistema."
        );
        return;
    }

    body.replaceChildren(...objects.map((object) => {
        const row = document.createElement("tr");
        const name = object.partition_name
            ? `${object.segment_name} (${object.partition_name})`
            : object.segment_name;

        row.append(
            createElement("td", { text: object.owner }),
            createElement("td", { className: "cell-strong", text: name }),
            createElement("td", { text: object.segment_type }),
            createElement("td", { text: object.tablespace_name }),
            createElement("td", { text: formatSize(object.size_mb) }),
            createElement("td", { text: object.extents })
        );

        return row;
    }));
}


/* ------------------------------------------------------------------ */
/* Carga de datos                                                      */
/* ------------------------------------------------------------------ */

function renderLoadError(message) {
    lastStorageSnapshot = null;

    ["summary-size", "summary-tablespaces", "summary-datafiles", "summary-growth"].forEach((id) => {
        setText(id, "—");
        setStateClass(document.getElementById(id), "state-neutral");
    });
    setText("summary-size-detail", "Sin datos: la consulta falló");

    renderChartMessage("tablespace-chart", message);
    renderChartMessage("objects-chart", message);
    renderTableMessage(document.getElementById("tablespaces-table-body"), 8, message);
    renderTableMessage(document.getElementById("history-table-body"), 4, message);
    renderTableMessage(document.getElementById("datafiles-table-body"), 8, message);
    renderTableMessage(document.getElementById("objects-table-body"), 6, message);
}

function renderStorage(data) {
    renderSummary(data);
    renderCharts(data);
    renderTablespaces(data.tablespaces);
    renderGrowth(data.growth);
    renderDatafiles(data.datafiles);
    renderObjects(data.large_objects);
}

async function loadStorageData() {
    const includeOracle = document.getElementById("include-oracle").checked;
    const sequence = ++storageLoadSequence;

    setConnectionState("is-loading", "Actualizando...");
    setRefreshState(true);

    try {
        const data = await fetchJson(`${STORAGE_API}?include_oracle=${includeOracle}`);

        // Una carga posterior ya está en curso: sus datos son los vigentes.
        if (sequence !== storageLoadSequence) {
            return;
        }

        const snapshot = JSON.stringify(data);

        if (snapshot !== lastStorageSnapshot) {
            lastStorageSnapshot = snapshot;
            renderStorage(data);
        }

        setConnectionState("is-ok", "Conectado");
        updateLastUpdatedTime();

    } catch (error) {
        if (sequence !== storageLoadSequence) {
            return;
        }

        console.error("No se pudo obtener el almacenamiento:", error);
        setConnectionState("is-error", "Sin conexión");
        renderLoadError(error.message);

    } finally {
        if (sequence === storageLoadSequence) {
            setRefreshState(false);
        }
    }
}

/**
 * Registra una medición en el historial (POST /api/storage/snapshot) y
 * vuelve a cargar el módulo para mostrarla.
 */
async function recordSnapshot() {
    const button = document.getElementById("snapshot-button");
    const message = document.getElementById("growth-message");

    // aria-disabled en lugar de disabled: el botón conserva el foco.
    if (button.getAttribute("aria-disabled") === "true") {
        return;
    }

    button.setAttribute("aria-disabled", "true");
    button.textContent = "Registrando...";

    try {
        const response = await fetch(`${STORAGE_API}/snapshot`, { method: "POST" });
        const body = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(typeof body?.detail === "string" ? body.detail : `Error HTTP ${response.status}`);
        }

        await loadStorageData();
        announce(body.message);

    } catch (error) {
        message.hidden = false;
        message.textContent = `No se pudo registrar la medición: ${error.message}`;
        announce(message.textContent);

    } finally {
        button.setAttribute("aria-disabled", "false");
        button.textContent = "Registrar medición";
    }
}


/* ------------------------------------------------------------------ */
/* Inicialización                                                      */
/* ------------------------------------------------------------------ */

document.addEventListener("DOMContentLoaded", () => {
    // Botón "Actualizar" del encabezado (base.html). Un clic durante una
    // carga se ignora: aria-disabled no impide el clic por sí mismo.
    document.getElementById("refresh-button").addEventListener("click", () => {
        if (!isRefreshBusy()) {
            loadStorageData();
        }
    });

    document.getElementById("snapshot-button").addEventListener("click", recordSnapshot);

    // Cambiar la casilla es una consulta distinta: siempre recarga.
    document.getElementById("include-oracle").addEventListener("change", loadStorageData);

    loadStorageData();
});
