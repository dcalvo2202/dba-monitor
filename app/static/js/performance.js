function setTableMessage(body, columns, message) {
    renderTableMessage(body, columns, message);
}

function addCell(row, value, className) {
    const cell = createElement("td", { text: value });
    if (className) {
        cell.className = className;
    }
    row.appendChild(cell);
}

function formatNumber(value) {
    if (value === null || value === undefined) {
        return "—";
    }
    return Number(value).toLocaleString("es-CR");
}

function renderActiveSessions(sessions) {
    const body = document.getElementById("active-sessions-body");
    body.replaceChildren();
    setText("active-session-count", sessions.length);

    if (sessions.length === 0) {
        setTableMessage(body, 6, "No hay sesiones activas.");
        return;
    }

    for (const session of sessions) {
        const row = document.createElement("tr");
        addCell(row, session.sid);
        addCell(row, session.username);
        addCell(row, session.status);
        addCell(row, session.machine);
        addCell(row, session.program);
        addCell(row, formatDate(session.logon_time));
        body.appendChild(row);
    }
}

function renderBlockedSessions(sessions) {
    const body = document.getElementById("blocked-sessions-body");
    body.replaceChildren();
    setText("blocked-session-count", sessions.length);

    if (sessions.length === 0) {
        setTableMessage(body, 5, "No hay sesiones bloqueadas.");
        return;
    }

    for (const session of sessions) {
        const row = document.createElement("tr");
        addCell(row, session.sid);
        addCell(row, session.username);
        addCell(row, session.blocking_session);
        addCell(row, session.event);
        addCell(row, formatNumber(session.seconds_in_wait));
        body.appendChild(row);
    }
}

function renderTopSql(queries) {
    const body = document.getElementById("top-sql-body");
    body.replaceChildren();
    setText("top-sql-count", queries.length);

    if (queries.length === 0) {
        setTableMessage(body, 7, "No hay consultas con ejecuciones para mostrar.");
        return;
    }

    for (const query of queries) {
        const row = document.createElement("tr");
        addCell(row, query.sql_id);
        addCell(row, query.sql_text, "sql-preview");
        addCell(row, formatNumber(query.executions));
        addCell(row, formatNumber(query.cpu_time_seconds));
        addCell(row, formatNumber(query.elapsed_time_seconds));
        addCell(row, formatNumber(query.buffer_gets));
        addCell(row, formatNumber(query.disk_reads));
        body.appendChild(row);
    }
}

async function loadPerformanceData() {
    if (isRefreshBusy()) {
        return;
    }

    setRefreshState(true);
    setConnectionState("is-loading", "Consultando rendimiento...");

    const requests = [
        {
            url: "/api/performance/sessions",
            body: document.getElementById("active-sessions-body"),
            columns: 6,
            render: renderActiveSessions
        },
        {
            url: "/api/performance/blocked-sessions",
            body: document.getElementById("blocked-sessions-body"),
            columns: 5,
            render: renderBlockedSessions
        },
        {
            url: "/api/performance/top-sql",
            body: document.getElementById("top-sql-body"),
            columns: 7,
            render: renderTopSql
        }
    ];

    const results = await Promise.allSettled(
        requests.map(async (request) => {
            const data = await fetchJson(request.url);
            request.render(data);
        })
    );

    let failureCount = 0;
    results.forEach((result, index) => {
        if (result.status === "fulfilled") {
            return;
        }

        failureCount += 1;
        const request = requests[index];
        setTableMessage(request.body, request.columns, result.reason.message);
        setText(
            request.url.endsWith("/sessions")
                ? "active-session-count"
                : request.url.endsWith("/blocked-sessions")
                    ? "blocked-session-count"
                    : "top-sql-count",
            "—"
        );
        console.error(`No se pudo cargar ${request.url}:`, result.reason);
    });

    if (failureCount === requests.length) {
        setConnectionState("is-error", "Error al consultar");
    } else if (failureCount > 0) {
        setConnectionState("is-warning", "Carga parcial");
    } else {
        setConnectionState("is-ok", "Conectado");
        updateLastUpdatedTime();
    }

    setRefreshState(false);
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("refresh-button")
        ?.addEventListener("click", loadPerformanceData);
    loadPerformanceData();
});
