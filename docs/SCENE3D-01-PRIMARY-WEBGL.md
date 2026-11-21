# SCENE3D-01 — WebGL protagonista de «Elegir, preparar y entregar»
Base exacta: PR #11 `fcac31dafa51c80b6d03ab8569cb7cef211c3719`. NO MERGE / NO DEPLOY / NO DNS.
* El 3D empieza una sola vez al aproximarse a la sección (IntersectionObserver, 140px); no se descarga mientras se visualiza la portada.
* El póster WebP NO se borra: es respaldo transitorio hasta que estén cargados tres GLB y se dibuje un frame real; fallo, WebGL no soportado y movimiento reducido requieren imagen.
* Móviles compatibles muestran el 3D; Save-Data o memoria estimada inferior a 4GB conservan imagen y entrada manual. El render se suspende fuera de viewport.
* Quedan visibles únicamente el recorrido guiado y pausar/reanudar. Los 4 selectores de cámara y el botón de retornar al póster se ocultan; internamente se conservan para compatibilidad del motor y QA de fallback, sin modificar Three.js ni GLB.
* El trabajo se limita a HTML, CSS, controlador, auditoría GPU, test contrato y documentación. Ejecutar CI Node, browser, GPU fuente + dist, seguridad, reproducibilidad, mutación dirigida y Lighthouse. No constituye aprobación de producción.

Rendimiento revisado: la primera iteración autocomprobaba WebGL2 en la carga inicial y Lighthouse móvil descendió de 98 a 90 por TBT 337ms (LCP 2330ms). La corrección pospone incluso la detección sincrónica GPU hasta el scroll real (scrollY >= 120) y entrada del viewport. Este resultado deberá medirse nuevamente; no se acepta degradación material.
