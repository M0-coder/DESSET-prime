# HERO-MOTION-V2 / referencia del video original
Estado: candidato visual no aprobado, no desplegado.
Fuente: video aportado por el fundador, 54,6 s; revisado directamente.
- 8,25 s: composición tipográfica DELIVER ASSETS, amarillo y rojo, fondo azul/negro.
- 22,2 s: gran símbolo histórico en azul sobre negro.
- 23,0 s: patrón de símbolos repetidos con variación cromática.
Se adopta la gramática (jerarquía tipográfica, secuencia, escala, ecos) y no la geometría/recoloreo del montaje. **El único símbolo utilizado es el PNG original de GitHub**: Git blob `fa6cb4ea5c5331c4cf47dfd157214e972f809356`, sin modificar.
Nuevos archivos: `styles-motion-v2.css`, `tests/brand-motion.test.mjs`; web estática con CSS sin bucles, `prefers-reduced-motion`, sin requerir JS para mostrar contenido.
La hoja `styles.css` de V1 permanece como base para no afectar el resto de las secciones; **al aprobar un diseño definitivo hay que retirar estilos obsoletos de la portada** para evitar deuda técnica.
CI incorpora capturas de Chrome 1440×900 y 390×844, además de pruebas Node.
Pendiente: contraste visual con Figma, capturas inspeccionadas, QA de accesibilidad/overflow, pruebas instrumentadas de interacción y aprobación expresa del fundador.
Prohibido: modificar la web oficial, publicar, fusionar, cambiar Cloudflare/DNS o fingir operaciones.
