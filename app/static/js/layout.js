/*
 * Comportamiento común del diseño (base.html), presente en todas las páginas:
 *
 *   - Tema claro / oscuro: botón del encabezado. La elección se guarda en el
 *     navegador; sin elección se respeta el tema del sistema operativo.
 *   - Actualización automática: selector del encabezado (apagada, 30 s o
 *     60 s). Funciona con cualquier módulo porque simplemente pulsa el botón
 *     "Actualizar" de la página, que cada módulo ya conecta a su propia carga.
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

    /** Actualiza la etiqueta accesible del botón según el tema visible. */
    function updateThemeButton(button) {
        const nextTheme = currentTheme() === "dark" ? "claro" : "oscuro";
        button.setAttribute("aria-label", `Cambiar a tema ${nextTheme}`);
        button.title = `Cambiar a tema ${nextTheme}`;
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
        // la etiqueta del botón debe reflejarlo.
        window.matchMedia("(prefers-color-scheme: dark)")
            .addEventListener("change", () => updateThemeButton(button));
    }


    /* -------------------------------------------------------------- */
    /* Actualización automática                                        */
    /* -------------------------------------------------------------- */

    let autoRefreshTimer = null;

    /**
     * Pulsa el botón "Actualizar" de la página, salvo que:
     * - la pestaña del navegador esté oculta (no tiene sentido consultar
     *   Oracle si nadie está mirando);
     * - ya haya una actualización en curso (el botón está deshabilitado).
     */
    function triggerRefresh() {
        const button = document.getElementById("refresh-button");

        if (document.hidden || !button || button.disabled) {
            return;
        }

        button.click();
    }

    /** Inicia o detiene el temporizador según los segundos elegidos. */
    function applyAutoRefresh(seconds) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;

        if (seconds > 0) {
            autoRefreshTimer = setInterval(triggerRefresh, seconds * 1000);
        }
    }

    function setupAutoRefresh() {
        const select = document.getElementById("auto-refresh");

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

        // Al volver a la pestaña después de un rato oculta, se actualiza de
        // inmediato en lugar de esperar al siguiente ciclo.
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden && autoRefreshTimer !== null) {
                triggerRefresh();
            }
        });
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
        revealActiveNavItem();
    });
})();
