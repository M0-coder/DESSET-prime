# DESSET Prime V4 — Identidad cinética editorial
**Estado:** candidato para revisión visual; NO APROBADO, NO DESPLEGADO, NO OPERATIVO.
**Repositorio:** M0-coder/DESSET-prime
**Rama:** design/v4-kinetic-identity-no-deploy
**Base:** V3 SHA edc9ac30fa0b2b5a2f34cfb519d4af7de1959294

## Fuente audiovisual
Video aportado por el fundador: oUFIpF0QAiawBjiGryMRFE5IKgdsZjPCUBywj(3).mp4 (54,6 segundos).
- ~08 s: tipografía masiva y apilada, contraste de amarillo y rojo sobre negro/azul, composición que llena el campo.
- ~22 s: escena de símbolo histórico en azul intenso sobre negro, con velocidad y cambios de escala.
**Interpretación autorizada:** trabajar con la *gramática de composición, color, jerarquía, secuencia y ritmo*. No copiar logotipos ajenos ni un frame literalmente. El diseño web debe tener navegación y semántica funcional.

## Cambios efectivos
- Hero editorial negro con las palabras «EL COMERCIO / SE MUEVE.» en amarillo y rojo, grafismo azul con tres planos, animación secuencial finita y enlaces válidos a soluciones y aliados.
- Símbolo original: assets/deliver-assets-mark.png, sin edición binaria y usado una sola vez dentro del hero (el header y footer conservan sus usos).
- Retirado de la portada el diagrama de cuatro funciones de V3. El SVG histórico permanece disponible como detalle expandible en ecosistema, sin inventar datos de operación.
- Flujo de tres momentos en lenguaje cotidiano: elegir, organizar, mover. Concepto futuro, no tracking en vivo.
- Responsive 320, 390, 768, 1024, 1440; teclado, foco y reduced-motion. No recursos de stock ni fuentes remotas.

## Arquitectura y semántica
Web institucional-comercial, estática y **no transaccional**. Las apps comerciales, pagos, reservas, pedidos y seguimiento activo no están disponibles a través de esta web.
- Sin captura de datos ni formularios.
- Canales enlazados: deben verificarse vigentes antes de producción.
- Colores: tokens originales de DESSET; el nombre visible «DESSET» es una etiqueta HTML provisional, **no** un wordmark nuevo.
- Figma: pendiente inspección directa de frames originales y confirmación formal del wordmark DESSET (límite de API durante auditoría previa).

## Alcance de aceptación de ingeniería
Primero fijar el alcance: **arquitectura, compilación, pruebas unitarias e instrumentadas, cobertura, análisis estático, calidad de CI, seguridad, reproducibilidad, mutation testing, deuda técnica y evidencia de ejecución.**
- Arquitectura: HTML/CSS/JS locales, sin dependencias, endpoints remotos ni build productivo.
- Compilación: no aplica para HTML/CSS estáticos; sintaxis JS verificada por Node 22.
- Unitarias: contratos Node sobre logo SHA, texto honesto, enlaces, accesibilidad y motion.
- Instrumentadas: Chrome CDP, snapshots de entrada/transición/final, viewport y navegación en móviles.
- Cobertura: falta cobertura cuantitativa de interacción y DOM; NO CERTIFICADA.
- Análisis estático: sintaxis + contratos; falta SAST adicional exhaustivo.
- CI: GitHub Actions con permisos read-only, sin despliegue, SHA de run y capturas.
- Seguridad: CSP en _headers con frame-ancestors y sin servicios; falta prueba de headers reales bajo servidor.
- Reproducibilidad: archivos estáticos sin librerías de terceros, CI con actions pinneadas; comprobar derivación exacta.
- Mutation testing: NO EJECUTADO; pendiente si se incorpora lógica JS sustantiva.
- Deuda: CSS V3 de componentes de otras secciones aún presente. Los selectores del hero V3 se eliminaron del bloque principal, pero conservar compatibilidad en breakpoints y animaciones base para no alterar los módulos no relacionados.
- Evidencia: capturas CI y auditoría JSON, con obligación de inspección visual humana.

## Gates que NO se consideran superados por CI
1. Correspondencia del sistema final con Figma (nodos y tipos).
2. Revisión del video y storyboard de movimiento por el fundador.
3. Revisión de ritmo real en móvil 320/390, 200 % zoom, contraste, lector de pantalla.
4. Validación jurídica y derechos de todos los activos para la entidad formal.
5. Aprobación de copy, alcance empresarial y todas las afirmaciones públicas.
6. Autorizaciones independientes para PR merge, deploy, Cloudflare/DNS, indexación y lanzamiento comercial.

**Prohibido:** auto-merge, release, despliegue, cambio a M0-coder/DESSET, DNS, modificaciones a Figma, sustitución del logotipo, borrar ramas.
