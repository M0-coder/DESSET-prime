# VISUAL-03 — Tríptico cinematográfico DESSET
Base eb7da19890455777e88b18a394603061f98ecc48 · PR #10. Prototipo en DRAFT, sin merge ni despliegue.

En lugar de tres SVG de apariencia lúdica, cada una de las tarjetas ELEGIR/PREPARAR/ENTREGAR utiliza un encuadre distinto de la misma fotografía corporativa ya aprobada `assets/desset-hero-entrega-dos-espejos.webp`. El navegador usa `picture` para seleccionar WebP, conserva los SVG existentes exactamente intactos como fallback. No se crean uniformes, logotipos, aplicaciones o motos nuevas. La fotografía original tiene los dos espejos, mochila negra y uniforme azul aprobados.

**Limitación artística explícita:** la fase ELEGIR muestra contexto de comercio, no un teléfono ni una transacción; PREPARAR muestra el pedido listo para entregar; ENTREGAR muestra al repartidor recogiendo, no una entrega al domicilio. El recurso es un **tríptico de una sola toma**, no tres sesiones fotográficas independientes. No declararlo storytelling final si no comunica suficientemente cada acción. Los originales se conservan para poder revertir sin pérdida.

No cambian logo, portada, texto, CTA, motores GLB/WebGL, CSS institucional, configuración, dominio, rutas ni estado comercial. CSS local <5200B, sin nuevo asset ni carga de imagen adicional (se reutiliza la portada en caché). Pruebas de fuente y paquete: Node, navegador, movimiento reducido, lighthouse, WebGL2, HTTP security, reproducibilidad SHA, cobertura limitada y mutaciones dirigidas.

**NO MERGE / NO AUTO-MERGE / NO DEPLOY / NO RELEASE / NO DNS / NO CLOUDFLARE**. Requiere dictamen visual y autorización por SHA.
