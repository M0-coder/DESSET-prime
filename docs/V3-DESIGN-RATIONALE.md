# DESSET PRIME V3 — Arquitectura comercial editorial
**Estado:** candidata NO APROBADA y NO PUBLICADA. Rama `design/v3-identity-led-no-deploy`.

## Por qué se rehizo V2
- La portada anterior repetía un PNG de 96×73 px en posiciones arbitrarias: marca redundante y composición débil.
- Las cuatro funciones solo eran nombres técnicos y no explicaban su utilidad.
- Los visitantes no tenían un recorrido claro para negocios y aliados.
- La narrativa era demasiado abstracta y podía servir a cualquier consultora.

## Cambios V3
1. Arquitectura corporativa de seis secciones, enfoque internacional sin ciudad protagonista.
2. Portada tipográfica editorial, con un solo gráfico de roles **original y aprobado como boceto**; no se inventó ningún símbolo ni se modificó el mark.
3. Explicación por líneas de negocio: delivery inicial vs horizontes, sin fingir operaciones.
4. Beneficios y destinatarios en lenguaje cotidiano: personas, comercios y aliados.
5. Enlaces a canales de la fuente de contenido oficial `M0-coder/DESSET/src/content.mjs`; verificar vigencia antes de eventual publicación.
6. Motion finito de entrada, sin scroll secuestrado, con reducción de movimiento.
7. CSS consolidado, sin efectos V1 residuales ni dependencias externas. Contacto sin formularios ni captura de datos.

## Propiedad y evidencia
- `assets/deliver-assets-mark.png`: Git blob `fa6cb4ea5c5331c4cf47dfd157214e972f809356` (exacto).
- `assets/roles-geometry-v2.svg`: Git blob `71401c4d0f93eeefcde393f18e82e165e50d8f90` (exacto).
- Procedencia y aprobación parcial del dibujo: `M0-coder/DESSET/docs/HERO-ROLES-APROBADO.md`.
- El texto de marca "DESSET" en la cabecera es rótulo HTML **provisional**, NO un wordmark formal nuevo. Falta confirmar el diseño canónico en Figma.

## Gates pendientes para publicación
Verificar Figma exacto, propiedad/licencias, pertinencia y accesibilidad visual, pruebas de interacción y navegación, responsive 320/390/768/1024/1440, seguridad de cabeceras en un servidor que las aplique, pruebas estáticas/instrumentadas, cobertura/mutation testing, rendimiento, indexación y consentimiento de comunicación. CI no implica aprobación de marca.

**Prohibido:** merger, despliegue, releases, DNS, pagos, pedidos, cambios a `M0-coder/DESSET`, alterar Cloudflare.
