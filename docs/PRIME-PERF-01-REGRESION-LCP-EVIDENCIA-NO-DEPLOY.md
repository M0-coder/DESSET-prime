# PRIME-PERF-01 — Optimización móvil y evaluación de la observación 98→94 (NO DEPLOY)

## Decisión de alcance
Solo PR #24 DRAFT del repositorio M0-coder/DESSET-prime. No merge, no Cloudflare, no DNS, no indexación, no cambios al 3D ni a recursos binarios. La fotografía principal aprobada y los glifos licenciados se conservan.

## Hallazgos de Lighthouse
El LCP de la portada en móvil es la fotografía `assets/desset-hero-entrega-mobile.webp`, no el canvas WebGL. En la muestra que marcó 94/100, 1936 ms del LCP eran retraso de presentación; el recurso ya tenía `fetchpriority=high` en el elemento, pero no una prioridad anticipada de descubrimiento en el HEAD.

| Variante y evidencia | GitHub SHA / run | BenchmarkIndex | Rendimiento móvil | LCP móvil | TBT móvil |
|---|---|---:|---:|---:|---:|
| CLEANUP-02 antes de fuentes | `cde19ed0` / `44881430594` | 2908 | 98 | 2331 ms | 0 ms |
| Fuentes locales, antes de optimización | `c607f8d0` / `44883764146` | 1897 | 94 | 2862 ms | 97 ms |
| Imagen con preload viewport (R1) | `56b45a2f` / `44884317996` | 1988 | 87 | 2712 ms | 348 ms |
| Marco móvil reducido a 0.65 s (R2) | `c55aba68` / `44884492421` | 2999 | 95 | 2782 ms | 0 ms |
| Marco + imagen móvil reducidos a 0.65 s (R3) | `b977e5e9` / `44884668002` | 2190 | 96 | 2723 ms | 4 ms |
| Revelación móvil alternativa (R4, descartada) | `b6be7c14` / `44884882716`, intento 1 | 1323 | 61 | 3349 ms | 2547 ms |
| Misma R4, sin cambios (descartada) | `b6be7c14` / `44884882716`, intento 2 | 1517 | 86 | 2706 ms | 393 ms |
| Misma R4, sin cambios (descartada) | `b6be7c14` / `44884882716`, intento 3 | 2516 | 90 | 2706 ms | 281 ms |

**Interpretación**: el benchmark de CPU del runner varió entre 1323 y 2999. Las ejecuciones no son comparables uno a uno y no permiten afirmar que una edición sola cambió el puntaje. El mismo commit R4 osciló 61→86→90 sin alteración alguna, evidencia de inestabilidad del laboratorio. Mantener el gate de CI: no bajar umbrales ni ocultar resultados fallidos. No existe todavía evidencia sólida de retorno a 98.

## Optimización conservada
1. Dos `link rel=preload` responsivos y mutuamente excluyentes en el HEAD apuntan a las fotografías reales, sin imágenes nuevas ni solicitudes externas; la imagen en el DOM sigue `loading=eager`/`fetchpriority=high`.
2. En móvil con preferencia de movimiento normal, marco y foto usan su animación editorial original con duración de 0.65 s y sin retraso. Escritorio conserva las duraciones originales (1.35 y 2.05 s) y movimiento reducido elimina animaciones.
3. Se descarta la versión móvil R4 que sustituyó animaciones por una revelación alternativa porque no aportó pruebas reproducibles de beneficio y produjo valores CI demasiado variables.
4. Contratos de pruebas verifican preloads, media queries, activos, CSS de fuente/dist y preservación de noindex.

## Evidencia de no regresión visual
Se compararon las capturas finales del candidato con el estado previo tipográfico mediante comparación binaria de píxeles: `desktop-final.png`, `mobile-final.png`, `mobile-320-final.png` y `mobile-reduced-motion.png` son idénticas píxel a píxel. No se modificaron los binarios de fotografías, modelos GLB o fuentes. La animación de entrada móvil tiene menor duración, lo cual no garantiza paridad exacta fotograma a fotograma durante la transición.

## Verificación exigida antes de aceptar rendimiento
Como siguiente etapa de aceptación, medir versión previa y actual **en el mismo runner y sesión**, con idéntico navegador, throttling, ejecución fría y orden de test alternado A/B; recopilar al menos tres resultados por variante, mediana y distribución de BenchmarkIndex, LCP, TBT, CLS y score. Mantener tanto los datos atípicos como los fallos en la evidencia. Posteriormente validar en dispositivos físicos y rendimiento real (Core Web Vitals de campo cuando haya tráfico). Un 98 aislado en un CI favorable tampoco certificaría una corrección sostenible.

## Autoridad y NO-GO
El PR es DRAFT. Esta optimización **no está certificada para merge/despliegue**, no modifica DNS, dominios, producción, ni el mecanismo de entrega. La autorización de lanzamiento exige revisión empresarial por SHA y aceptación visual/móvil.
