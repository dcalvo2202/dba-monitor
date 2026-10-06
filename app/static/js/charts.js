/*
 * Gráficos de DBA Monitor (sin librerías externas).
 *
 * Dos formas, elegidas según lo que el lector debe hacer con el dato:
 *
 *   DbaCharts.renderBarChart     Comparar magnitudes entre elementos
 *                                (ej. privilegios sensibles por usuario).
 *                                Barras horizontales de un solo color.
 *   DbaCharts.renderStackedBar   Partes de un todo (ej. composición de la
 *                                SGA). Una barra dividida en segmentos con
 *                                leyenda que muestra cada valor.
 *
 * Reglas de diseño aplicadas (guía de visualización de datos):
 *   - Barras finas con extremo redondeado de 4 px y base recta.
 *   - 2 px de separación entre segmentos (no bordes alrededor).
 *   - Los textos usan colores de texto, nunca el color del dato; la
 *     identidad la da la muestra de color junto al texto.
 *   - Cada valor está visible (etiqueta o leyenda): el color nunca es la
 *     única forma de leer el dato.
 *   - Tooltip con mouse Y con teclado (Tab sobre cada barra o segmento).
 *   - Los nombres vienen de la base de datos: se insertan con textContent.
 *   - Colores desde variables CSS (--viz-*), con versión para tema oscuro.
 *
 * Se expone un único objeto global, DbaCharts, para no chocar con el
 * JavaScript de los módulos. No depende de common.js.
 */
