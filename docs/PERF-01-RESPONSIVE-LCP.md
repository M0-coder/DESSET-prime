# DESSET Prime — PERF-01 · Diagnóstico de rendimiento y prioridad segura de imágenes

**Base:** `fcac31dafa51c80b6d03ab8569cb7cef211c3719`, PR #11. Solo experimento en PR DRAFT; no publicación.

## Alcance inicial, resultados y decisiones
1. **Precarga responsive para el LCP:** se ensayaron dos `link rel=preload` mutuamente excluyentes. A pesar de CI técnico PASS, Lighthouse móvil cayó **98→97** y LCP pasó de **2328,89 ms a 2407,87 ms**. No se acreditó mejora. **DESCARTADO Y RETIRADO DEL CÓDIGO.**
2. **Diferir el póster 3D conceptual:** Lighthouse mantuvo ~98 con LCP **2329–2332 ms**, pero el control WebGL2 detectó que el póster visual no estaba disponible antes del opt-in. **NO-GO; REVERTIDO a eager.** No se relaja el contrato de recuperación del póster.
3. **Priorizar correctamente las tres fotografías secundarias:** se conserva `picture` WebP independiente + SVG de respaldo + `loading=lazy`, con **`fetchpriority=low`** explícito en los tres `img`. No afecta CSS, escala, aspecto, imagen, texto ni interfaz. La portada mantiene alta prioridad y el póster 3D sus garantías preexistentes.

## Aceptación
- No se afirmará aceleración de LCP porque las mediciones de laboratorio no acreditaron ninguna.
- Pruebas de contrato + Chromium confirman imagen responsive real, hero high/eager, **póster eager/low** y tres imágenes lazy/low. Control WebGL2 no puede fallar. Valores de LCP son laboratorio, no Core Web Vitals de campo.
- Suite Node, análisis estático, carga 3 GLB WebGL2 fuente y `dist`, seguridad HTTP, compilación reproducible con hashes, cobertura instrumentada acotada, mutaciones dirigidas y Lighthouse.
- Toda regresión visible, en tests, o en funcionalidad es NO-GO.

**GOBIERNO:** DRAFT / NO MERGE / NO AUTO-MERGE / NO DEPLOY / NO RELEASE / NO DNS / NO CLOUDFLARE. Los binarios de las imágenes, el motor 3D, el logotipo, la portada y `desset.lat` permanecen intactos.
