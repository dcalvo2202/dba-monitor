/*
 * Comportamiento común del diseño (base.html), presente en todas las páginas:
 *
 *   - Tema claro / oscuro: botón del encabezado. La elección se guarda en el
 *     navegador; sin elección se respeta el tema del sistema operativo.
 *   - Actualización automática: selector del encabezado (apagada, 30 s o
 *     60 s). Funciona con cualquier módulo porque simplemente pulsa el botón
 *     "Actualizar" de la página, que cada módulo ya conecta a su propia carga.
 *   - Anuncios accesibles: avisa a los lectores de pantalla solo cuando el
 *     estado de la conexión cambia de verdad (no en cada actualización).
 *   - Menú en móvil: deja visible el módulo activo en la barra horizontal.
 *
 * Todo está dentro de una función autoejecutable (IIFE) para no crear
 * variables globales que choquen con el JavaScript de cada módulo.
 */
(() => {
    const THEME_KEY = "dba-monitor-theme";
    const AUTO_REFRESH_KEY = "dba-monitor-auto-refresh";

    /**
     * Lee un valor guardado en el navegador. localStorage puede estar
     * bloqueado (modo privado, políticas del navegador): en ese caso se
     * devuelve null y la página funciona igual, sin recordar preferencias.
     */
    function readPreference(key) {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    }

    /** Guarda una preferencia; si no es posible, se ignora sin error. */
    function savePreference(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch {
            // Sin almacenamiento disponible: la preferencia dura solo esta visita.
        }
    }


    /* -------------------------------------------------------------- */
    /* Tema                                                            */
    /* -------------------------------------------------------------- */

    /** Tema que se ve actualmente: el elegido o, si no hay, el del sistema. */
    function currentTheme() {
        const chosen = document.documentElement.dataset.theme;

        if (chosen === "light" || chosen === "dark") {
            return chosen;
        }

        return window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
    }

    /**
     * Refleja el tema en el botón. La etiqueta accesible es fija
     * ("Tema oscuro") y el estado se comunica con aria-pressed, que los
     * lectores de pantalla anuncian como "activado" / "desactivado".
     */
    function updateThemeButton(button) {
        button.setAttribute("aria-pressed", String(currentTheme() === "dark"));
    }

    function setupThemeToggle() {
        const button = document.getElementById("theme-toggle");

        if (!button) {
            return;
        }

        updateThemeButton(button);

        button.addEventListener("click", () => {
            const newTheme = currentTheme() === "dark" ? "light" : "dark";

            document.documentElement.dataset.theme = newTheme;
            savePreference(THEME_KEY, newTheme);
            updateThemeButton(button);
        });

        // Si el usuario no eligió tema y cambia el del sistema operativo,
        // el estado del botón debe reflejarlo.
        window.matchMedia("(prefers-color-scheme: dark)")
            .addEventListener("change", () => updateThemeButton(button));
    }


    /* -------------------------------------------------------------- */
    /* Actualización automática                                        */
    /* -------------------------------------------------------------- */

    let autoRefreshTimer = null;
    let autoRefreshSeconds = 0;
    let lastRefreshAt = Date.now();

    /**
     * True si el botón "Actualizar" indica que hay una carga en curso.
     * Los módulos marcan el botón como ocupado con aria-disabled="true"
     * (o, en código anterior, con disabled) mientras consultan Oracle.
     */
    function isRefreshBusy(button) {
        return button.disabled || button.getAttribute("aria-disabled") === "true";
    }

    /**
     * True si el usuario está trabajando dentro del contenido: tiene el
     * foco en un control de las tablas o paneles, o tiene abierto un bloque
     * desplegable (ej. errores de compilación). Redibujar la página en ese
     * momento le haría perder su lugar, así que la actualización espera.
     */
    function isUserInteracting() {
        const active = document.activeElement;
        const header = document.querySelector(".page-header");

        // :focus-visible distingue el foco de teclado (o de un campo de
        // texto en uso) del que deja un clic con el mouse; tras un clic la
        // actualización automática sigue funcionando con normalidad.
        const focusInContent =
            active &&
            active !== document.body &&
            active.closest(".main-content") &&
            !header?.contains(active) &&
            active.matches(":focus-visible");

        const hasOpenDetails = document.querySelector(".main-content details[open]") !== null;

        return Boolean(focusInContent || hasOpenDetails);
    }

    /**
     * Pulsa el botón "Actualizar" de la página, salvo que:
     * - la pestaña del navegador esté oculta (nadie está mirando);
     * - ya haya una actualización en curso;
     * - el usuario esté interactuando con el contenido.
     */
    function triggerRefresh() {
        const button = document.getElementById("refresh-button");

        if (document.hidden || !button || isRefreshBusy(button) || isUserInteracting()) {
            return;
        }

        lastRefreshAt = Date.now();
        button.click();
    }

    /** Inicia o detiene el temporizador según los segundos elegidos. */
    function applyAutoRefresh(seconds) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
        autoRefreshSeconds = seconds;

        if (seconds > 0) {
            autoRefreshTimer = setInterval(triggerRefresh, seconds * 1000);
        }
    }

    function setupAutoRefresh() {
        const select = document.getElementById("auto-refresh");
        const refreshButton = document.getElementById("refresh-button");

        if (!select) {
            return;
        }

        const saved = readPreference(AUTO_REFRESH_KEY);
        if (saved && [...select.options].some((option) => option.value === saved)) {
            select.value = saved;
        }

        applyAutoRefresh(Number(select.value));

        select.addEventListener("change", () => {
            savePreference(AUTO_REFRESH_KEY, select.value);
            applyAutoRefresh(Number(select.value));
        });

        // Una actualización manual también cuenta como reciente.
        refreshButton?.addEventListener("click", () => {
            lastRefreshAt = Date.now();
        });

        // Al volver a la pestaña solo se actualiza si los datos ya están
        // viejos (pasó un ciclo completo). Se reinicia el temporizador para
        // que no llegue otra actualización pocos segundos después.
        document.addEventListener("visibilitychange", () => {
            if (document.hidden || autoRefreshTimer === null) {
                return;
            }

            if (Date.now() - lastRefreshAt >= autoRefreshSeconds * 1000) {
                triggerRefresh();
                applyAutoRefresh(autoRefreshSeconds);
            }
        });
    }


    /* -------------------------------------------------------------- */
    /* Anuncios para lectores de pantalla                              */
    /* -------------------------------------------------------------- */

    /**
     * Observa el indicador de conexión del encabezado y anuncia solo los
     * cambios de estado relevantes (ej. Conectado -> Sin conexión), nunca el
     * "Actualizando..." intermedio. Así el lector de pantalla no repite
     * mensajes cada 30 s con la actualización automática.
     *
     * Funciona con cualquier módulo: basta con que su JavaScript cambie las
     * clases is-ok / is-warning / is-error / is-loading del indicador.
     */
    function setupConnectionAnnouncer() {
        const indicator = document.getElementById("connection-state");
        const politeRegion = document.getElementById("status-announcer");
        const alertRegion = document.getElementById("alert-announcer");

        if (!indicator || !politeRegion || !alertRegion) {
            return;
        }

        const STATES = ["is-ok", "is-warning", "is-error"];
        // El primer "Conectado" al cargar la página no se anuncia (es lo esperado).
        let lastState = "is-ok";

        new MutationObserver(() => {
            const state = STATES.find((name) => indicator.classList.contains(name));

            if (!state || state === lastState) {
                return;
            }

            lastState = state;
            const text = document.getElementById("connection-text")?.textContent ?? "";

            // Los errores se anuncian como alerta (interrumpen); el resto, de
            // forma cortés al terminar lo que se está leyendo.
            if (state === "is-error") {
                alertRegion.textContent = `Error de conexión: ${text}`;
            } else {
                politeRegion.textContent = `Estado de la conexión: ${text}`;
            }
        }).observe(indicator, { attributes: true, attributeFilter: ["class"] });
    }


    /* -------------------------------------------------------------- */
    /* Menú en móvil                                                   */
    /* -------------------------------------------------------------- */

    /**
     * En pantallas pequeñas el menú es una barra horizontal desplazable;
     * se desplaza para que el módulo activo quede visible. Se ajusta solo
     * el scroll horizontal de la barra, sin mover la página.
     */
    function revealActiveNavItem() {
        const navigation = document.querySelector(".navigation");
        const active = navigation?.querySelector(".nav-item.active");

        if (!navigation || !active || navigation.scrollWidth <= navigation.clientWidth) {
            return;
        }

        // Distancia entre el centro del enlace activo y el centro de la barra.
        const navRect = navigation.getBoundingClientRect();
        const activeRect = active.getBoundingClientRect();

        navigation.scrollLeft +=
            (activeRect.left + activeRect.width / 2) - (navRect.left + navRect.width / 2);
    }


    document.addEventListener("DOMContentLoaded", () => {
        setupThemeToggle();
        setupAutoRefresh();
        setupConnectionAnnouncer();
        revealActiveNavItem();

        // Las fuentes web pueden cambiar el ancho de los textos del menú;
        // se vuelve a centrar cuando terminan de cargar.
        document.fonts?.ready.then(revealActiveNavItem);
    });
})();
