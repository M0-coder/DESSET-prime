# DESSET Prime / primera interfaz ejecutable

**Rama:** `design/figma-v1-no-deploy`. **Estado:** CANDIDATO DE COMPOSICIÓN — NO APROBADO, NO PUBLICAR.

## Qué contiene

- Web corporativa estática en `index.html`, `styles.css`, `scripts/app.js`.
- **Archivo de marca original** `assets/deliver-assets-mark.png` copiado del Git blob idéntico de `M0-coder/DESSET` (`fa6cb4ea5c5331c4cf47dfd157214e972f809356`).
- Encabezado tipográfico `DESSET` en texto HTML como etiqueta legible de interfaz. **NO es un nuevo wordmark ni sustituye su diseño definitivo en Figma**.
- Estructura editorial propia: inicio, visión, soluciones, ecosistema, contacto; diseño responsive y motion CSS con reducción de movimiento.
- Sin fotografías sintéticas, ciudades, compradores inventados, métricas falsas, apps descargables ni backend comercial.
- **Noindex** por tratarse de prototipo, CSP restrictiva y CI de solo lectura.

## Probar localmente

```sh
node --check scripts/app.js
node --test tests/*.test.mjs
python3 -m http.server 8080
```

Abrir `http://localhost:8080/`. Sin dependencias de npm ni llamadas a servicios externos.

## Qué NO está verificado todavía

1. El diseño definitivo de Figma: frames `26:2`, `29:2`, wordmark `59:198`, brand governance `280:3`, logo source control `297:2`.
2. Aprobación visual por parte del fundador.
3. Inspección browser instrumentada desktop/mobile/tablet, contraste, teclado, zoom 200% y 400%, capturas comparativas.
4. Coverage formal, mutation score, linters avanzados, scanner SAST/SCA, presupuestos de rendimiento.
5. Licencia y titularidad/cesión final de marca y medios.
6. Salida comercial: ningún sitio o app está habilitado por este candidato.

## Orden del próximo gate

- Validar visualmente Figma exacto y sustituir únicamente tokens/representaciones no coincidentes, sin alterar el símbolo original.
- Ejecutar y adjuntar auditoría de navegador y pruebas instrumentadas sobre esta rama.
- Elaborar propuesta visual y solicitar aprobación exacta del fundador.
- Merge y publicación siguen requiriendo **autorizaciones independientes**.

**Prohibido:** deploy automático, Cloudflare, DNS, cambiar la web oficial, fusionar o borrar ramas, presentar operaciones inexistentes.
