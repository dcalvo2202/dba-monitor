/*
 * Módulo 5 - Auditoría (frontend).
 *
 * Consume la API /api/audit/* y rellena la página audit.html:
 *   - Tarjetas de resumen.
 *   - Pestaña Usuarios: tabla con buscador y hallazgos de riesgo.
 *   - Pestaña Roles: tabla con buscador.
 *   - Pestaña Privilegios: roles y privilegios efectivos de un usuario.
 *   - Pestaña Objetos inválidos: objetos con sus errores de compilación.
 *
 * Depende de las utilidades de common.js (setText, fetchJson,
 * createElement, renderTableMessage...).
 */

const AUDIT_API = "/api/audit";

// Máximo de privilegios que se piden por consulta. Cuentas como SYS tienen
// decenas de miles; la API informa el total real aunque devuelva menos.
const PRIVILEGES_PAGE_SIZE = 500;

// Clase visual de style.css para cada nivel de riesgo que envía el backend.
const RISK_STATE_CLASS = {
    ALTO: "state-error",
    MEDIO: "state-warning",
    INFO: "state-neutral"
};

// Estado de la página: últimos datos recibidos, para poder filtrar las
// tablas en el navegador sin volver a consultar Oracle.
const auditState = {
    users: [],
    roles: []
};

// Contadores de solicitudes. Si el usuario dispara una nueva carga antes de
// que termine la anterior, las respuestas pueden llegar desordenadas; solo
// se dibuja la respuesta de la solicitud más reciente.
let auditLoadSequence = 0;
let privilegesLoadSequence = 0;


/* ------------------------------------------------------------------ */
/* Pestañas                                                            */
/* ------------------------------------------------------------------ */

/**
 * Muestra la pestaña indicada y oculta las demás.
 * @param {"users"|"roles"|"privileges"|"invalid"} tabName
 */
function switchTab(tabName) {
    document.querySelectorAll(".tab-button").forEach((button) => {
        const isActive = button.dataset.tab === tabName;

        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", String(isActive));
        // Solo la pestaña activa es alcanzable con Tab (roving tabindex).
        button.tabIndex = isActive ? 0 : -1;
    });

    document.querySelectorAll(".tab-panel").forEach((panel) => {
        panel.hidden = panel.id !== `tab-${tabName}`;
    });
}

/**
 * Navegación por teclado entre pestañas (patrón WAI-ARIA):
 * flechas izquierda/derecha para moverse, Inicio/Fin para ir a la
 * primera/última. La pestaña enfocada se activa de inmediato.
 * @param {KeyboardEvent} event
 */
function handleTabKeydown(event) {
    const buttons = [...document.querySelectorAll(".tab-button")];
    const currentIndex = buttons.indexOf(event.currentTarget);

    const targetIndex = {
        ArrowRight: (currentIndex + 1) % buttons.length,
        ArrowLeft: (currentIndex - 1 + buttons.length) % buttons.length,
        Home: 0,
        End: buttons.length - 1
    }[event.key];

    if (targetIndex === undefined) {
        return;
    }

    event.preventDefault();
    buttons[targetIndex].focus();
    switchTab(buttons[targetIndex].dataset.tab);
}


/* ------------------------------------------------------------------ */
/* Componentes visuales reutilizados en las tablas                     */
/* ------------------------------------------------------------------ */

/**
 * Crea una etiqueta de estado (badge) con la clase de color indicada.
 * @param {string} text
 * @param {string} stateClass - state-ok | state-warning | state-error | state-neutral
 * @param {string} [title] - Texto de ayuda al pasar el cursor.
 */
function createBadge(text, stateClass, title) {
    return createElement("span", {
        className: `table-status ${stateClass}`,
        text,
        title
    });
}

/**
 * Clase visual según el estado de una cuenta Oracle.
 * OPEN = activa; LOCKED = bloqueada (normal en cuentas internas);
 * EXPIRED = contraseña vencida (requiere atención).
 * @param {string} status - Valor de DBA_USERS.ACCOUNT_STATUS.
 */
function accountStatusClass(status) {
    if (status === "OPEN") {
        return "state-ok";
    }

    if (status?.includes("EXPIRED")) {
        return "state-warning";
    }

    return "state-neutral";
}

