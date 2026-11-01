/*
 * Módulo 3 - Gestión del almacenamiento.
 *
 * Carga /api/storage y dibuja:
 *   - Tarjetas de resumen.
 *   - Gráficos de tablespaces y objetos.
 *   - Tablas de tablespaces, historial, datafiles y objetos.
 *
 * El historial de crecimiento existe únicamente en XEPDB1.
 * Cuando el contenedor activo no dispone del historial, el botón
 * «Registrar medición» se oculta para no ofrecer una operación
 * incompatible con el contexto actual.
 *
 * Depende de common.js y charts.js.
 */

const STORAGE_API = "/api/storage";

const TABLESPACE_STATE = {
    ok: {
        text: "Normal",
        state: "state-ok"
    },
    warning: {
        text: "Advertencia",
        state: "state-warning"
    },
    critical: {
        text: "Crítico",
        state: "state-error"
    }
};

let storageLoadSequence = 0;
let lastStorageSnapshot = null;


/* ------------------------------------------------------------------ */
/* Formato                                                             */
/* ------------------------------------------------------------------ */

function formatSize(megabytes) {
    if (
        megabytes === null ||
        megabytes === undefined
    ) {
        return "—";
    }

    if (Math.abs(megabytes) >= 1024) {
        return `${(
            megabytes / 1024
        ).toLocaleString(
            "es-CR",
            {
                maximumFractionDigits: 2
            }
        )} GB`;
    }

    return `${megabytes.toLocaleString(
        "es-CR",
        {
            maximumFractionDigits: 1
        }
    )} MB`;
}


function formatPercent(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return "—";
    }

    return `${value.toLocaleString(
        "es-CR",
        {
            maximumFractionDigits: 1
        }
    )} %`;
}


function formatDelta(megabytes) {
    if (
        megabytes === null ||
        megabytes === undefined
    ) {
        return "—";
    }

    const sign = megabytes > 0
        ? "+"
        : megabytes < 0
            ? "−"
            : "";

    return `${sign}${formatSize(
        Math.abs(megabytes)
    )}`;
}


function createBadge(text, stateClass) {
    return createElement(
        "span",
        {
            className: `table-status ${stateClass}`,
            text
        }
    );
}


function createUsageCell(percent, label) {
    const cell = document.createElement("td");

    const safe = Math.min(
        100,
        Math.max(
            0,
            percent ?? 0
        )
    );

    const track = createElement(
        "div",
        {
            className: "progress-track"
        }
    );

    const bar = createElement(
        "div",
        {
            className: "progress-bar"
        }
    );

    bar.style.width = `${safe}%`;

    bar.setAttribute(
        "role",
        "progressbar"
    );

    bar.setAttribute(
        "aria-label",
        label
    );

    bar.setAttribute(
        "aria-valuemin",
        "0"
    );

    bar.setAttribute(
        "aria-valuemax",
        "100"
    );

    bar.setAttribute(
        "aria-valuenow",
        safe.toFixed(1)
    );

    track.appendChild(bar);

    cell.append(
        createElement(
            "span",
            {
                text: formatPercent(percent)
            }
        ),
        track
    );

    return cell;
}


/* ------------------------------------------------------------------ */
/* Tarjetas de resumen                                                 */
/* ------------------------------------------------------------------ */

