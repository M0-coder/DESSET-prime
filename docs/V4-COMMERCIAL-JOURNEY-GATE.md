# DESSET Prime — V4.2 Commercial Journey Gate

**Estado:** candidata NO APROBADA / SIN MERGE / SIN DESPLIEGUE.
**Fecha:** 2026-11-19. **Rama:** `design/v4-kinetic-identity-no-deploy`.
**PR:** https://github.com/M0-coder/DESSET-prime/pull/1 (draft, base `design/v3-identity-led-no-deploy`).

## Propuesta de negocio que sí se puede afirmar
DESSET *desarrolla* una propuesta digital de pedidos y coordinación de última milla. La arquitectura distingue a personas, comercios, reparto y control. Este sitio **es una presentación**, no un canal de compra, registro, checkout ni contratación de entregas. Se buscan conversaciones con comercios y posibles aliados, sin afirmar que la operación esté habilitada.

**No afirmar:** clientes/repartidores activos, crecimiento, cobertura geográfica, disponibilidad comercial, integraciones funcionales, medios de pago, empresa legalmente constituida, acuerdos en vigor o servicios reales sin soporte documental independiente.

## Implementación V4.2
1. Hero: copy concreto para quienes tienen comercios; conserva la dirección cinética, la identidad histórica y los dos enlaces internos válidos.
2. Soluciones: delivery y pedidos como enfoque inicial; paquetería y comercio extendido como expansiones hipotéticas.
3. Recorrido: tres ilustraciones vectoriales de autoría creada específicamente en este PR: elección en un dispositivo conceptual, preparación de un paquete en un local conceptual y ruta de distribución de un paquete. NO se muestran marcas de terceros, interfaces funcionales ni repartidores reales. SVG locales `scene-choose.svg`, `scene-prepare.svg`, `scene-move.svg`.
4. Bloque de comercios: pregunta concreta sobre pedidos, texto que invita a validar necesidades y CTA `#contacto`. El sitio no solicita información ni envía formularios.
5. Contacto: redes públicas tal como estaban enlazadas en V4, sin crear nuevas direcciones de correo, WhatsApp o teléfono. El acceso a Instagram es un **enlace existente, no validado como canal oficial o operativo**. La verificación externa de Instagram, X y Facebook fue inconclusa; confirmar titularidad, acceso y capacidad de respuesta antes de su uso público.
6. Identidad: el PNG `assets/deliver-assets-mark.png` y el SVG original de arquitectura permanecen intactos. No se inventó ningún wordmark.
7. Responsive: SVG simplificados en móvil y sección comercial editorial con botón de al menos 48px. Movimiento y modo reducido se conservaron.

## Alcance de pruebas
**Primero fija el alcance: arquitectura, compilación, pruebas unitarias e instrumentadas, cobertura, análisis estático, calidad de CI, seguridad, reproducibilidad, mutation testing, deuda técnica y evidencia de ejecución.**

| Área | Estado y evidencia |
| --- | --- |
| Arquitectura | HTML/CSS/JS, sin backend ni integración de pagos |
| Compilación | HTML/CSS estáticos; JS verificado con `node --check` |
| Unitarias | Contratos de marca, copy, CTA, vectores y flujo |
| Instrumentadas | Chrome CDP, escritorio 1440/1024/768, móvil 390/320, reduced-motion |
| Cobertura | Sin cobertura porcentual certificada |
| Análisis estático | Contratos y sintaxis; SAST amplio pendiente |
| Calidad de CI | Actions pinneadas por SHA, checkout de lectura, sin deploy |
| Seguridad | CSP definido localmente, pendiente prueba de headers HTTP reales |
| Reproducibilidad | SHA exacto y 14 capturas de navegador con JSON de diagnóstico |
| Mutation testing | Kill test puntual de Escape del menú; score general no medido |
| Deuda técnica | Consolidación de estilos históricos y limpieza de selectores huérfanos pendientes |
| Evidencia | Run de trabajo https://github.com/M0-coder/DESSET-prime/actions/runs/44487633824 |

Run de V4.2 **SUCCESS**, SHA `9a64c93e83df7fb1995db17f9ad8fa76d665682a`, 27/27 pruebas, 6 estados de navegador, 14 capturas, sin fallos reportados. Artifact `desset-prime-v4-evidence` ID `14511361702`, digest `sha256:05f7eb7a54e20b0dae708097b011d44daf8ec8ce33898d612f9099f448e97c4d`.

## Riesgos y puertas de aprobación (NO-GO)
1. **Figma:** la API devolvió `Figma MCP tool call limit on Starter plan` en el frame `26:2`; el diseño canónico y tipografía no están verificados. No sustituir ni editar la identidad original para compensar esta limitación.
2. **Canales de contacto:** la validez/titularidad de los enlaces sociales y la existencia de un canal empresarial principal no están comprobadas. No publicitar un contacto como verificado hasta comprobarlo.
3. **Protección de main:** GitHub reporta `main.protected=false`. Habilitar branch protection, revisiones y status checks requerirá autorización separada y administración del repositorio.
4. **Estrategia de integración:** PR #1 tiene base `design/v3-identity-led-no-deploy`, no `main`. La revisión no autoriza fusionarlo ni retargetearlo automáticamente.
5. **Verificación profesional:** contrastes y zoom 200/400%, lector de pantalla, real-device performance, CLS/LCP/INP, enlaces sociales y derechos de marca pendientes.
6. **Gobierno operativo:** preservar publicación institucional distinta de las apps comerciales. Ningún cambio a Cloudflare, DNS, `M0-coder/DESSET`, release, auto-merge o publicación sin SHA autorizado.

**Decisión recomendada:** listo para revisión creativa y comercial sobre la rama; **NO-GO** para lanzamiento hasta que Figma, canales, seguridad/gobierno y documentación legal se validen.
