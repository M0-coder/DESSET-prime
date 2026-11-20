# DESSET Prime — RENDER-03: geometría selectiva de tres modelos GLB

**SHA de referencia:** `f6cd2ac379da34a853ffb033da541679d957769e` (PR #5). Este PR se apila sobre RENDER-02, sin incluir el PR #3 editorial y sin modificar el diseño institucional original.

## Alcance exacto
- **Comercio:** chaflán sutil en edificio azul, cubierta y toldo; pilastras y remate de fachada.
- **Repartidor:** chaflán en el carenado y el baúl con su tapa; filetes de contorno del cajón.
- **Destino:** chaflán en muros, puerta y paquete; dosel de entrada más definido. Se preserva la cubierta original.
- **Técnica:** nueve chaflanes en total (tres por GLB), generados con contornos octogonales y una extrusión sin subdivisiones. Sin nuevos materiales, colores, texturas ni dependencias.
- GLTFExporter sigue agrupando por materiales y conservando los identificadores del modelo; siguen vigentes los PBR de RENDER-02 y las luces de RENDER-01.

## Contratos de aceptación
- Los tres GLB juntos deben quedar por debajo de **760 KB**, además del presupuesto existente de 800 KB.
- Cada modelo debe contener exactamente 3 piezas fuente con chaflán y un aumento medido de geometría respecto a su baseline: comercio 2396, repartidor 2480, destino 1772 triángulos.
- WebGL2 en fuente y sitio empaquetado: menos de 9000 triángulos por GLB, menos de 160 draw calls en la escena, menos de 180 geometrías y ninguna sombra de GPU en móvil.
- Repetir compilación reproducible, pruebas unitarias, análisis estático, cobertura instrumentada de alcance declarado, seguridad HTTP, mutaciones dirigidas, navegación, movimiento reducido, Lighthouse y comparaciones visuales desktop/tablet/móvil.
- **No afirmar aprobación artística por un CI verde**: la comparación visual debe preservar la claridad, el estilo geométrico y las proporciones de los tres protagonistas. Rechazar regresiones.

**Gobierno:** DRAFT / NO MERGE / NO AUTO-MERGE / NO DEPLOY / NO RELEASE / NO DNS / NO CLOUDFLARE. Sin modificar producción, ramas preexistentes ni PR #2/3/4/5. Integración separada únicamente con autorización por SHA.
