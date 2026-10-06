function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value ?? "—";
    }
}

function setStateClass(element, state) {
    if (!element) {
        return;
    }

    element.classList.remove(
        "state-ok",
        "state-warning",
        "state-error",
        "state-neutral"
    );

    element.classList.add(state);
}


function renderInstanceStatus(status) {
    const element = document.getElementById("instance-status");

    setText("instance-status", status);

    if (status === "OPEN") {
        setStateClass(element, "state-ok");
        return;
    }

    if (status === "MOUNTED" || status === "STARTED") {
        setStateClass(element, "state-warning");
        return;
    }

    if (!status) {
        setStateClass(element, "state-neutral");
        return;
    }

    setStateClass(element, "state-error");
}

function setConnectionState(state, text) {
    const element = document.getElementById("connection-state");

    element.classList.remove(
        "is-ok",
        "is-warning",
        "is-error",
        "is-loading"
    );

    element.classList.add(state);

    setText("connection-text", text);
}

function formatMegabytes(value) {
    if (value === null || value === undefined) {
        return "—";
    }

    return `${Number(value).toLocaleString("es-CR", {
        maximumFractionDigits: 2
    })} MB`;
}

function calculatePercentage(used, allocated) {
    if (
        used === null ||
        used === undefined ||
        allocated === null ||
        allocated === undefined ||
        Number(allocated) <= 0
    ) {
        return null;
    }

    return (Number(used) / Number(allocated)) * 100;
}


function renderProgress(barId, labelId, percentage) {
    const bar = document.getElementById(barId);

    if (!bar || percentage === null) {
        setText(labelId, "—%");
        return;
    }

    const safePercentage = Math.min(
        100,
        Math.max(0, percentage)
    );

    bar.style.width = `${safePercentage}%`;
    bar.setAttribute(
        "aria-valuenow",
        safePercentage.toFixed(1)
    );

    setText(
        labelId,
        `${percentage.toFixed(1)}%`
    );
}

function formatDate(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    return date.toLocaleString("es-CR");
}

function renderPdbs(pdbs) {
    const tableBody = document.getElementById("pdb-table-body");

    tableBody.innerHTML = "";

    if (!pdbs || pdbs.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 3;
        cell.textContent = "No hay PDBs visibles para esta sesión.";

        row.appendChild(cell);
        tableBody.appendChild(row);

        return;
    }

    for (const pdb of pdbs) {
        const row = document.createElement("tr");

        const nameCell = document.createElement("td");
        nameCell.textContent = pdb.name;

        const modeCell = document.createElement("td");
        const modeBadge = document.createElement("span");

        modeBadge.classList.add("table-status");
        modeBadge.textContent = pdb.open_mode;

        if (pdb.open_mode === "READ WRITE") {
            modeBadge.classList.add("state-ok");
        } else {
            modeBadge.classList.add("state-neutral");
        }

        modeCell.appendChild(modeBadge);


        const restrictedCell = document.createElement("td");
        const restrictedBadge = document.createElement("span");

        restrictedBadge.classList.add("table-status");
        restrictedBadge.textContent = pdb.restricted;

        if (pdb.restricted === "NO") {
            restrictedBadge.classList.add("state-ok");
        } else {
            restrictedBadge.classList.add("state-warning");
        }

        restrictedCell.appendChild(restrictedBadge);

        row.appendChild(nameCell);
        row.appendChild(modeCell);
        row.appendChild(restrictedCell);

        tableBody.appendChild(row);
    }
}

function renderInstance(data) {
    renderInstanceStatus(data.status);
    setText("instance-name", data.instance_name);
    setText("container-name", data.container_name);
    setText("instance-uptime", data.uptime);

    setText("host-name", data.host_name);
    setText("dbms-name", data.dbms);
    setText("database-name", data.database_name);
    setText("db-version", data.version);
    setText("service-name", data.service_name);
    setText("startup-time", formatDate(data.startup_time));

    if (data.memory) {
        setText(
            "memory-allocated",
            formatMegabytes(data.memory.total_allocated_mb)
        );

        setText(
            "memory-used",
            formatMegabytes(data.memory.total_used_estimated_mb)
        );

        setText(
            "sga-allocated",
            formatMegabytes(data.memory.sga_allocated_mb)
        );

        setText(
            "sga-used",
            formatMegabytes(data.memory.sga_used_estimated_mb)
        );

        setText(
            "pga-allocated",
            formatMegabytes(data.memory.pga_allocated_mb)
        );

        setText(
            "pga-inuse",
            formatMegabytes(data.memory.pga_inuse_mb)
        );

        const sgaPercentage = calculatePercentage(
            data.memory.sga_used_estimated_mb,
            data.memory.sga_allocated_mb
        );

        const pgaPercentage = calculatePercentage(
            data.memory.pga_inuse_mb,
            data.memory.pga_allocated_mb
        );

        const totalPercentage = calculatePercentage(
            data.memory.total_used_estimated_mb,
            data.memory.total_allocated_mb
        );


        renderProgress(
            "sga-progress",
            "sga-percent",
            sgaPercentage
        );

        renderProgress(
            "pga-progress",
            "pga-percent",
            pgaPercentage
        );

        renderProgress(
            "total-memory-progress",
            "total-memory-percent",
            totalPercentage
        );
    }

    renderPdbs(data.pdbs);

    setConnectionState("is-ok", "Conectado");
}

async function loadInstanceData() {
    setConnectionState(
        "is-loading",
        "Actualizando..."
    );

    setRefreshState(true);

    try {
        const response = await fetch(
            "/api/instance",
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                `Error HTTP ${response.status}`
            );
        }

        const data = await response.json();

        renderInstance(data);
        updateLastUpdatedTime();

    } catch (error) {
        console.error(
            "No se pudo obtener el estado de la instancia:",
            error
        );

        setConnectionState(
            "is-error",
            "Sin conexión"
        );

    } finally {
        setRefreshState(false);
    }
}

function setRefreshState(isLoading) {
    const button = document.getElementById("refresh-button");

    if (!button) {
        return;
    }

    // aria-disabled en lugar de disabled: un botón deshabilitado pierde el
    // foco y quien usa teclado volvería al inicio de la página. Los clics
    // repetidos durante la carga se ignoran en el listener del final.
    button.setAttribute("aria-disabled", String(isLoading));
    button.textContent = isLoading
        ? "Actualizando..."
        : "Actualizar";
}


function updateLastUpdatedTime() {
    const now = new Date();

    const formattedTime = now.toLocaleTimeString(
        "es-CR",
        {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        }
    );

    setText("last-updated", formattedTime);
}

document.addEventListener(
    "DOMContentLoaded",
    () => {
        const refreshButton =
            document.getElementById("refresh-button");

        refreshButton.addEventListener(
            "click",
            () => {
                // Ignora el clic si ya hay una actualización en curso.
                if (refreshButton.getAttribute("aria-disabled") === "true") {
                    return;
                }

                loadInstanceData();
            }
        );

        loadInstanceData();
    }
);