function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value ?? "—";
    }
}


function formatMegabytes(value) {
    if (value === null || value === undefined) {
        return "—";
    }

    return `${Number(value).toLocaleString("es-CR", {
        maximumFractionDigits: 2
    })} MB`;
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
        tableBody.innerHTML = `
            <tr>
                <td colspan="3">No hay PDBs visibles para esta sesión.</td>
            </tr>
        `;
        return;
    }

    for (const pdb of pdbs) {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${pdb.name}</td>
            <td>${pdb.open_mode}</td>
            <td>${pdb.restricted}</td>
        `;

        tableBody.appendChild(row);
    }
}


function renderInstance(data) {
    setText("instance-status", data.status);
    setText("instance-name", data.instance_name);
    setText("container-name", data.container_name);
    setText("instance-uptime", data.uptime);

    setText("host-name", data.host_name);
    setText("dbms-name", data.dbms);
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
    }

    renderPdbs(data.pdbs);

    setText("connection-text", "Conectado");
}


async function loadInstanceData() {
    try {
        const response = await fetch("/api/instance");

        if (!response.ok) {
            throw new Error(
                `Error HTTP ${response.status}`
            );
        }

        const data = await response.json();

        renderInstance(data);
    } catch (error) {
        console.error(
            "No se pudo obtener el estado de la instancia:",
            error
        );

        setText("connection-text", "Sin conexión");
    }
}


document.addEventListener(
    "DOMContentLoaded",
    loadInstanceData
);