function renderSummary(data) {
    const size = data.database_size;

    setText(
        "summary-size",
        formatSize(size.allocated_mb)
    );

    setText(
        "summary-size-detail",
        `${formatSize(
            size.used_mb
        )} usados por objetos · ${size.container_name}`
    );

    const {
        warning,
        critical
    } = data.alerts;

    const badge = document.getElementById(
        "summary-tablespaces"
    );

    if (critical > 0) {
        setText(
            "summary-tablespaces",
            `${critical} crítico(s)`
        );

        setStateClass(
            badge,
            "state-error"
        );

    } else if (warning > 0) {
        setText(
            "summary-tablespaces",
            `${warning} en advertencia`
        );

        setStateClass(
            badge,
            "state-warning"
        );

    } else {
        setText(
            "summary-tablespaces",
            "Normal"
        );

        setStateClass(
            badge,
            "state-ok"
        );
    }

    setText(
        "summary-tablespaces-detail",
        `${data.tablespaces.length} tablespaces en `
        + size.container_name
    );

    const autoextensible =
        data.datafiles.filter(
            file => file.autoextensible
        ).length;

    setText(
        "summary-datafiles",
        data.datafiles.length
    );

    setText(
        "summary-datafiles-detail",
        `${autoextensible} autoextensible(s)`
    );

    const comparison =
        data.growth.comparison;

    if (comparison) {
        setText(
            "summary-growth",
            formatDelta(
                comparison.growth_mb
            )
        );

        setText(
            "summary-growth-detail",
            `En ${comparison.days.toLocaleString(
                "es-CR"
            )} días`
            + (
                comparison.mb_per_day !== null
                    ? ` · ${formatDelta(
                        comparison.mb_per_day
                    )}/día`
                    : ""
            )
        );

    } else {
        setText(
            "summary-growth",
            "—"
        );

        setText(
            "summary-growth-detail",
            data.growth.available
                ? "Faltan mediciones para comparar"
                : "Historial no disponible"
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

    window.DbaCharts.renderBarChart(
        document.getElementById(
            "tablespace-chart"
        ),
        {
            items: data.tablespaces.map(
                tablespace => ({
                    label:
                        tablespace.tablespace_name,
                    value:
                        tablespace.used_mb ?? 0
                })
            ),
            ariaLabel:
                "Espacio usado por cada tablespace, "
                + "en megabytes",
            formatValue: formatSize,
            emptyMessage:
                "No hay tablespaces para mostrar."
        }
    );

    window.DbaCharts.renderBarChart(
        document.getElementById(
            "objects-chart"
        ),
        {
            items: data.large_objects.map(
                object => ({
                    label:
                        `${object.owner}.`
                        + object.segment_name,
                    value:
                        object.size_mb ?? 0
                })
            ),
            ariaLabel:
                "Objetos que más almacenamiento "
                + "ocupan, en megabytes",
            formatValue: formatSize,
            emptyMessage:
                "Sin objetos para mostrar "
                + "con el filtro actual."
        }
    );
}


function renderChartMessage(id, message) {
    document
        .getElementById(id)
        .replaceChildren(
            createElement(
                "p",
                {
                    className: "viz-empty",
                    text: message
                }
            )
        );
}


/* ------------------------------------------------------------------ */
/* Tablas                                                              */
/* ------------------------------------------------------------------ */

function renderTablespaces(tablespaces) {
    const body = document.getElementById(
        "tablespaces-table-body"
    );

    if (tablespaces.length === 0) {
        renderTableMessage(
            body,
            8,
            "No hay tablespaces visibles."
        );
        return;
    }

    body.replaceChildren(
        ...tablespaces.map(
            tablespace => {
                const row =
                    document.createElement("tr");

                const display =
                    TABLESPACE_STATE[
                        tablespace.state
                    ]
                    ?? TABLESPACE_STATE.ok;

                const stateCell =
                    document.createElement("td");

                stateCell.appendChild(
                    createBadge(
                        display.text,
                        display.state
                    )
                );

                row.append(
                    createElement(
                        "td",
                        {
                            className:
                                "cell-strong",
                            text:
                                tablespace.tablespace_name
                        }
                    ),
                    createElement(
                        "td",
                        {
                            text:
                                tablespace.contents_label
                        }
                    ),
                    createElement(
                        "td",
                        {
                            text:
                                formatSize(
                                    tablespace.used_mb
                                )
                        }
                    ),
                    createElement(
                        "td",
                        {
                            text:
                                formatSize(
                                    tablespace.free_mb
                                )
                        }
                    ),
                    createElement(
                        "td",
                        {
                            text:
                                formatSize(
                                    tablespace.total_mb
                                )
                        }
                    ),
                    createElement(
                        "td",
                        {
                            text:
                                formatSize(
                                    tablespace.max_mb
                                ),
                            title:
                                tablespace.autoextensible
                                    ? "Puede crecer por autoextensión"
                                    : "No es autoextensible"
                        }
                    ),
                    createUsageCell(
                        tablespace.max_used_percent,
                        `Uso del tablespace `
                        + tablespace.tablespace_name
                    ),
                    stateCell
                );

                return row;
            }
        )
    );
}


function renderGrowth(growth) {
    const message =
        document.getElementById(
            "growth-message"
        );

    const comparisonList =
        document.getElementById(
            "growth-comparison"
        );

    const body =
        document.getElementById(
            "history-table-body"
        );

    const snapshotButton =
        document.getElementById(
            "snapshot-button"
        );

    /*
     * El historial está diseñado únicamente para XEPDB1.
     * Si la API informa available=false, no ofrecemos
     * una operación que sabemos que no puede ejecutarse.
     */
    if (snapshotButton) {
        const unavailable =
            !growth.available;

        snapshotButton.hidden =
            unavailable;

        snapshotButton.setAttribute(
            "aria-disabled",
            unavailable
                ? "true"
                : "false"
        );
    }

    message.textContent =
        growth.message ?? "";

    message.hidden =
        !growth.message;

    const comparison =
        growth.comparison;

    comparisonList.hidden =
        !comparison;

    if (comparison) {
        setText(
            "growth-period",
            `${formatDate(
                comparison.from
            )} → ${formatDate(
                comparison.to
            )} (${comparison.days.toLocaleString(
                "es-CR"
            )} días)`
        );

        setText(
            "growth-used",
            `${formatSize(
                comparison.used_from_mb
            )} → ${formatSize(
                comparison.used_to_mb
            )}`
        );

        setText(
            "growth-total",
            `${formatDelta(
                comparison.growth_mb
            )}`
            + (
                comparison.growth_percent !== null
                    ? ` (${formatPercent(
                        comparison.growth_percent
                    )})`
                    : ""
            )
        );

        const hasRate =
            comparison.mb_per_day !== null;

        setText(
            "growth-rate",
            hasRate
                ? `${formatDelta(
                    comparison.mb_per_day
                )} por día`
                : "Requiere al menos "
                  + "un día de historial"
        );

        let fullText =
            "No aplica: la base no está creciendo";

        if (!hasRate) {
            fullText = "—";

        } else if (
            comparison.days_to_full !== null
        ) {
            fullText =
                `unos ${comparison.days_to_full
                    .toLocaleString(
                        "es-CR"
                    )} días al ritmo actual`;
        }

        setText(
            "growth-full",
            fullText
        );
    }

    if (
        !growth.available ||
        growth.snapshots.length === 0
    ) {
        renderTableMessage(
            body,
            4,
            growth.available
                ? "Todavía no hay mediciones."
                : growth.message
        );

        return;
    }

    const rows =
        growth.snapshots.map(
            (snapshot, index) => {
                const previous =
                    growth.snapshots[
                        index - 1
                    ];

                const row =
                    document.createElement("tr");

                row.append(
                    createElement(
                        "td",
                        {
                            text:
                                formatDate(
                                    snapshot.captured_at
                                )
                        }
                    ),
                    createElement(
                        "td",
                        {
                            text:
                                formatSize(
                                    snapshot.used_mb
                                )
                        }
                    ),
                    createElement(
                        "td",
                        {
                            text:
                                formatSize(
                                    snapshot.total_mb
                                )
                        }
                    ),
                    createElement(
                        "td",
                        {
                            text:
                                previous
                                    ? formatDelta(
                                        snapshot.used_mb
                                        - previous.used_mb
                                    )
                                    : "Primera medición"
                        }
                    )
                );

                return row;
            }
        );

    body.replaceChildren(
        ...rows.reverse()
    );
}


function renderDatafiles(datafiles) {
    const body =
        document.getElementById(
            "datafiles-table-body"
        );

    if (datafiles.length === 0) {
        renderTableMessage(
            body,
            8,
            "No hay archivos de datos visibles."
        );

        return;
    }

    body.replaceChildren(
        ...datafiles.map(
            file => {
                const row =
                    document.createElement("tr");

                const autoextendCell =
                    document.createElement("td");

                autoextendCell.appendChild(
                    createBadge(
                        file.autoextensible
                            ? "Sí"
                            : "No",
                        file.autoextensible
                            ? "state-ok"
                            : "state-neutral"
                    )
                );

                row.append(
                    createElement(
                        "td",
                        {
                            className:
                                "cell-note",
                            text:
                                file.file_name
                        }
                    ),
                    createElement(
                        "td",
                        {
                            className:
                                "cell-strong",
                            text:
                                file.tablespace_name
                        }
                    ),
                    createElement(
                        "td",
                        {
                            text:
                                file.file_type
                                === "TEMPORAL"
                                    ? "Temporal"
                                    : "Datos"
                        }
                    ),
                    createElement(
                        "td",
                        {
                            text:
                                formatSize(
                                    file.size_mb
                                )
                        }
                    ),
                    createElement(
                        "td",
                        {
                            text:
                                formatSize(
                                    file.max_mb
                                )
                        }
                    ),
                    autoextendCell,
                    createElement(
                        "td",
                        {
                            text:
                                file.autoextensible
                                    ? formatSize(
                                        file.increment_mb
                                    )
                                    : "—"
                        }
                    ),
                    createElement(
                        "td",
                        {
                            text:
                                file.status
                        }
                    )
                );

                return row;
            }
        )
    );
}


function renderObjects(objects) {
    const body =
        document.getElementById(
            "objects-table-body"
        );

    if (objects.length === 0) {
        renderTableMessage(
            body,
            6,
            document.getElementById(
                "include-oracle"
            ).checked
                ? "No hay objetos para mostrar."
                : "No hay objetos de aplicaciones "
                  + "en este contenedor. Marque "
                  + "«Incluir objetos internos de "
                  + "Oracle» para ver los del sistema."
        );

        return;
    }

    body.replaceChildren(
        ...objects.map(
            object => {
                const row =
                    document.createElement("tr");

                const name =
                    object.partition_name
                        ? `${object.segment_name} `
                          + `(${object.partition_name})`
                        : object.segment_name;

                row.append(
                    createElement(
                        "td",
                        {
                            text:
                                object.owner
                        }
                    ),
                    createElement(
                        "td",
                        {
                            className:
                                "cell-strong",
                            text: name
                        }
                    ),
                    createElement(
                        "td",
                        {
                            text:
                                object.segment_type
                        }
                    ),
                    createElement(
                        "td",
                        {
                            text:
                                object.tablespace_name
                        }
                    ),
                    createElement(
                        "td",
                        {
                            text:
                                formatSize(
                                    object.size_mb
                                )
                        }
                    ),
                    createElement(
                        "td",
                        {
                            text:
                                object.extents
                        }
                    )
                );

                return row;
            }
        )
    );
}


/* ------------------------------------------------------------------ */
/* Carga de datos                                                      */
/* ------------------------------------------------------------------ */

function renderLoadError(message) {
    lastStorageSnapshot = null;

    [
        "summary-size",
        "summary-tablespaces",
        "summary-datafiles",
        "summary-growth"
    ].forEach(
        id => {
            setText(
                id,
                "—"
            );

            setStateClass(
                document.getElementById(id),
                "state-neutral"
            );
        }
    );

    setText(
        "summary-size-detail",
        "Sin datos: la consulta falló"
    );

    renderChartMessage(
        "tablespace-chart",
        message
    );

    renderChartMessage(
        "objects-chart",
        message
    );

    renderTableMessage(
        document.getElementById(
            "tablespaces-table-body"
        ),
        8,
        message
    );

    renderTableMessage(
        document.getElementById(
            "history-table-body"
        ),
        4,
        message
    );

    renderTableMessage(
        document.getElementById(
            "datafiles-table-body"
        ),
        8,
        message
    );

    renderTableMessage(
        document.getElementById(
            "objects-table-body"
        ),
        6,
        message
    );
}


function renderStorage(data) {
    renderSummary(data);
    renderCharts(data);
    renderTablespaces(
        data.tablespaces
    );
    renderGrowth(
        data.growth
    );
    renderDatafiles(
        data.datafiles
    );
    renderObjects(
        data.large_objects
    );
}


async function loadStorageData() {
    const includeOracle =
        document.getElementById(
            "include-oracle"
        ).checked;

    const sequence =
        ++storageLoadSequence;

    setConnectionState(
        "is-loading",
        "Actualizando..."
    );

    setRefreshState(true);

    try {
        const data =
            await fetchJson(
                `${STORAGE_API}`
                + `?include_oracle=${includeOracle}`
            );

        if (
            sequence
            !== storageLoadSequence
        ) {
            return;
        }

        const snapshot =
            JSON.stringify(data);

        if (
            snapshot
            !== lastStorageSnapshot
        ) {
            lastStorageSnapshot =
                snapshot;

            renderStorage(data);
        }

        setConnectionState(
            "is-ok",
            "Conectado"
        );

        updateLastUpdatedTime();

    } catch (error) {
        if (
            sequence
            !== storageLoadSequence
        ) {
            return;
        }

        console.error(
            "No se pudo obtener "
            + "el almacenamiento:",
            error
        );

        setConnectionState(
            "is-error",
            "Sin conexión"
        );

        renderLoadError(
            error.message
        );

    } finally {
        if (
            sequence
            === storageLoadSequence
        ) {
            setRefreshState(false);
        }
    }
}


/* ------------------------------------------------------------------ */
/* Registrar medición                                                  */
/* ------------------------------------------------------------------ */

async function recordSnapshot() {
    const button =
        document.getElementById(
            "snapshot-button"
        );

    const message =
        document.getElementById(
            "growth-message"
        );

    if (
        !button ||
        button.hidden ||
        button.getAttribute(
            "aria-disabled"
        ) === "true"
    ) {
        return;
    }

    button.setAttribute(
        "aria-disabled",
        "true"
    );

    button.textContent =
        "Registrando...";

    try {
        const response =
            await fetch(
                `${STORAGE_API}/snapshot`,
                {
                    method: "POST"
                }
            );

        const body =
            await response
                .json()
                .catch(
                    () => null
                );

        if (!response.ok) {
            throw new Error(
                typeof body?.detail
                === "string"
                    ? body.detail
                    : `Error HTTP ${
                        response.status
                    }`
            );
        }

        await loadStorageData();

        announce(
            body.message
        );

    } catch (error) {
        message.hidden = false;

        message.textContent =
            "No se pudo registrar "
            + `la medición: ${error.message}`;

        announce(
            message.textContent
        );

    } finally {
        /*
         * Si durante la recarga se descubrió que el
         * contenedor no admite historial, renderGrowth()
         * habrá ocultado el botón. No lo rehabilitamos.
         */
        if (!button.hidden) {
            button.setAttribute(
                "aria-disabled",
                "false"
            );
        }

        button.textContent =
            "Registrar medición";
    }
}


/* ------------------------------------------------------------------ */
/* Inicialización                                                      */
/* ------------------------------------------------------------------ */

document.addEventListener(
    "DOMContentLoaded",
    () => {
        document
            .getElementById(
                "refresh-button"
            )
            .addEventListener(
                "click",
                () => {
                    if (
                        !isRefreshBusy()
                    ) {
                        loadStorageData();
                    }
                }
            );

        document
            .getElementById(
                "snapshot-button"
            )
            .addEventListener(
                "click",
                recordSnapshot
            );

        document
            .getElementById(
                "include-oracle"
            )
            .addEventListener(
                "change",
                loadStorageData
            );

        loadStorageData();
    }
);