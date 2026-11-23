# PRIME-3D-03 / 04 — Corrección espacial y operativa del centro 3D

**Estado:** propuesta en PR #43; sin autorización para fusionar, publicar, alterar DNS, SEO o la portada.

## Diagnóstico reproducible

La primera revisión del PR #43 mejoró detalles arquitectónicos, pero no resolvió el problema principal. Las cuatro puertas del almacén están en x locales `[-2.72,-.91,.91,2.72]`, con nave posicionada en x=-5 para escritorio; la flota anterior se renderizaba en x≈0.98 y sus camiones no podían acoplarse de manera correcta. Además, la tarjeta `Estado de muelles` tapaba parte del edificio y en móvil otra tarjeta ocupaba parte del patio. CI 5/5 de aquella versión no certificaba calidad compositiva.

## Arquitectura correctiva

- Se conservan byte a byte los tres GLB registrados y sus hashes. **El GLB combinado de flota sigue cargando para mantener el contrato legado, pero permanece oculto**. Esto es deuda técnica explícita que habrá que resolver al migrar formalmente el asset de flota. **No se simula que esté reemplazado en el inventario.**
- Los cuatro camiones de muelle visibles se generan con 16 lotes `THREE.InstancedMesh` de geometría original. Cada camión tiene su propia matriz de posición, permitiendo llegadas y salidas sin multiplicar las draw calls por cuatro. El **quinto vehículo**, más compacto, ya existe en el GLB del patio; no se duplica.
- Las puertas tienen centros locales x = -2.72, -0.91, 0.91 y 2.72. Los cuatro vehículos de muelle están alineados horizontalmente con esas posiciones y se estacionan con el extremo del remolque junto al nivelador, aproximadamente z local 2.1.
- Fases de simulación: llegada a la puerta 01, carga en la puerta 02, salida desde la puerta 03, disponibilidad en puerta 04; la quinta unidad permanece en patio. Los estados de llegada y salida del HUD se actualizan con la misma cronología simulada, incluida la retención de la posición final del camión al concluir el recorrido. Una apertura visual en puerta 02 evita que el panel diga «En carga» frente a una persiana completamente cerrada.
- La animación del arribo y de la salida se integra en el recorrido guiado existente; no se descargan nuevos recursos externos ni se agregan temporizadores o telemetría. La pausa y la suspensión fuera de pantalla suspenden el movimiento.
- El panel de muelles queda al costado de la escena en escritorio, mientras que los dos paneles se ocultan bajo 1000 px para dar prioridad al modelo. La píldora DEMO permanece visible cuando WebGL está activo. El encuadre móvil se reduce en ángulo cenital, y la cuadrícula queda atenuada.
- Los añadidos arquitectónicos anteriores (lucernarios, marquesinas y señalización) permanecen y se alinean con los cuatro muelles físicos.

## Riesgos y limitaciones

1. El modelo sigue siendo una maqueta de geometría procedural; no implica operación real de DESSET Prime, GPS, despacho, flota activa ni capacidades habilitadas.
2. El GLB legado de flota supone tráfico de red innecesario mientras se mantiene el contrato de tres GLB; una migración posterior debe rehacer el asset, actualizar hashes e inventario con autorización y prueba de reproducibilidad.
3. La prueba GPU usa SwiftShader de Chrome, **no prueba teléfonos físicos, batería ni Web Vitals de campo**.
4. Las pruebas deben verificar alineaciones, 5 vehículos visibles, 4 puertas, 4 tractores visibles y el vehículo auxiliar original del patio, escena de carga abierta, fallback, contenido de simulación, encuadre y presupuestos GPU. El aspecto estético requiere además revisar las capturas PNG.

## Alcance de calidad

Arquitectura, compilación (Node 22.16.0, Three.js 0.187.0 y esbuild 0.28.2), unitarias/instrumentadas, cobertura limitada, análisis estático, CI 5/5, seguridad HTTP y SCA, reproducibilidad, mutation smoke, deuda técnica y evidencias. La calidad del frontend no se declara **PASS** hasta comparar capturas GPU de escritorio, tablet y móvil y verificar que los vehículos no ocultan los muelles.

No merge, no releases, no publicación automática, no modificación de Cloudflare.
