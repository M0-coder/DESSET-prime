# BRAND-DUAL-PALETTE-01 — preparación, sin cambios visuales ni publicación

Base auditada: `4fbfd604eacafbab294486f3ed7924bbe6b0948c`. Decisión del titular: conservar dos paletas según función (27-11-2026). Este documento propone el alcance de implementación; no declara aprobada una migración de colores ni autoriza publicar.

## 1. Dos fuentes cromáticas, no una sustitución global

| Función | Azul | Rojo | Amarillo | Fondo | Tinta | Blanco |
|---|---|---|---|---|---|---|
| Corporativa | #1748BF | #E8342A | #FFC011 | #F7F2E1 | #111111 | #FFFFFF |
| Digital | #073BBC | #FF3328 | #FFC62F | #F7F5EE | #000000 | #FFFFFF |

La web completa, incluso sus páginas sobre empresa e inversores, conserva la interfaz digital. El material corporativo independiente utiliza la paleta corporativa; no se introduce un cambio brusco de identidad en la navegación. Esta delimitación es una propuesta para ejecutar la decisión de dos paletas. La guía 60–30–10 es orientativa, no cuota literal de píxeles. Blancos y fondos dominan, azul y tinta estructuran; amarillo y rojo acentúan. No forzar colores de marca sobre estados de error, éxito, foco o contraste.

## 2. Inventario de 26 páginas

Todas cargan styles.css, styles-system.css y styles-typography.css. Todas declaran theme-color #f4f8fe y NOINDEX. 17 hojas CSS en total.

| Grupo | Páginas | Hojas específicas | Acción propuesta |
|---|---|---|---|
| Portada | `index.html` | `styles-v5.css`, `styles-hero-photo.css`, `styles-visual02.css`, `styles-service-video.css`, `styles-hero-editorial.css` | Paleta digital; conservar composición |
| Información institucional web | `empresa.html`, `inversores.html`, `perfil-corporativo.html`, `mensaje-direccion.html`, `mision-vision-valores.html`, `gobierno-corporativo.html`, `historia.html`, `principios.html` | `styles-company.css` | Paleta digital; conservar composición |
| Aplicaciones | `aplicaciones.html`, `aplicaciones-clientes.html`, `aplicaciones-comercios.html`, `aplicaciones-repartidores.html` | `styles-applications.css` | Paleta digital; conservar composición |
| Comercios y repartidores | `comercios.html`, `repartidores.html` | `styles-audiences.css` | Paleta digital; conservar composición |
| Incorporación, registro y capacitación | `capacitacion-repartidores.html`, `incorporacion-comercios.html`, `incorporacion-repartidores.html`, `registro-comercios.html`, `registro-repartidores.html` | `styles-onboarding.css` | Paleta digital; conservar composición |
| Prime | `prime.html` | `styles-v5.css`, `styles-prime.css` | Paleta digital; conservar composición |
| Talento | `talento.html` | `styles-careers.css` | Paleta digital; conservar composición |
| Contacto | `contacto.html` | `styles-contact.css` | Paleta digital; conservar composición |
| Confianza | `confianza.html` | `styles-trust.css` | Paleta digital; conservar composición |
| Noticias | `noticias.html` | `styles-news.css` | Paleta digital; conservar composición |
| Inglés | `en.html` | Ninguna | Paleta digital; conservar composición |

## 3. Hallazgos y excepciones

- styles.css y styles-system.css: tokens principales ya coinciden con la paleta digital salvo superficies auxiliares. #FAF3DF y #FFFDF8 son candidatos a clasificación, no sustitución automática.
- Las hojas de aplicaciones, audiencias, talento, empresa, contacto, noticias, onboarding y confianza repiten #073BBC, blanco, negro y grises: consolidar por rol sin cambiar el valor computado.
- styles-v5.css todavía contiene #1551D8 y otros azules. confianza.html incluye #415775, #183665, #8eafff y #1551d8 en elementos gráficos. Revisar uso efectivo antes de modificar.
- Seis SVG históricos: roles-geometry-es.svg, roles-geometry-mobile-es.svg, roles-geometry-v2.svg, scene-choose.svg, scene-move.svg, scene-prepare.svg. Los tres roles-geometry están excluidos por build-site.mjs. No recolorear originales ni assets aprobados. El PR #83 documentó expresamente preservar gráficos y 3D. No fusionar ese PR antiguo.
- scripts/v6-three.src.mjs conserva PAL blue 0x1551d8, gold 0xffc62f y red 0xff3328. Motor 3D y GLB quedan fuera de esta intervención.
- #062E96 (hover), #B7CAFF (acento sobre oscuro), #F4F8FE (theme-color y superficies) son auxiliares existentes: mantener salvo evidencia de necesidad. #111111 también puede ser tinta auxiliar digital; coincidencia con una paleta no obliga a migrar el componente.
- No tocar fotografía, video HD, poster, logo, CSS de geometría, copy, fuentes, navegación, formularios, disponibilidad ni seguridad.

## 4. Implementación propuesta (siguiente commit, no en este PR de preparación)

1. Inventariar declaraciones por propiedad, selector, cascada, breakpoint y estado (incluidos hover, focus-visible, disabled, reduced motion y pseudo-elementos).
2. Definir tokens digitales canónicos y alias semánticos en la fuente compartida existente. No agregar una hoja al paquete sin revisar la allowlist. Centralizar gradualmente duplicados exactos; evitar reemplazo masivo de HEX y valores gráficos.
3. Mantener el mismo color computado de componentes aprobados. Cualquier desviación visible requiere diff y justificación; no mover el orden de la cascada.
4. Extender pruebas de tokens y de colores computados a las 26 páginas, source y dist, escritorio y móvil. Contraste WCAG AA 4.5:1 texto normal, 3:1 texto grande y componentes no textuales relevantes. Revisar foco, teclado, zoom y movimiento reducido; no afirmar conformidad global por Lighthouse.
5. Comparar capturas base/candidato y geometría, con video en fotograma estable; verificar hashes de media, logo y GLB. Registrar excepciones auxiliares por función. No exigir una proporción exacta de píxeles 60–30–10.
6. Ejecutar los cinco controles obligatorios, compilación reproducible, pruebas unitarias e instrumentadas, cobertura de alcance explícito, mutation smoke, seguridad y Lighthouse. Revisar presupuestos CSS (styles.css cercano al límite), manifiesto y NOINDEX. No debilitar contratos ni límites.
7. Entregar evidencias, solicitar autorización para fusionar el SHA exacto; publicación manual protegida separada, sin DNS.

## 5. Estado

Preparación solamente. El manifiesto config/brand-dual-palette-plan.json no se consume en el runtime ni forma parte de la lista de publicación existente. No se han ejecutado nuevas capturas de las 26 páginas para esta preparación: el inventario es de código fuente. Las capturas y mediciones computadas quedan como criterios de aceptación de la implementación.
