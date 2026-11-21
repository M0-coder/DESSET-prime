# PRIME-CLEANUP-02 — Retiro de imágenes ocultas del 3D y controles obsoletos

**Estado:** modificación solo en PR #24, no publicada. Base confirmada al iniciar: `3796b5c8bf6592b383e1e812ed5c1805ea823e8f`.

## Objeto
El tramo `#ecosistema .v5-city-stage` cargaba una imagen WebP dentro de `<picture class="v5-responsive-art">`. Con WebGL2 activo esa imagen se ocultaba por CSS y permanecía como una segunda superficie por debajo del canvas. El titular solicita su **eliminación física**, no otra máscara `display:none`.

## Supresiones
- HTML: `<picture class="v5-responsive-art">` y todos sus `source`/`img`, `v5-stage-scan`, `v5-stage-legend`, cuatro controles `[data-v6-camera]` permanentemente ocultos, botón también oculto `v6-poster`.
- Archivos de origen y artefacto: `assets/v5-cinematic-desktop.webp`, `assets/v5-cinematic-mobile.webp`, `assets/v5-logistics-mobile.svg`, `assets/v5-logistics-scene.svg`.
- CSS: selectores y keyframes específicos de la ilustración/escáner V5 y del botón obsoleto; referenciación de imágenes eliminada de gates, browser, GPU, HTTP y mutation tests.
- Registro de derechos actualizado de 18 activos originales a 14 activos utilizados; mantener la trazabilidad histórica en Git, sin atribuir falsamente esos cuatro recursos a la distribución vigente.

## Sustitución funcional necesaria
- Una tarjeta **exclusivamente textual** `.v6-static-fallback`, con título y explicación verídica, permanece visible sin JavaScript, al reducir movimiento, ante WebGL2 no disponible, y durante la descarga del motor.
- Cuando el motor confirma modelos GLB y un frame renderizado, la tarjeta deja de estar visible/accesible y se muestra el canvas WebGL2; no se descarga ninguna imagen 2D de esa escena.
- Permanecen ocultos **dinámicamente** los controles y estados que tienen una función real: estado de preparación, botón manual para equipos de bajo rendimiento y panel de progreso de la visita guiada; también enlaces a aplicaciones aún no publicadas.
- Los tres modelos `v62-commerce.glb`, `v62-courier.glb`, `v62-destination.glb`, la foto aprobada de la portada, fotografías del recorrido y la marca se conservan.

## Calidad obligatoria
1. Compilación `npm ci`, `npm run build:site`, `npm run verify:site` y ausencia física de cuatro archivos obsoletos en `dist` y `source`.
2. Pruebas unitarias y mutaciones; HTTP/CSP y cabeceras; inventario original de derechos 14/14; SBOM; dos compilaciones independientes.
3. Browser QA 320/390/1440 px: fallback textual legible, sin imagen oculta y sin desplazamiento horizontal, navegación y movimiento reducido.
4. GPU real: tres GLB, frames/draw calls, recorrido y pausa, fallback tras cambio de breakpoint sin fugas de canvas; WebGL2 en source y dist; Lighthouse móvil/escritorio.
5. Compilar y revisar **el SHA final**. No confundir PASS de CI en Chrome SwiftShader con validación en móviles físicos ni con equivalencia pixel a pixel de Figma.

**Restricciones:** NO MERGE / NO AUTO-MERGE / NO RELEASE / NO DEPLOY / NO DNS / NO CLOUDFLARE / NO ELIMINACIÓN DE RAMAS O REPOSITORIOS.
