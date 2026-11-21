# PRIME-CANONICAL-01 — Integración de DESSET Prime como web oficial (NO DEPLOY)

**Estado:** candidato de integración / NO-GO para merge y publicación hasta cierre de todas las verificaciones y autorización por SHA.

## Fuente de verdad y trazabilidad

- Repositorio único de la web oficial propuesta: `M0-coder/DESSET-prime`.
- Base de `main` verificada al iniciar esta preparación: `ec6899d56a4befefea0402e9cca7419d3dca5e7e`; solo contenía `README.md`.
- Candidato de origen íntegro: `2dc9eea0a5678daf30189602453b79685f046daa`, HEAD del PR #23. Comparado con `main`: 469 commits ahead, 0 behind, 141 ficheros modificados o añadidos.
- Esta rama **reúne** el candidato mediante ascendencia Git; no copia archivos ni CSS de `M0-coder/DESSET` y no fusiona automáticamente los PR #1–#23.
- El repositorio `M0-coder/DESSET` representa únicamente la web pública temporal y una referencia operativa para respaldo/rollback; **no es fuente de diseño ni código de Prime**.

## Alcance de aceptación obligatorio

Primero fijar el alcance: arquitectura; compilación; pruebas unitarias e instrumentadas; cobertura; análisis estático; calidad de CI; seguridad; reproducibilidad; mutation testing; deuda técnica y evidencia de ejecución.

1. **Identidad y edición:** cotejar con los frames aprobados en Figma; verificar tipografía realmente distribuida y licencias, escala legible, espaciados, colores y componentes. Evitar certificar fidelidad con capturas de un solo navegador. El acceso de auditoría a Figma debe ser verificable.
2. **Limpieza de código:** eliminar físicamente DOM decorativo oculto sin función, sus CSS y cualquier listener/test obsoleto; conservar el logo, fotos y sistema WebGL2 aprobados. Reducir duplicidad de hojas de estilo sin cambiar el resultado visual.
3. **Aplicaciones:** mantener la web institucional **sin pedidos ni pagos**; ninguna app se anuncia disponible sin prueba de su publicación oficial.
4. **Canales:** diferenciar `owner-attested` de verificación independiente. No llamar `verified` a cuentas sin prueba técnica. Ningún enlace comercial ni teléfono/correo se inventa.
5. **Pruebas:** `npm ci --ignore-scripts`, `npm run build:site`, `npm run verify:site`, `npm test`; auditorías HTTP, navegador (320/390/768/1024/1440 px), WebGL2, Lighthouse móvil/escritorio, controles de zoom, teclado, reducción de movimiento y contraste.
6. **Suministro y seguridad:** licencia de imágenes y modelos; SBOM, `npm audit`, CSP y cabeceras, rutas sin recursos rotos, firmas/sha256 de artefacto, comparación byte a byte de dos compilaciones independientes; mutaciones más allá de cuatro ejemplos y cobertura de ejecución representativa.
7. **CI y gobierno:** checks y evidencia válidos sobre el **SHA final** de este PR; revisión visual humana, conflictos, revisión de derechos y estado de contacto/SEO expresamente documentados antes de cambiar `draft` o fusionar.
8. **Publicación independiente:** después de integración y autorización separada, identificar despliegue anterior exacto y backup restaurable, validar rollback y certificados; desplegar el artefacto aprobado a `desset.lat` / `www.desset.lat` mediante el workflow manual con el SHA y las variables de autorización correctas. No alterar DNS por inferencia. El cambio de `noindex` requiere aprobación SEO separada.
9. **Retiro del sitio anterior:** únicamente tras verificar que ambos dominios sirven Prime de forma segura y recuperar/respaldar la versión anterior. Retirar el **servicio público** experimental, sin borrar repositorio, historial, ramas ni despliegues de rollback antes de una decisión explícita de retención/eliminación.

## Evidencias de partida (NO equivalen a autorización de publicación)

- SHA `2dc9eea0a5678daf30189602453b79685f046daa`: Actions `44877406028`: 223 tests Node, 25 capturas, 36 pruebas WebGL2, Lighthouse mobile performance 97 / accessibility 100 / best practices 100; desktop 100 / 100 / 100. Son medidas de CI en laboratorio.
- `44877406114`: evidencia de licencias y SBOM. `44877406068`: preflight de artefacto sin publicación.
- Defectos de diseño y accesibilidad **todavía abiertos**: Inter declarada pero no incluida; múltiples cascadas CSS; nodos ornamentales ocultos con `display:none!important`; comprobación visual directa contra Figma pendiente.
- Las cifras del SHA de partida **no certifican** un futuro SHA con cambios.

## Reglas de ejecución

**NO MERGE, NO AUTO-MERGE, NO RELEASE, NO DEPLOY, NO DNS/CLOUDFLARE, NO DELETE.** Esta rama y su PR solo proporcionan un diff canónico revisable frente a `main`. La autorización de integración y la de publicación son decisiones independientes con SHA exacto. 