/** Crea una celda <td> con texto plano. */
function textCell(value, className) {
    return createElement("td", { text: value, className });
}


/* ------------------------------------------------------------------ */
/* Resumen                                                             */
/* ------------------------------------------------------------------ */

/** Rellena la tarjeta de usuarios y la de hallazgos de riesgo. */
function renderUsersSummary(report) {
    const { summary, users } = report;

    setText("summary-users", summary.total);
    setText(
        "summary-users-detail",
        `${summary.open} abiertas · ${summary.locked} bloqueadas · ${summary.expired} expiradas`
    );

    const highRisk = users.filter((user) =>
        user.risks.some((risk) => risk.level === "ALTO")
    ).length;

    const mediumRisk = users.filter((user) =>
        user.risks.some((risk) => risk.level === "MEDIO")
    ).length;

    // Usuarios con al menos un hallazgo que no sea solo informativo.
    const flaggedUsers = users.filter((user) =>
        user.risks.some((risk) => risk.level !== "INFO")
    ).length;

    const riskElement = document.getElementById("summary-risks");
    setText("summary-risks", flaggedUsers);

    if (highRisk > 0) {
        setStateClass(riskElement, "state-error");
    } else if (mediumRisk > 0) {
        setStateClass(riskElement, "state-warning");
    } else {
        setStateClass(riskElement, "state-ok");
    }

    setText(
        "summary-risks-detail",
        `${highRisk} riesgo alto · ${mediumRisk} riesgo medio`
    );
}

/** Rellena la tarjeta de roles. */
function renderRolesSummary(report) {
    const { summary } = report;

    setText("summary-roles", summary.total);
    setText(
        "summary-roles-detail",
        `${summary.custom} propios · ${summary.unused} sin asignar`
    );
}

/** Rellena la tarjeta de objetos inválidos. */
function renderInvalidSummary(report) {
    const { summary } = report;
    const element = document.getElementById("summary-invalid");

    setText("summary-invalid", summary.total);
    setStateClass(element, summary.total === 0 ? "state-ok" : "state-warning");

    setText(
        "summary-invalid-detail",
        summary.total === 0
            ? "Todos los objetos son válidos"
            : `${summary.with_errors} con errores · ${summary.without_errors} por dependencia`
    );
}


/* ------------------------------------------------------------------ */
/* Pestaña Usuarios                                                    */
/* ------------------------------------------------------------------ */

/** Dibuja la tabla de usuarios aplicando el texto del buscador. */
function renderUsersTable() {
    const tableBody = document.getElementById("users-table-body");
    const filter = document.getElementById("users-search").value.trim().toUpperCase();

    const users = auditState.users.filter((user) =>
        user.username.includes(filter)
    );

    if (users.length === 0) {
        renderTableMessage(
            tableBody,
            8,
            filter ? "Ningún usuario coincide con la búsqueda." : "No hay usuarios para mostrar."
        );
        return;
    }

    const rows = users.map((user) => {
        const row = document.createElement("tr");

        const nameCell = textCell(user.username, "cell-strong");
        if (user.oracle_maintained === "Y") {
            nameCell.appendChild(createBadge("Oracle", "state-neutral", "Cuenta interna mantenida por Oracle"));
        }

        const statusCell = document.createElement("td");
        statusCell.appendChild(
            createBadge(user.account_status, accountStatusClass(user.account_status))
        );

        // Cada hallazgo se muestra como etiqueta de nivel seguida de su
        // explicación, para que el riesgo se entienda sin abrir nada.
        const risksCell = document.createElement("td");
        if (user.risks.length === 0) {
            risksCell.appendChild(createBadge("Sin observaciones", "state-ok"));
        } else {
            const list = createElement("ul", { className: "risk-list" });
            user.risks.forEach((risk) => {
                const item = document.createElement("li");
                item.append(
                    createBadge(risk.level, RISK_STATE_CLASS[risk.level]),
                    createElement("span", { text: risk.message })
                );
                list.appendChild(item);
            });
            risksCell.appendChild(list);
        }

        const actionCell = document.createElement("td");
        const button = createElement("button", { className: "link-button", text: "Ver privilegios" });
        button.type = "button";
        button.addEventListener("click", () => showUserPrivileges(user.username));
        actionCell.appendChild(button);

        row.append(
            nameCell,
            statusCell,
            textCell(user.authentication_type),
            textCell(formatDate(user.created)),
            textCell(user.last_login ? formatDate(user.last_login) : "Nunca"),
            textCell(user.profile),
            risksCell,
            actionCell
        );

        return row;
    });

    tableBody.replaceChildren(...rows);
}

