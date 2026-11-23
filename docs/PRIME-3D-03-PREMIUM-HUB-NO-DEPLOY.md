# PRIME-3D-03 — Refinamiento arquitectónico de DESSET Prime

**Alcance:** diseño del centro logístico 3D en `M0-coder/DESSET-prime`, sin merge, despliegue, DNS, indexación, cambios del hero ni activación de servicios.

## Fundamentación

La referencia entregada por el titular muestra una nave isométrica, camiones de carga y paneles de simulación. La implementación anterior ya tiene un hub, cinco camiones, muelles y tarjetas descriptivas. El problema no es la ausencia de Three.js: es la diferenciación arquitectónica y la lectura visual.

## Intervención de bajo riesgo

- Añadir **tres lucernarios con marcos metálicos** y una banda frontal azul al edificio existente.
- Marcar los **cuatro muelles** con marquesinas, protección lateral, líneas de detención y cuatro balizas conceptuales de estado.
- Marcar carriles en la zona de flota y salidas del patio con geometría 3D real, no una imagen superpuesta.
- Usar `THREE.InstancedMesh` para las piezas repetidas y limitar las draw calls; aprovechar el ciclo actual de animación para la pulsación discreta de las balizas.
- Conservar los **tres GLB originales y sus hashes** en `config/prime-original-assets.json`. Los detalles son independientes de los grupos vaciados por `hydrateGLBModels`, de modo que sobreviven a la hidratación.
- Mantener intactos los modelos de flota, el número de camiones, el póster de fallback, la activación gradual, la reducción de movimiento y el controlador del recorrido.
- Las balizas y tarjetas son **simulaciones**; no representan muelles reales ni telemetría.

## Criterios de aceptación

1. Compilación fijada en Node 22.16.0, Three.js 0.187.0 y esbuild 0.28.2; límites existentes de JS gzip, GLB y tamaño del sitio.
2. Pruebas unitarias, contratos de assets, análisis estático, cobertura instrumentada de alcance limitado, smoke de mutación, seguridad HTTP, política noindex y reproducibilidad.
3. Browser QA de escritorio y móvil: WebGL2 real, escena con 3 GLB, `premiumInfrastructure=true`, `dockBeacons=4`, capturas GPU y controles de pausa/recorrido.
4. Comparar capturas con la rama base; no presentar mejora estética subjetiva como resultado medido. Dispositivos físicos y Web Vitals de campo siguen pendientes.
5. PR sin merge automático; publicación separada y protegida por SHA exacto.

**Doctrina de alcance:** arquitectura, compilación, pruebas unitarias e instrumentadas, cobertura, análisis estático, calidad de CI, seguridad, reproducibilidad, mutation testing, deuda técnica y evidencia de ejecución.
