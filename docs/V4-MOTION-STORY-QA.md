# DESSET Prime V4.1 — Motion Story y cierre editorial (solo candidato)

**Fuente:** video original aportado por el fundador, `oUFIpF0QAiawBjiGryMRFE5IKgdsZjPCUBywj(3).mp4`, 54,6 segundos, revisado visualmente en intervalos de 1,5 segundos.
**Objetivo:** adaptar la gramática de tipografía cinética, planos geométricos, color y secuencia visual al sitio DESSET, sin copiar el material de terceros.
**Alcance:** `M0-coder/DESSET-prime`, rama `design/v4-kinetic-identity-no-deploy`, PR #1, **borrador**. `main`, Cloudflare y `desset.lat` permanecen fuera de alcance.

## Cambios de esta iteración
- Hero: hilo de conexión dibujado una sola vez; se mantienen el mensaje comercial y el símbolo PNG binario original, sin recoloreo ni rediseño.
- Narrativa: sustituye las antiguas tres tarjetas aisladas por un recorrido visual de **ELEGIR → ORGANIZAR → MOVER**. Su ilustración geométrica es original y conceptual; no representa actividad, comercios, vehículos, interfaces ni prestaciones existentes.
- Arquitectura de cuatro roles: permanece dentro de `<details>`, no se duplica en portada.
- Cierre: tres líneas tipográficas con entrada contextual y recursos geométricos no figurativos. Los enlaces existentes a canales públicos no se inventan ni se modifican.
- Motion: `scripts/motion.js` usa `IntersectionObserver` y revela cada escena una sola vez. Sin bloqueo del scroll, temporizadores, librerías externas ni autoplay. Si faltan API o JavaScript, el contenido permanece estático y visible; se respeta `prefers-reduced-motion`.
- QA: captura del estado en entrada, transición y final, recorrido activo en escritorio, cierre activo, móvil 320/390, menú, teclado y modo de movimiento reducido.

## Evidencia de ejecución
Run principal con código y pruebas de esta iteración:
https://github.com/M0-coder/DESSET-prime/actions/runs/44473806699

**CI de referencia al documentar:** PASS, 23/23 pruebas Node, 6 estados de navegador, 12 capturas, 0 fallos del script de Chrome. Artifact `desset-prime-v4-evidence`, ID `14505841504`, digest `sha256:117a83513902e9daa6f91258c73c56d1bfa6e09ba91e032b259d34c9eef31b8b`.

La evidencia es una **comprobación automatizada**, no una aprobación de estilo ni de uso comercial.

## Doctrina: pruebas y evidencia antes de aprobación
**Primero fija el alcance: arquitectura, compilación, pruebas unitarias e instrumentadas, cobertura, análisis estático, calidad de CI, seguridad, reproducibilidad, mutation testing, deuda técnica y evidencia de ejecución.**

- Arquitectura: HTML + CSS + JS estáticos, recursos locales, sin backend ni checkout.
- Compilación: no existe fase de empaquetado; se verifica sintaxis JS con Node.
- Unitarias: contratos de marca original, navegación, integridad visual, observador y fallback.
- Instrumentadas: Chrome CDP en cinco anchos, escenas y cierre, menú, teclado y reduced-motion.
- Cobertura: no está cuantificada como porcentaje; evitar claims de cobertura total.
- Análisis estático: contratos y sintaxis, sin SAST integral.
- CI: acciones fijadas por SHA, permisos de lectura, sin mecanismos de publicación.
- Seguridad: cabeceras declaradas y CSP, pendiente HTTP real contra un servidor que las aplique.
- Reproducibilidad: contenido sin frameworks ni recursos remotos; conservar SHA de cada candidato.
- Mutation testing: prueba negativa puntual del menú, **no** mutation testing exhaustivo.
- Deuda: estilos CSS históricos que todavía pueden consolidarse; evitar nuevas capas improvisadas.
- Evidencia: capturas comparables por viewport y fase de movimiento, archivo JSON y enlaces a run.

## Gates NO superados
1. Figma original final: validación de wordmark DESSET, tipografía, componentes y licencia/propiedad intelectual.
2. Revisión visual humana comparando el video, sin imitar marcas/ilustraciones que pertenecen a terceros.
3. Auditoría profunda de accesibilidad (lector de pantalla, zoom 200–400 %, contraste por estado) y performance en dispositivos reales de gama baja.
4. Verificación de enlaces sociales vigentes y decisión comercial de qué contacto es el principal.
5. Aprobaciones distintas de diseño, merge, indexación, release y publicación.

**Prohibido sin autorización explícita:** merge, auto-merge, despliegue o publicación, cambio de DNS/Cloudflare, release, modificación de la identidad Figma, cambio a `M0-coder/DESSET`, borrado de ramas.
