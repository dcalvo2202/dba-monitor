const PERFORMANCE_REQUESTS = [
    {
        url: "/api/performance/sessions",
        bodyId: "active-sessions-body",
        countId: "active-session-count",
        columns: 6,
        render: renderActiveSessions
    },
    {
        url: "/api/performance/blocked-sessions",
        bodyId: "blocked-sessions-body",
        countId: "blocked-session-count",
        columns: 7,
        render: renderBlockedSessions
    },
    {
        url: "/api/performance/top-sql",
        bodyId: "top-sql-body",
        countId: "top-sql-count",
        columns: 7,
        render: renderTopSql
    },
    {
        url: "/api/performance/query-times",
        bodyId: "query-times-body",
        columns: 5,
        render: renderQueryTimes
    },
    {
        url: "/api/performance/resource-usage",
        bodyId: "resource-usage-body",
        countId: "resource-session-count",
        columns: 7,
        render: renderResourceUsage
    }
];

function addCell(row, value, className) {
    const cell = createElement("td", { text: value });
    if (className) {
        cell.className = className;
    }
    row.appendChild(cell);
}

function formatNumber(value, maximumFractionDigits = 0) {
    if (value === null || value === undefined) {
        return "—";
    }
    return Number(value).toLocaleString("es-CR", { maximumFractionDigits });
}

function renderRows(bodyId, rows, columns, emptyMessage, renderRow) {
    const body = document.getElementById(bodyId);
    body.replaceChildren();

    if (rows.length === 0) {
        renderTableMessage(body, columns, emptyMessage);
        return;
    }

    for (const data of rows) {
        const row = document.createElement("tr");
        renderRow(row, data);
        body.appendChild(row);
    }
}

function renderActiveSessions(sessions) {
    setText("active-session-count", sessions.length);
    renderRows("active-sessions-body", sessions, 6, "No hay sesiones activas.", (row, session) => {
        addCell(row, session.sid);
        addCell(row, session.username);
        addCell(row, session.status);
        addCell(row, session.machine);
        addCell(row, session.program);
        addCell(row, formatDate(session.logon_time));
    });
}

function renderBlockedSessions(sessions) {
    setText("blocked-session-count", sessions.length);
    renderRows("blocked-sessions-body", sessions, 7, "No hay sesiones bloqueadas.", (row, session) => {
        addCell(row, session.sid);
        addCell(row, session.username);
        addCell(row, session.blocking_instance);
        addCell(row, session.blocking_session);
        addCell(row, session.blocking_session_status);
        addCell(row, session.event);
        addCell(row, formatNumber(session.seconds_in_wait));
    });
}

function renderTopSql(queries) {
    setText("top-sql-count", queries.length);
    renderRows("top-sql-body", queries, 7, "No hay consultas con ejecuciones para mostrar.", (row, query) => {
        addCell(row, query.sql_id);
        addCell(row, query.sql_text, "sql-preview");
        addCell(row, formatNumber(query.executions));
        addCell(row, formatNumber(query.cpu_time_seconds, 3));
        addCell(row, formatNumber(query.elapsed_time_seconds, 3));
        addCell(row, formatNumber(query.buffer_gets));
        addCell(row, formatNumber(query.disk_reads));
    });
}

function renderQueryTimes(queries) {
    renderRows("query-times-body", queries, 5, "No hay métricas de tiempo disponibles.", (row, query) => {
        addCell(row, query.sql_id);
        addCell(row, query.sql_text, "sql-preview");
        addCell(row, formatNumber(query.executions));
        addCell(row, formatNumber(query.total_elapsed_seconds, 3));
        addCell(row, formatNumber(query.avg_elapsed_seconds, 6));
    });
}

function renderResourceUsage(sessions) {
    setText("resource-session-count", sessions.length);
    renderRows("resource-usage-body", sessions, 7, "No hay sesiones de usuario con métricas de recursos.", (row, session) => {
        addCell(row, session.sid);
        addCell(row, session.username);
        addCell(row, session.status);
        addCell(row, session.program);
        addCell(row, session.process_id);
        addCell(row, formatNumber(session.cpu_seconds, 2));
        addCell(row, formatNumber(session.pga_used_mb, 2));
    });
}

async function loadPerformanceData() {
    if (isRefreshBusy()) {
        return;
    }

    setRefreshState(true);
    setConnectionState("is-loading", "Consultando rendimiento...");

    try {
        const results = await Promise.allSettled(
            PERFORMANCE_REQUESTS.map(async (request) => {
                const data = await fetchJson(request.url);
                if (!Array.isArray(data)) {
                    throw new Error(`Respuesta inválida de ${request.url}.`);
                }
                request.render(data);
            })
        );

        let failures = 0;
        results.forEach((result, index) => {
            if (result.status === "fulfilled") {
                return;
            }

            failures += 1;
            const request = PERFORMANCE_REQUESTS[index];
            renderTableMessage(
                document.getElementById(request.bodyId),
                request.columns,
                result.reason.message
            );
            if (request.countId) {
                setText(request.countId, "—");
            }
            console.error(`No se pudo cargar ${request.url}:`, result.reason);
        });

        if (failures === PERFORMANCE_REQUESTS.length) {
            setConnectionState("is-error", "Error al consultar");
        } else if (failures > 0) {
            setConnectionState("is-warning", "Carga parcial");
            updateLastUpdatedTime();
        } else {
            setConnectionState("is-ok", "Conectado");
            updateLastUpdatedTime();
        }
    } finally {
        setRefreshState(false);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("refresh-button")
        ?.addEventListener("click", loadPerformanceData);
    loadPerformanceData();
});