/** Llena la lista de sugerencias del campo de usuario en Privilegios. */
function renderUsersDatalist() {
    const datalist = document.getElementById("users-datalist");

    const options = auditState.users.map((user) => {
        const option = document.createElement("option");
        option.value = user.username;
        return option;
    });

    datalist.replaceChildren(...options);
}


/* ------------------------------------------------------------------ */
/* Pestaña Roles                                                       */
/* ------------------------------------------------------------------ */

/** Dibuja la tabla de roles aplicando el texto del buscador. */
function renderRolesTable() {
    const tableBody = document.getElementById("roles-table-body");
    const filter = document.getElementById("roles-search").value.trim().toUpperCase();

    const roles = auditState.roles.filter((role) => role.role.includes(filter));

    if (roles.length === 0) {
        renderTableMessage(
            tableBody,
            6,
            filter ? "Ningún rol coincide con la búsqueda." : "No hay roles propios definidos."
        );
        return;
    }

    const rows = roles.map((role) => {
        const row = document.createElement("tr");

        const nameCell = textCell(role.role, "cell-strong");
        if (role.oracle_maintained === "Y") {
            nameCell.appendChild(createBadge("Predefinido", "state-neutral", "Rol predefinido de Oracle"));
        }

        const statusCell = document.createElement("td");
        if (role.granted_to_public === "Y") {
            statusCell.appendChild(
                createBadge("Otorgado a PUBLIC", "state-error", "Todos los usuarios de la base de datos reciben este rol")
            );
        } else if (role.is_unused) {
            statusCell.appendChild(
                createBadge("Sin asignar", "state-warning", "Ningún usuario ni rol lo tiene asignado")
            );
        } else {
            statusCell.appendChild(createBadge("En uso", "state-ok"));
        }

        row.append(
            nameCell,
            textCell(role.user_grantees),
            textCell(role.role_grantees),
            textCell(role.sys_privilege_count),
            textCell(role.granted_roles || "—"),
            statusCell
        );

        return row;
    });

    tableBody.replaceChildren(...rows);
}


/* ------------------------------------------------------------------ */
/* Pestaña Privilegios                                                 */
/* ------------------------------------------------------------------ */

/**
 * Abre la pestaña Privilegios y consulta el usuario indicado.
 * Se usa desde el botón "Ver privilegios" de la tabla de usuarios.
 * @param {string} username
 */
function showUserPrivileges(username) {
    document.getElementById("privileges-username").value = username;
    switchTab("privileges");
    loadUserPrivileges();
}

/** Consulta y muestra los roles y privilegios del usuario del formulario. */
async function loadUserPrivileges() {
    const username = document.getElementById("privileges-username").value.trim();
    const privilegeType = document.getElementById("privileges-type").value;
    const result = document.getElementById("privileges-result");
    const message = document.getElementById("privileges-message");

    if (!username) {
        return;
    }

    const params = new URLSearchParams({ max_rows: PRIVILEGES_PAGE_SIZE });
    if (privilegeType) {
        params.set("privilege_type", privilegeType);
    }

    const sequence = ++privilegesLoadSequence;

    message.hidden = false;
    message.textContent = `Consultando privilegios de ${username}...`;

    try {
        // encodeURIComponent evita que caracteres especiales del nombre
        // alteren la ruta de la URL.
        const report = await fetchJson(
            `${AUDIT_API}/users/${encodeURIComponent(username)}/privileges?${params}`
        );

        // Se descarta si mientras tanto se pidió otro usuario.
        if (sequence !== privilegesLoadSequence) {
            return;
        }

        renderPrivilegesReport(report);
        result.hidden = false;
        message.hidden = true;

    } catch (error) {
        if (sequence !== privilegesLoadSequence) {
            return;
        }

        result.hidden = true;
        message.hidden = false;
        message.textContent = error.message;
    }
}

