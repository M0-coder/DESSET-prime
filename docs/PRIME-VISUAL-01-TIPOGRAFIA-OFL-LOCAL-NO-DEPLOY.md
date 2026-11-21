# PRIME-VISUAL-01 — Tipografía libre, local y verificable (SIN DESPLIEGUE)

Estado: implementación solo en PR #24 draft de `M0-coder/DESSET-prime`; no autoriza merge, publicación, DNS ni eliminación de la web anterior.

## Alcance
- **Inter** variable 100–900: lectura, navegación, textos, botones e interfaz.
- **Plus Jakarta Sans** variable 200–800: titulares editoriales seleccionados, máximo peso 800 sin síntesis artificial.
- Fuentes WOFF2 locales; sin Google Fonts remoto, CDN, nuevas dependencias npm ni licencias de pago.
- Los modelos GLB, motores 3D, fotografías, textos, CTA, dominio, navegación y secuencia visual permanecen intactos.

## Licencia y procedencia
Ambas familias se distribuyen bajo la SIL Open Font License 1.1. No son propiedad intelectual exclusiva de DESSET; se deben conservar sus copyright y licencia. Uso comercial permitido conforme a OFL, sin exclusividad ni certificado de marca.

Fuente de los binarios y licencias: [Fontsource/font-files](https://github.com/fontsource/font-files/tree/5a72889057f592bb0659629e38337359f94d53b2), commit upstream `5a72889057f592bb0659629e38337359f94d53b2` del 2026-11-03.

| Archivo incluido | Blob Git SHA-1 del origen | Tamaño |
|---|---|---:|
| `fonts/inter-latin-variable.woff2` | `d15208de03cd1ad7c5199f0a0ce915fe841e4722` | 48 256 B |
| `fonts/plus-jakarta-sans-latin-variable.woff2` | `a180dc40f205fc48979a75ccbe8a10221a71a4ba` | 27 348 B |
| `fonts/LICENSE-Inter-OFL.txt` | `40589daa9de8bc96606292ea0be712ff0f0626eb` | 4 477 B |
| `fonts/LICENSE-Plus-Jakarta-Sans-OFL.txt` | `d82b0820892c94be963fd958ef1817245c52a472` | 4 534 B |

Los archivos originales aparecen en `fonts/variable/{inter,plus-jakarta-sans}/files/` dentro del upstream. Los subconjuntos Latin cubren español; lenguas o símbolos fuera de ese repertorio requieren cobertura adicional validada.

## Arquitectura y seguridad
- `styles-typography.css` se carga al final: cambio modular y reversible sin alterar el código 3D.
- Preloads locales `font/woff2`, `font-display:swap`, reservas de pesos reales; las fuentes no necesitan terceros en tiempo de ejecución.
- `font-src 'self'` explícito en CSP HTTP, fallback de HTML y servidor de auditoría.
- 31 archivos en el paquete original, 34 en ensayo de staging, 35 en paquete manual; fuentes y avisos entran en inventarios SHA-256.
- Verificador de fuente y licencia exige SHA-1 del objeto Git upstream exacto y metadatos de derecho de terceros, diferenciados de medios declarados por el propietario.
- No se añade fuente a `config/prime-original-assets.json` porque no es un activo original de DESSET.

## Aceptación técnica antes de fusionar
Exigir arquitectura, compilación reproducible, pruebas Node y del navegador, contratos de derechos y negativos, seguridad HTTP y CSP, accesibilidad y dimensiones móviles, static gate, cobertura medida de alcance limitado, mutaciones dirigidas, QA WebGL2, Lighthouse y cuatro workflows verdes para el mismo SHA. Prueba en móviles físicos y conformidad visual con Figma aún requieren validación humana: CI no garantiza equivalencia pixel a pixel.

## Límites
Sin auto-merge, sin cambios en `main`, sin despliegues Cloudflare, sin DNS, sin indexación, sin borrar la web original ni ramas. La publicación requiere aprobación expresa posterior por SHA.
