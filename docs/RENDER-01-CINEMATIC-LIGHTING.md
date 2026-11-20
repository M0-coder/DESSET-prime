# DESSET Prime — RENDER-01 / iluminación cinematográfica controlada

**Base:** `77d225d9ccf0cce66203d0625475ede4bab71227` — diseño institucional original, sin cambios del PR #3.

## Alcance de esta intervención

Mejora del render WebGL2 3D ya existente. **No** reestructura la portada ni crea un segundo motor: el CTA de la portada conserva el recorrido 3D opcional. No hay animaciones nuevas, GLB nuevos, imágenes externas, edición de estilos, cambios de copy comercial ni despliegue.

## Dirección de fotografía/render

- **Comercio / origen:** base azul DESSET, iluminada suavemente.
- **Repartidor / tránsito:** luz ambiental amarilla contenida.
- **Destino / entrega:** contrapunto rojo discreto.
- **Suelo:** se sustituyen tres manchas sólidas por tres máscaras de luz radial con bordes suaves, usando **una sola textura procedimental local de 128 × 128 px**.
- **Iluminación global:** ajuste fino de relleno cálido, rim frío, acento rojo y niebla para aumentar profundidad sin quemar los materiales.
- **Cámara, puesta en escena, modelos GLB y coreografía:** idénticos a la referencia. Un ciclo completo sigue durando 9,3 segundos.

## Activos exactos

| Recurso | Decisión |
|---|---|
| `scripts/v6-three.src.mjs` | Implementación de luces y suelo |
| `scripts/v6-gpu-browser-audit.mjs` | Pruebas WebGL desktop/mobile |
| `tests/render01-lighting.test.mjs` | Pruebas de contrato |
| `assets/v62-commerce.glb` | Sin cambios |
| `assets/v62-courier.glb` | Sin cambios |
| `assets/v62-destination.glb` | Sin cambios |
| `assets/v5-cinematic-*.webp` | Fallback intacto |
| `assets/v6-three.bundle.js` | Regenerado por CI; no se publica |

## Límites y reversibilidad

Tres planos sustituyen tres círculos: sin aumento de draw calls previsto. La textura se libera mediante `ownedTextures`; si el canvas 2D no está disponible, se conserva un círculo plano. La renderización no requiere red, rastreo, efectos posprocesados ni otra dependencia. En móviles el sombreado caro permanece desactivado. Si WebGL falla o el usuario prefiere menos movimiento, permanece la imagen WebP accesible.

## Evidencia requerida

1. CI de sintaxis, `npm ci`, compilación del bundle y `dist` verificado por hash.
2. Pruebas unitarias, cobertura declarada con alcance correcto y mutaciones dirigidas.
3. GPU WebGL2 real en el navegador CI (SwiftShader), tres GLB listos, 3 halos y fallback, pausado y reapertura.
4. Capturas escritorio, tablet y móvil; comparar el contenido con la referencia original.
5. Lighthouse laboratorio y límites de geometría/draw calls; no afirmar equivalencia con un teléfono físico.
6. Documento de decisión: GO de prototipo visual solo si las pruebas pasan y el cambio mejora la imagen. **NO-GO permanente para merge y deploy** sin autorización separada por SHA.