/** Dibuja el resumen, la tabla de roles y la de privilegios de un usuario. */
function renderPrivilegesReport(report) {
    const { user, roles, privileges, summary } = report;

    // Resumen en línea: datos clave del usuario consultado.
    const summaryElement = document.getElementById("privileges-summary");
    const chips = [
        ["Usuario", user.username],
        ["Estado", user.account_status],
        ["Roles directos", summary.direct_roles],
        ["Roles heredados", summary.inherited_roles],
        ["Roles por PUBLIC", summary.public_roles],
        ["Privilegios", report.total_privileges.toLocaleString("es-CR")],
        ["Privilegios sensibles", summary.sensitive_privileges],
        ["Con opción de otorgar", summary.with_admin_option]
    ].map(([label, value]) => {
        const chip = createElement("div", { className: "summary-chip" });
        chip.append(
            createElement("span", { text: label }),
            createElement("strong", { text: value })
        );
        return chip;
    });
    summaryElement.replaceChildren(...chips);

    // Tabla de roles.
    const rolesBody = document.getElementById("user-roles-table-body");
    if (roles.length === 0) {
        renderTableMessage(rolesBody, 5, "El usuario no tiene roles asignados.");
    } else {
        rolesBody.replaceChildren(...roles.map((role) => {
            const row = document.createElement("tr");
            const levelCell = document.createElement("td");

            // Un rol otorgado a PUBLIC lo reciben todos los usuarios.
            if (role.via_public === "Y") {
                levelCell.appendChild(
                    createBadge("Por PUBLIC", "state-warning", "Otorgado a PUBLIC: lo tienen todos los usuarios")
                );
            } else if (role.grant_level === 1) {
                levelCell.appendChild(createBadge("Directo", "state-ok"));
            } else {
                levelCell.appendChild(
                    createBadge(`Heredado (nivel ${role.grant_level})`, "state-neutral")
                );
            }

            // Un rol no predeterminado está asignado pero no se activa al
            // iniciar sesión; el usuario debe ejecutar SET ROLE para usarlo.
            const defaultCell = document.createElement("td");
            defaultCell.appendChild(
                role.default_role === "YES"
                    ? createBadge("Sí", "state-ok")
                    : createBadge("No", "state-neutral", "Requiere SET ROLE para activarse")
            );

            row.append(
                textCell(role.granted_role, "cell-strong"),
                levelCell,
                textCell(role.role_path),
                defaultCell,
                textCell(role.admin_option === "YES" ? "Sí" : "No")
            );
            return row;
        }));
    }

    // Nota sobre los privilegios de objeto que todo usuario recibe de PUBLIC.
    const publicPrivileges = report.public_object_privileges;
    const customPublic = publicPrivileges.custom_owner_count;
    setText(
        "privileges-public-note",
        `Además, todo usuario hereda ${publicPrivileges.total_privileges.toLocaleString("es-CR")} ` +
        "privilegios de objeto otorgados a PUBLIC, que no se listan. " +
        (customPublic === 0
            ? "Todos son sobre objetos internos de Oracle."
            : `${customPublic} son sobre esquemas propios y conviene revisarlos.`)
    );

    // Aviso cuando la API devolvió menos privilegios que el total real.
    const truncated = document.getElementById("privileges-truncated");
    truncated.hidden = !report.is_truncated;
    const shownText =
        `Se muestran ${report.returned_privileges} de ` +
        `${report.total_privileges.toLocaleString("es-CR")} privilegios.`;

    // Si ya hay un filtro de tipo aplicado, no tiene sentido sugerirlo.
    truncated.textContent = !report.is_truncated
        ? ""
        : report.privilege_filter
            ? `${shownText} Es una cuenta con privilegios muy amplios, típico de cuentas administrativas de Oracle.`
            : `${shownText} Filtre por tipo de privilegio para acotar el resultado.`;

    // Tabla de privilegios.
    const privilegesBody = document.getElementById("privileges-table-body");
    if (privileges.length === 0) {
        renderTableMessage(privilegesBody, 5, "El usuario no tiene privilegios de este tipo.");
        return;
    }

    privilegesBody.replaceChildren(...privileges.map((privilege) => {
        const row = document.createElement("tr");

        const privilegeCell = textCell(privilege.privilege, "cell-strong");
        // El backend marca los privilegios de sistema de alto impacto.
        if (privilege.is_sensitive) {
            privilegeCell.appendChild(
                createBadge("Sensible", "state-warning", "Privilegio de sistema de alto impacto en la seguridad")
            );
        }

        const originCell = document.createElement("td");
        if (privilege.origin === "DIRECTO") {
            originCell.appendChild(createBadge("DIRECTO", "state-ok", "Otorgado directamente al usuario"));
        } else if (privilege.origin === "PUBLIC") {
            originCell.appendChild(createBadge("PUBLIC", "state-warning", "Otorgado a PUBLIC: lo tienen todos los usuarios"));
        } else {
            originCell.appendChild(createBadge(privilege.origin, "state-neutral", "Heredado a través de roles"));
        }

        // Si el mismo privilegio lo otorgan varias fuentes (directo y/o varios
        // roles) se indica cuántas más; revocarlo de una sola no lo elimina.
        if (privilege.path_count > 1) {
            originCell.appendChild(
                createElement("div", {
                    className: "cell-note",
                    text: `También lo otorga(n) ${privilege.path_count - 1} fuente(s) más`
                })
            );
        }

        row.append(
            textCell(privilege.privilege_type),
            privilegeCell,
            textCell(privilege.object_name || "—"),
            originCell,
            textCell(privilege.admin_option === "YES" ? "Sí" : "No")
        );
        return row;
    }));
}


