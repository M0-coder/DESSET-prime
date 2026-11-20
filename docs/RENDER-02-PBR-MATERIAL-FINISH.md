# DESSET Prime · RENDER-02 — Materiales PBR de los tres GLB

**Base:** `cc14e516b6551083a44c42d6e2a7a09095d715b7` (PR #4, RENDER-01). PR apilado en borrador, NO MERGE, NO DEPLOY.

## Materiales ajustados
- Comercio: azul de metal pintado, toldo amarillo tejido, vidrio, acero y molduras.
- Repartidor: carrocería satinada, cajón de reparto mate, goma sin brillo plástico, acero y tejido.
- Destino: estuco rojo rugoso, cerámica clara, marcos anodizados, vidrio y piedra.

Se ajustan exclusivamente `roughness` y `metalness` en materiales `MeshStandardMaterial` de los GLB existentes. La geometría, tres GLB, cámara, animaciones, marcas, CSS, CTA y fallback WebP no cambian.

Se introduce **una sola textura 128×128 de rugosidad** (datos lineales, sin sRGB) generada en Canvas local y compartida entre los tres modelos. Se mejora además el albedo de **vidrio del comercio y del destino** con un gradiente de reflejo local de 256×256 por modelo (dos mapas compartidos por materiales del mismo modelo); no se usa mapa HDR ni reflejo físico externo. Los demás mapas de albedo locales permanecen. El mapa se libera por el registro `ownedTextures`; los materiales se cachean por fuente para evitar clones redundantes y las referencias reemplazadas se liberan.

**Presupuestos de aceptación:** WebGL2 sobre fuente y `dist`; 3 GLB; al menos 4 materiales afinados y 2 materiales con mapa de rugosidad por modelo; máximo 22 texturas en escritorio y 19 en móvil (baselines 18/16; hasta tres nuevas texturas: una rugosidad + dos acabados de vidrio); geometrías/draw calls dentro del presupuesto anterior; móvil sin sombras. Sin librerías, HDR, vídeo, bloom, redes ni cambio legal/comercial.

**Revisión visual obligatoria:** comparar capturas con PR #4 y versión original. NO-GO si reduce legibilidad, crea aspecto plástico o altera el modelo. No se declarará calidad cinematográfica definitiva por pasar CI.

**Gobierno:** DRAFT / NO AUTO-MERGE / NO MERGE / NO DEPLOY / NO RELEASE / NO DNS / NO CLOUDFLARE. Integración solo por nueva autorización de SHA.
