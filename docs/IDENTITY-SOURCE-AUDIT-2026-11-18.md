# DESSET PRIME — Auditoría de identidad y procedencia visual

**Corte documental:** 18 de noviembre de 2026.  
**Alcance:** fuentes de solo lectura verificadas en GitHub y Notion; referencias existentes a Figma.  
**Destino:** `M0-coder/DESSET-prime`, rama `design/figma-v1-no-deploy`.  
**Estado:** **INVENTARIO VERIFICADO / IDENTIDAD FINAL NO RATIFICADA**. Este archivo no publica, aprueba, sustituye ni transfiere ningún activo.

## 1. Jerarquía de fuentes

1. **Figma original**: [DELIVER ASSETS — Editorial AI Concept](https://www.figma.com/design/cUGTTGlTB05xiKLL8NGcwG) (file key `cUGTTGlTB05xiKLL8NGcwG`). El archivo declara páginas de **Brand Governance**, **Logo Source Control**, **Website Final**, **Website Responsive Final**, **Design System Production**, **Asset Library** y **Production Handoff**.
2. **Registro técnico histórico**: [BRAND-SOURCE.md](https://github.com/M0-coder/DELIVER-ASESSET-pro/blob/main/docs/BRAND-SOURCE.md) y [DESIGN-SYSTEM.md](https://github.com/M0-coder/DELIVER-ASESSET-pro/blob/main/docs/DESIGN-SYSTEM.md).
3. **Activos versionados**: `M0-coder/DELIVER-ASESSET-pro`, `M0-coder/DELIVER-ASESSET-prime` y `M0-coder/DESSET`.
4. **Gobierno de propiedad intelectual y aprobación**: [DESSET-IP-01](https://app.notion.com/p/413eb559c05c815b96e4f921cbab6b32) y [Approve canonical Figma and brand system](https://app.notion.com/p/3adeb559c05c81eda02bfd768bb13f7d).

**No equiparar archivo, aprobación técnica, autoría, titularidad jurídica y autorización de despliegue.** Si hay versiones contradictorias, dejar constancia y solicitar decisión expresa; no reinterpretar un diseño de Figma.

## 2. Tabla de activos comprobados

| Activo | Fuente exacta | Git blob SHA-1 | Estado de utilización |
|---|---|---|---|
| Símbolo PNG de la web existente | [DESSET/assets/deliver-assets-mark.png](https://github.com/M0-coder/DESSET/blob/main/assets/deliver-assets-mark.png) | `fa6cb4ea5c5331c4cf47dfd157214e972f809356` | Fuente binaria comprobada, **no redibujar** |
| Símbolo PNG histórico Pro | [DELIVER-ASESSET-pro/public/brand/deliver-assets-mark.png](https://github.com/M0-coder/DELIVER-ASESSET-pro/blob/main/public/brand/deliver-assets-mark.png) | `fa6cb4ea5c5331c4cf47dfd157214e972f809356` | Mismo Git blob que el archivo usado por DESSET |
| Imagen institucional OG Pro | [DELIVER-ASESSET-pro/public/brand/og-brand.png](https://github.com/M0-coder/DELIVER-ASESSET-pro/blob/main/public/brand/og-brand.png) | `971b59d4fd9ebddc6d1d37881e3174080a73c89e` | Referencia de composición histórica; no asumir aprobación actual |
| Arte Rider original | [DELIVER-ASESSET-prime/assets/rider-ops-v2.svg](https://github.com/M0-coder/DELIVER-ASESSET-prime/blob/main/assets/rider-ops-v2.svg) | `f7a7455319246dfff998d84b8f727ff84d783479` | Arte real histórico; contenido operativo ilustrativo, no evidencia de tracking |
| Arte Business original | [DELIVER-ASESSET-prime/assets/business-ops-v2.svg](https://github.com/M0-coder/DELIVER-ASESSET-prime/blob/main/assets/business-ops-v2.svg) | `ce8c39fbc13c98fcab413355c31a87a02d7284d5` | Arte real histórico; no presentar interfaz como sistema productivo |
| Geometría de cuatro roles | [DESSET/assets/roles-geometry-v2.svg](https://github.com/M0-coder/DESSET/blob/main/assets/roles-geometry-v2.svg) | `71401c4d0f93eeefcde393f18e82e165e50d8f90` | Arte aprobado como boceto según documento técnico, no layout web final |
| Ojo animado oficial | [DESSET/assets/desset-eye.gif](https://github.com/M0-coder/DESSET/blob/main/assets/desset-eye.gif) | `0932bbfaca6fe9ab8fc27d27fdc370f1fe21ecf2` | Reutilizar solo si conserva pertinencia visual y opción sin movimiento |
| Ojo fijo | [DESSET/assets/desset-eye-still.png](https://github.com/M0-coder/DESSET/blob/main/assets/desset-eye-still.png) | `64dff28bd7d441cef7d5aa2cd2c48c92a4cf7e79` | Alternativa accesible |

## 3. Referencias Figma localizadas, pendientes de inspección visual

| Nodo / página | Función documentada | Estado actual |
|---|---|---|
| `277:5` | Símbolo PNG exportado desde Figma | Procedencia **documentada**, correspondencia binaria en Git |
| `59:198` | Wordmark **DELIVER ASSETS** histórico | No confirma el wordmark final **DESSET** |
| `59:196` | Desktop Navigation | No inspeccionada la composición visual actual |
| `59:2` | Design System Production | Tokens documentados, pero validación visual directa pendiente |
| `26:2` | Website Final | Nodo identificado, imagen/estructura fina pendiente |
| `29:2` | Website Responsive Final | Nodo identificado, imagen/estructura fina pendiente |
| `93:2` | Control Center / Platform Operations | Nodo identificado, no implica lanzamiento |
| `280:3` | Brand Governance | Nodo identificado, revisión pendiente |
| `297:2` | Logo Source Control | Nodo identificado, revisión pendiente |

El conector de Figma devolvió **límite de llamadas del plan Starter** al intentar obtener las páginas internas el 18/11/2026. **No se han visto y auditado todos los frames actuales**. No simular fidelidad a Figma con imágenes generadas.

## 4. Tokens históricos verificados

Desde [DESIGN-SYSTEM.md](https://github.com/M0-coder/DELIVER-ASESSET-pro/blob/main/docs/DESIGN-SYSTEM.md):

- Azul principal: `#1551D8`
- Amarillo de acento: `#FFC62F`
- Rojo editorial: `#FF3328`
- Tinta: `#111111`
- Papel: `#FAF3DF`
- Crema: `#F4E9C6`
- Blanco: `#FFFFFF`
- Tipografía de wordmark histórico: **Inter Extra Bold / 800**

Estos tokens son una referencia **histórica** hasta reconciliación con la versión de Figma seleccionada por el fundador. El color semántico de peligro en UI **no** es automáticamente el rojo editorial.

## 5. Conflicto que no se debe ocultar

- `BRAND-SOURCE.md` califica como aprobado el nodo raster `277:5` para la **web de DELIVER ASSETS**.
- El registro [Approve canonical Figma and brand system](https://app.notion.com/p/3adeb559c05c81eda02bfd768bb13f7d) permanece con `Status: Open` y `External Ready: NO` en la consulta disponible.
- [DESSET-IP-01](https://app.notion.com/p/413eb559c05c815b96e4f921cbab6b32) no acredita aún toda la cadena de derechos para la futura entidad.
- El sitio actual combina el **símbolo PNG heredado** con el texto **DESSET**. No existe en las fuentes examinadas prueba de que cualquier lettering inventado sea el wordmark oficial de DESSET.

**Regla:** usar el recurso real y su procedencia; **NO recrear, recolorear, tipografiar ni afirmar aprobación definitiva** del logo nuevo hasta fijar el frame Figma canónico.

## 6. Dirección de diseño acordada por el fundador

- Sitio **corporativo, internacional, editorial, original**, inspirado en la **claridad de arquitectura** de Demae-can, **sin copiar** su identidad, estructura literal ni contenido.
- DESSET representa una infraestructura futura de **comercio, logística y tecnología**, no únicamente una empresa local de delivery.
- **No ubicar ciudad, plaza ni geografía específica en el hero**: el piloto operativo inicial Huacho se describe en contenido secundario cuando corresponda, sin proyectar alcance nacional inexistente.
- No utilizar fotografías genéricas de equipos falsos, oficinas, vehículos o flotas inexistentes, ni imágenes sintéticas que representen operaciones reales.
- No elaborar logotipos nuevos ni sustituir elementos oficiales con ilustraciones de IA.
- Pueden reutilizarse recursos gráficos históricos **solo después de comprobar adecuación, autoría y licencias**.
- La web es de información y captación empresarial; aplicaciones separadas realizarán pedidos, pagos, cuentas y operación cuando estén habilitadas.
- No publicar estadísticas, noticias, socios, testimonios, enlaces a apps, servicios, garantías o tiempos no acreditados.

## 7. Alcance de ingeniería de aceptación

Primero fijar el alcance: **arquitectura, compilación, pruebas unitarias e instrumentadas, cobertura, análisis estático, calidad de CI, seguridad, reproducibilidad, mutation testing, deuda técnica y evidencia de ejecución**.

- Desarrollo solo en `M0-coder/DESSET-prime` / `design/figma-v1-no-deploy`.
- Validación posterior: original Figma por nodo/versión, reutilización de assets originales, desktop/tablet/mobile, teclado, contrastes, zoom, modo reduced-motion, SEO, CSP, accesibilidad, tests de contenido y negativos.
- Hashes exactos del candidato, capturas instrumentadas y CI verde para aspirar a aprobación visual.
- Aprobaciones explícitas e independientes de diseño, merge y eventual deploy.

**Prohibido en este alcance:** editar `M0-coder/DESSET`, cambiar DNS/Cloudflare, activar releases o auto-deploy, fusionar ramas o borrar historial.

## 8. Siguiente paso verificable

1. Recuperar acceso visual a los frames canónicos de Figma o exportaciones **originales** del mismo archivo; registrar file key, nodo, fecha y evidencia.
2. Seleccionar la versión **exacta** del wordmark DESSET y el diseño responsive canónico.
3. Contrastar esas fuentes con los archivos binarios ya identificados y cerrar el conflicto de marca en el expediente.
4. Construir una **maqueta de alta fidelidad con los assets reales** en DESSET-prime, sin publicación.