/* ------------------------------------------------------------------ */
/* Pestaña Objetos inválidos                                           */
/* ------------------------------------------------------------------ */

/**
 * Crea la fila desplegable con los errores de compilación de un objeto.
 * Ocupa todo el ancho de la tabla porque los mensajes de Oracle (ej.
 * PLS-00103) son largos y en una columna estrecha serían ilegibles.
 * @param {object} obj - Objeto inválido con su lista "errors".
 * @returns {HTMLTableRowElement}
 */
function createErrorsRow(obj) {
    const row = createElement("tr", { className: "detail-row" });
    const cell = document.createElement("td");
    cell.colSpan = 6;

    const details = document.createElement("details");
    details.appendChild(
        createElement("summary", {
            text: `Ver errores de compilación de ${obj.owner}.${obj.object_name}`
        })
    );

    const list = createElement("ul", { className: "error-list" });
    obj.errors.forEach((error) => {
        list.appendChild(
            createElement("li", {
                text: `Línea ${error.line}, posición ${error.position}: ${error.text}`
            })
        );
    });

    details.appendChild(list);
    cell.appendChild(details);
    row.appendChild(cell);

    return row;
}

/** Dibuja la tabla de objetos inválidos con sus errores desplegables. */
function renderInvalidObjects(report) {
    const tableBody = document.getElementById("invalid-table-body");

    if (report.objects.length === 0) {
        renderTableMessage(tableBody, 6, "No hay objetos inválidos: todos los objetos están compilados correctamente.");
        return;
    }

    // Cada objeto produce su fila y, si tiene errores, una fila adicional
    // con el detalle; flatMap las aplana en una sola lista.
    tableBody.replaceChildren(...report.objects.flatMap((obj) => {
        const row = document.createElement("tr");

        const errorsCell = document.createElement("td");
        errorsCell.appendChild(
            obj.error_count > 0
                ? createBadge(`${obj.error_count} error(es)`, "state-error")
                : createBadge("Sin errores registrados", "state-neutral",
                    "Oracle registra errores solo al intentar compilar el objeto")
        );

        const ownerCell = textCell(obj.owner);
        if (obj.oracle_maintained === "Y") {
            ownerCell.appendChild(createBadge("Oracle", "state-neutral"));
        }

        row.append(
            ownerCell,
            textCell(obj.object_name, "cell-strong"),
            textCell(obj.object_type),
            textCell(formatDate(obj.last_ddl_time)),
            errorsCell,
            textCell(obj.diagnosis, "cell-note")
        );

        return obj.errors.length > 0 ? [row, createErrorsRow(obj)] : [row];
    }));
}


/* ------------------------------------------------------------------ */
/* Carga de datos                                                      */
/* ------------------------------------------------------------------ */

/**
 * Consulta usuarios, roles y objetos inválidos en paralelo.
 * Promise.allSettled permite mostrar lo que sí respondió aunque una de las
 * consultas falle (por ejemplo, por falta de un privilegio).
 */