(() => {
    // Colores categóricos en orden fijo (validados para daltonismo).
    // Nunca se generan colores extra: un 5.º grupo se agrupa en "Otros".
    const CATEGORICAL_VARS = ["--viz-1", "--viz-2", "--viz-3", "--viz-4"];
    const MAX_CATEGORIES = CATEGORICAL_VARS.length;

    let tooltip = null;


    /* -------------------------------------------------------------- */
    /* Utilidades                                                      */
    /* -------------------------------------------------------------- */

    /** Crea un elemento con clase y texto opcionales. */
    function el(tag, className, text) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined && text !== null) {
            element.textContent = String(text);
        }

        return element;
    }

    /** Número con separadores de miles en formato de Costa Rica. */
    function formatNumber(value, maximumFractionDigits = 0) {
        return Number(value).toLocaleString("es-CR", { maximumFractionDigits });
    }

    /** Porcentaje con un decimal, ej. "63,5 %". */
    function formatPercent(value) {
        return `${formatNumber(value, 1)} %`;
    }


    /* -------------------------------------------------------------- */
    /* Tooltip compartido                                              */
    /* -------------------------------------------------------------- */

    /** Crea (una sola vez) el tooltip que comparten todos los gráficos. */
    function getTooltip() {
        if (!tooltip) {
            tooltip = el("div", "viz-tooltip");
            tooltip.setAttribute("role", "tooltip");
            tooltip.hidden = true;
            document.body.appendChild(tooltip);
        }

        return tooltip;
    }

    /**
     * Muestra el tooltip junto a una marca. El valor va primero y destacado;
     * la etiqueta después, porque el lector ya sabe qué serie mira.
     */
    function showTooltip(target, value, label) {
        const box = getTooltip();

        box.replaceChildren(
            el("strong", "viz-tooltip-value", value),
            el("span", "viz-tooltip-label", label)
        );
        box.hidden = false;

        // Se ubica sobre la marca; si no cabe arriba, debajo.
        const rect = target.getBoundingClientRect();
        const boxRect = box.getBoundingClientRect();
        const left = Math.min(
            Math.max(8, rect.left + rect.width / 2 - boxRect.width / 2),
            window.innerWidth - boxRect.width - 8
        );
        const above = rect.top - boxRect.height - 8;
        const top = above > 8 ? above : rect.bottom + 8;

        box.style.left = `${left + window.scrollX}px`;
        box.style.top = `${top + window.scrollY}px`;
    }

    // Marca (barra o segmento) cuyo tooltip está visible en este momento.
    let activeMark = null;
    let hoverWatch = null;
    // true si el tooltip actual se abrió con Tab (teclado), false si con el mouse.
    let shownByKeyboard = false;

    function hideTooltip() {
        activeMark = null;
        clearInterval(hoverWatch);
        hoverWatch = null;

        if (tooltip) {
            tooltip.hidden = true;
        }
    }

    /**
     * Vigilancia mientras el tooltip está visible: cada 150 ms comprueba que
     * el mouse siga sobre la marca (:hover) o que la marca tenga el foco del
     * teclado. Si no, oculta el tooltip. Así el tooltip nunca queda pegado,
     * aunque el navegador no entregue el evento de salida (mouse que sale
     * rápido de la ventana, cambio de aplicación, gráfico redibujado...).
     */
    function watchActiveMark() {
        clearInterval(hoverWatch);

        hoverWatch = setInterval(() => {
            // Abierto con el mouse: solo sigue visible si el mouse está encima.
            // Abierto con el teclado: sigue visible mientras tenga el foco.
            const stillUsed =
                activeMark &&
                activeMark.isConnected &&
                (shownByKeyboard
                    ? activeMark.matches(":focus")
                    : activeMark.matches(":hover"));

            if (!stillUsed) {
                hideTooltip();
            }
        }, 150);
    }

    /**
     * Conecta una marca al tooltip: aparece con el mouse y con el foco del
     * teclado, y desaparece al salir, al perder el foco o con Escape.
     */
    function attachTooltip(mark, value, label) {
        mark.tabIndex = 0;
        mark.setAttribute("aria-label", `${label}: ${value}`);

        const show = (byKeyboard) => {
            activeMark = mark;
            shownByKeyboard = byKeyboard;
            showTooltip(mark, value, label);
            watchActiveMark();
        };

        mark.addEventListener("pointerenter", () => show(false));
        mark.addEventListener("pointerleave", hideTooltip);

        // Solo el foco de TECLADO (:focus-visible) muestra el tooltip. El
        // foco que deja un clic con el mouse no debe hacerlo: el navegador
        // lo vuelve a disparar al regresar a la ventana y el tooltip
        // aparecería "pegado" aunque el mouse esté en otro lugar.
        mark.addEventListener("focus", () => {
            if (mark.matches(":focus-visible")) {
                show(true);
            }
        });
        mark.addEventListener("blur", hideTooltip);

        mark.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                hideTooltip();
            }
        });
    }

    // Red de seguridad: si el mouse se mueve fuera de la marca activa y el
    // navegador no avisó la salida (por ejemplo, porque el gráfico se
    // redibujó con la actualización automática), se oculta el tooltip.
    // Cualquier movimiento del mouse fuera de la marca activa oculta el
    // tooltip, sin excepciones (también si se había abierto con el teclado).
    document.addEventListener("pointermove", (event) => {
        if (activeMark && !activeMark.contains(event.target)) {
            hideTooltip();
        }
    }, { passive: true });

    // Al desplazar la página el tooltip quedaría desubicado; al cambiar de
    // ventana ya no tiene sentido mostrarlo.
    window.addEventListener("scroll", hideTooltip, { passive: true });
    window.addEventListener("blur", hideTooltip);

    // El mouse salió de la página (hacia otra ventana o el escritorio).
    document.documentElement.addEventListener("mouseleave", hideTooltip);


    /**
     * Antes de redibujar un gráfico se cierra su tooltip: las marcas viejas
     * desaparecen y el navegador ya no avisaría que el mouse salió de ellas.
     */
    function closeTooltipIn(container) {
        if (activeMark && container.contains(activeMark)) {
            hideTooltip();
        }
    }


    /* -------------------------------------------------------------- */
    /* Barras horizontales: comparar magnitudes                        */
    /* -------------------------------------------------------------- */

    /**
     * Dibuja un gráfico de barras horizontales de un solo color.
     *
     * @param {HTMLElement} container - Donde se dibuja (se reemplaza su contenido).
     * @param {object} options
     * @param {{label: string, value: number}[]} options.items - Datos.
     * @param {string} options.ariaLabel - Descripción del gráfico completo.
     * @param {(value: number) => string} [options.formatValue] - Formato del valor.
     * @param {string} [options.emptyMessage] - Texto si no hay datos mayores a 0.
     * @param {number} [options.maxItems=8] - Máximo de barras (las mayores).
     */
    function renderBarChart(container, {
        items,
        ariaLabel,
        formatValue = (value) => formatNumber(value),
        emptyMessage = "Sin datos para mostrar.",
        maxItems = 8
    }) {
        closeTooltipIn(container);

        const data = items
            .filter((item) => item.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, maxItems);

        if (data.length === 0) {
            container.replaceChildren(el("p", "viz-empty", emptyMessage));
            return;
        }

        const maxValue = Math.max(...data.map((item) => item.value));

        const list = el("ul", "viz-bars");
        list.setAttribute("aria-label", ariaLabel);

        const rows = data.map((item) => {
            const row = el("li", "viz-bar-row");
            const value = formatValue(item.value);

            const label = el("span", "viz-bar-label", item.label);
            label.title = item.label;

            const track = el("span", "viz-bar-track");
            const bar = el("span", "viz-bar");
            // La barra crece desde la izquierda con transform (no width),
            // que el navegador anima sin recalcular el diseño.
            bar.style.setProperty("--viz-scale", String(item.value / maxValue));
            attachTooltip(bar, value, item.label);
            track.appendChild(bar);

            row.append(label, track, el("span", "viz-bar-value", value));
            return row;
        });

        list.replaceChildren(...rows);
        container.replaceChildren(list);
        playEntrance(container);
    }


    /* -------------------------------------------------------------- */
    /* Barra apilada: partes de un todo                                */
    /* -------------------------------------------------------------- */

    /**
     * Agrupa en "Otros" lo que exceda los colores disponibles, en lugar de
     * inventar colores nuevos que no se distinguirían entre sí.
     */
    function foldCategories(segments) {
        if (segments.length <= MAX_CATEGORIES) {
            return segments;
        }

        const kept = segments.slice(0, MAX_CATEGORIES - 1);
        const rest = segments.slice(MAX_CATEGORIES - 1);

        kept.push({
            label: "Otros",
            value: rest.reduce((sum, segment) => sum + segment.value, 0)
        });

        return kept;
    }

    /**
     * Dibuja una barra apilada con su leyenda.
     *
     * @param {HTMLElement} container - Donde se dibuja.
     * @param {object} options
     * @param {{label: string, value: number}[]} options.segments - Partes
     *        (en el orden en que deben aparecer, normalmente de mayor a menor).
     * @param {string} options.ariaLabel - Descripción del gráfico completo.
     * @param {(value: number) => string} [options.formatValue] - Formato del valor.
     * @param {string} [options.emptyMessage] - Texto si el total es 0.
     */
    function renderStackedBar(container, {
        segments,
        ariaLabel,
        formatValue = (value) => formatNumber(value),
        emptyMessage = "Sin datos para mostrar."
    }) {
        closeTooltipIn(container);

        const data = foldCategories(segments.filter((segment) => segment.value > 0));
        const total = data.reduce((sum, segment) => sum + segment.value, 0);

        if (total === 0) {
            container.replaceChildren(el("p", "viz-empty", emptyMessage));
            return;
        }

        const figure = el("div", "viz-stack-figure");

        const stack = el("div", "viz-stack");
        stack.setAttribute("role", "group");
        stack.setAttribute("aria-label", ariaLabel);

        const legend = el("ul", "viz-legend");

        data.forEach((segment, index) => {
            const colorVar = `var(${CATEGORICAL_VARS[index]})`;
            const percent = (segment.value / total) * 100;
            const value = formatValue(segment.value);
            const percentText = formatPercent(percent);

            // Segmento: su ancho es proporcional; flex-grow reparte el espacio
            // y el mínimo de 3 px mantiene visibles las partes muy pequeñas
            // (su valor exacto está en la leyenda y en el tooltip).
            const part = el("span", "viz-stack-segment");
            part.style.flexGrow = String(segment.value);
            part.style.background = colorVar;
            attachTooltip(part, `${value} · ${percentText}`, segment.label);
            stack.appendChild(part);

            // Leyenda: muestra de color + nombre + valor + porcentaje.
            const item = el("li", "viz-legend-item");
            const swatch = el("span", "viz-swatch");
            swatch.style.background = colorVar;
            swatch.setAttribute("aria-hidden", "true");

            item.append(
                swatch,
                el("span", "viz-legend-label", segment.label),
                el("span", "viz-legend-value", value),
                el("span", "viz-legend-percent", percentText)
            );
            legend.appendChild(item);
        });

        figure.append(stack, legend);
        container.replaceChildren(figure);
        playEntrance(container);
    }


    /* -------------------------------------------------------------- */
    /* Animación de entrada                                            */
    /* -------------------------------------------------------------- */

    /**
     * Activa la animación de entrada (las barras crecen desde la base) solo
     * la primera vez que se dibuja el gráfico. En las actualizaciones
     * siguientes las barras se muestran directamente en su tamaño final.
     * Con "reducir movimiento" activado, el CSS desactiva la animación.
     */
    function playEntrance(container) {
        if (container.dataset.vizDrawn === "true") {
            container.classList.add("viz-ready");
            return;
        }

        container.dataset.vizDrawn = "true";
        container.classList.remove("viz-ready");

        // Leer offsetWidth obliga al navegador a aplicar el estado inicial
        // (barras en cero) antes de agregar la clase final, así la
        // transición se dispara. No se usa requestAnimationFrame porque el
        // navegador lo pausa en pestañas ocultas y el gráfico quedaría
        // invisible hasta que el usuario volviera a la pestaña.
        void container.offsetWidth;
        container.classList.add("viz-ready");
    }


    window.DbaCharts = {
        renderBarChart,
        renderStackedBar,
        formatNumber,
        formatPercent
    };
})();
