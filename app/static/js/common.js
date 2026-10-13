/*
 * Utilidades compartidas del frontend de DBA Monitor.
 *
 * Funciones genéricas que cualquier módulo puede reutilizar: escritura
 * segura de texto, indicador de conexión, botón "Actualizar", formato de
 * fechas y llamadas a la API con manejo de errores.
 *
 * Se carga antes del script propio de cada módulo:
 *     <script src=".../js/common.js"></script>
 *     <script src=".../js/<modulo>.js"></script>
 */

/**
 * Escribe texto plano en un elemento por su id.
 * Usa textContent (nunca innerHTML) para que datos provenientes de la base
 * de datos no puedan inyectar HTML en la página.
 * @param {string} id - id del elemento.
 * @param {*} value - Valor a mostrar; null/undefined se muestra como "—".
 */
function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value ?? "—";
    }
}

/**
 * Aplica una de las clases de estado visual (state-ok, state-warning,
 * state-error, state-neutral) definidas en style.css.
 * @param {HTMLElement} element
 * @param {string} state
 */
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

/**
 * Actualiza el indicador de conexión del encabezado (definido en base.html).
 * @param {"is-ok"|"is-warning"|"is-error"|"is-loading"} state
 * @param {string} text - Texto visible, ej. "Conectado".
 */
function setConnectionState(state, text) {
    const element = document.getElementById("connection-state");

    if (!element) {
        return;
    }

    element.classList.remove(
        "is-ok",
        "is-warning",
        "is-error",
        "is-loading"
    );

    element.classList.add(state);

    setText("connection-text", text);
}

/**
 * Marca el botón "Actualizar" como ocupado mientras se cargan datos.
 *
 * Se usa aria-disabled en lugar de disabled: un botón deshabilitado pierde
 * el foco, y quien navega con teclado volvería al inicio de la página. Los
 * clics repetidos se ignoran comprobando isRefreshBusy().
 * @param {boolean} isLoading
 */
function setRefreshState(isLoading) {
    const button = document.getElementById("refresh-button");

    if (!button) {
        return;
    }

    button.setAttribute("aria-disabled", String(isLoading));
    button.textContent = isLoading ? "Actualizando..." : "Actualizar";
}

/** True si el botón "Actualizar" indica que hay una carga en curso. */
function isRefreshBusy() {
    return document.getElementById("refresh-button")
        ?.getAttribute("aria-disabled") === "true";
}

/**
 * Envía un mensaje a los lectores de pantalla sin mostrarlo en pantalla
 * (región #status-announcer de base.html). Útil para avisar resultados,
 * ej. "12 usuarios encontrados".
 * @param {string} message
 */
function announce(message) {
    const region = document.getElementById("status-announcer");

    if (!region) {
        return;
    }

    // Vaciar y volver a escribir garantiza que se anuncie aunque el texto
    // sea igual al anterior.
    region.textContent = "";
    window.setTimeout(() => {
        region.textContent = message;
    }, 50);
}

/** Muestra la hora actual como "Última actualización". */
function updateLastUpdatedTime() {
    const formattedTime = new Date().toLocaleTimeString("es-CR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });

    setText("last-updated", formattedTime);
}

/**
 * Formatea una fecha ISO de la API en formato local de Costa Rica.
 * @param {string|null} value
 * @returns {string} Fecha legible o "—" si no hay valor.
 */
function formatDate(value) {
    if (!value) {
        return "—";
    }

    return new Date(value).toLocaleString("es-CR");
}

/**
 * Consulta un endpoint de la API y devuelve el JSON.
 * Si la respuesta no es exitosa lanza un Error con el mensaje "detail"
 * que envía el backend (ej. "No se pudo consultar ... (ORA-01017)").
 * @param {string} url
 * @returns {Promise<any>}
 */
async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });

    let body = null;

    try {
        body = await response.json();
    } catch {
        // Respuesta sin cuerpo JSON: se usa el mensaje genérico de abajo.
    }

    if (!response.ok) {
        const detail = typeof body?.detail === "string"
            ? body.detail
            : `Error HTTP ${response.status}`;

        const error = new Error(detail);
        error.status = response.status;
        throw error;
    }

    return body;
}

/**
 * Crea un elemento HTML con clase y texto opcionales.
 * @param {string} tag - Etiqueta, ej. "td" o "span".
 * @param {{className?: string, text?: *, title?: string}} [options]
 * @returns {HTMLElement}
 */
function createElement(tag, { className, text, title } = {}) {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (text !== undefined) {
        element.textContent = text ?? "—";
    }

    if (title) {
        element.title = title;
    }

    return element;
}

/**
 * Reemplaza el contenido de un <tbody> por una única fila con un mensaje
 * (ej. "No hay objetos inválidos" o el error de la API).
 * @param {HTMLElement} tableBody
 * @param {number} columnCount - Columnas que debe ocupar la celda.
 * @param {string} message
 */
function renderTableMessage(tableBody, columnCount, message) {
    const row = document.createElement("tr");
    const cell = createElement("td", { className: "table-message", text: message });

    cell.colSpan = columnCount;
    row.appendChild(cell);

    tableBody.replaceChildren(row);
}