/**
 * Limpia una tarjeta de resumen cuando su consulta falla, para que no siga
 * mostrando un valor anterior que ya no coincide con la tabla.
 * @param {string} valueId - id del valor principal de la tarjeta.
 * @param {string} detailId - id del texto secundario.
 */
function clearSummaryCard(valueId, detailId) {
    setText(valueId, "—");
    setText(detailId, "Sin datos: la consulta falló");
    setStateClass(document.getElementById(valueId), "state-neutral");
}

/**
 * Habilita o deshabilita los controles que disparan una recarga completa.
 * @param {boolean} isLoading
 */
function setAuditControlsLoading(isLoading) {
    setRefreshState(isLoading);
    document.getElementById("include-oracle").disabled = isLoading;
}

async function loadAuditData() {
    const includeOracle = document.getElementById("include-oracle").checked;
    const sequence = ++auditLoadSequence;

    setConnectionState("is-loading", "Actualizando...");
    setAuditControlsLoading(true);

    const [users, roles, invalid] = await Promise.allSettled([
        fetchJson(`${AUDIT_API}/users?include_oracle=${includeOracle}`),
        fetchJson(`${AUDIT_API}/roles?include_oracle=${includeOracle}`),
        fetchJson(`${AUDIT_API}/invalid-objects`)
    ]);

    // Una carga posterior ya está en curso: sus datos son los vigentes.
    if (sequence !== auditLoadSequence) {
        return;
    }

    // try/finally garantiza que los controles se vuelvan a habilitar aunque
    // ocurra un error inesperado al dibujar los datos.
    try {
        if (users.status === "fulfilled") {
            auditState.users = users.value.users;
            renderUsersSummary(users.value);
            renderUsersTable();
            renderUsersDatalist();
        } else {
            auditState.users = [];
            renderUsersDatalist();
            clearSummaryCard("summary-users", "summary-users-detail");
            clearSummaryCard("summary-risks", "summary-risks-detail");
            renderTableMessage(document.getElementById("users-table-body"), 8, users.reason.message);
        }

        if (roles.status === "fulfilled") {
            auditState.roles = roles.value.roles;
            renderRolesSummary(roles.value);
            renderRolesTable();
        } else {
            auditState.roles = [];
            clearSummaryCard("summary-roles", "summary-roles-detail");
            renderTableMessage(document.getElementById("roles-table-body"), 6, roles.reason.message);
        }

        if (invalid.status === "fulfilled") {
            renderInvalidSummary(invalid.value);
            renderInvalidObjects(invalid.value);
        } else {
            clearSummaryCard("summary-invalid", "summary-invalid-detail");
            renderTableMessage(document.getElementById("invalid-table-body"), 6, invalid.reason.message);
        }

        // Indicador global: verde si todo respondió, amarillo si algo falló,
        // rojo si no respondió ninguna consulta.
        const failures = [users, roles, invalid].filter((result) => result.status === "rejected");

        if (failures.length === 0) {
            setConnectionState("is-ok", "Conectado");
            updateLastUpdatedTime();
        } else if (failures.length < 3) {
            setConnectionState("is-warning", "Datos parciales");
            updateLastUpdatedTime();
        } else {
            setConnectionState("is-error", "Sin conexión");
        }

    } catch (error) {
        console.error("Error al mostrar los datos de auditoría:", error);
        setConnectionState("is-error", "Error al mostrar datos");

    } finally {
        setAuditControlsLoading(false);
    }
}


/* ------------------------------------------------------------------ */
/* Inicialización                                                      */
/* ------------------------------------------------------------------ */

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".tab-button").forEach((button) => {
        button.addEventListener("click", () => switchTab(button.dataset.tab));
        button.addEventListener("keydown", handleTabKeydown);
    });

    document.getElementById("refresh-button").addEventListener("click", loadAuditData);
    document.getElementById("include-oracle").addEventListener("change", loadAuditData);

    // Los buscadores filtran en el navegador, sin nuevas consultas a Oracle.
    document.getElementById("users-search").addEventListener("input", renderUsersTable);
    document.getElementById("roles-search").addEventListener("input", renderRolesTable);

    document.getElementById("privileges-form").addEventListener("submit", (event) => {
        event.preventDefault();
        loadUserPrivileges();
    });

    loadAuditData();
});
