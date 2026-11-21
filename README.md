# DESSET Prime — web comercial definitiva (desarrollo aislado)

> **Estado:** repositorio de diseño y desarrollo. **NO es producción**, no recibe pedidos ni pagos y no debe desplegarse por inferencia.

## Fuentes de verdad

- **Única base del producto web definitivo:** este repositorio, [M0-coder/DESSET-prime](https://github.com/M0-coder/DESSET-prime). El otro repositorio, `M0-coder/DESSET`, contiene una web experimental actualmente servida en el dominio; no es la fuente de código, diseño ni empaquetado de Prime. Se conserva temporalmente la referencia de su despliegue para rollback.
- **Diseño original:** [DELIVER ASSETS — Editorial AI Concept (Figma)](https://www.figma.com/design/cUGTTGlTB05xiKLL8NGcwG). Revisar especialmente Design System Production, Website Final, Website Responsive Final, Asset Library y Production Handoff; identificar versión aprobada antes de importar.
- **Legado gráfico:** repositorios DELIVER-ASESSET-prime y DELIVER-ASESSET-pro; reutilizar solo recursos verificables, con procedencia y derechos confirmados.
- **Gobierno empresarial:** expediente DELIVER ASSETS / DESSET en Notion y Google Drive. Ante una contradicción, distinguir visión, prototipo y servicio operativo acreditado.

## Objetivo del sitio

Construir la experiencia institucional-comercial definitiva de **DESSET**, reconocible y atractiva para clientes, comercios y socios, con énfasis inicial en **delivery urbano en Huacho**. La visión empresarial incluye paquetería, comercio B2B/B2C y alojamientos en fases posteriores; esas capacidades no deben presentarse como disponibles antes de su puesta en marcha real.

## Principios irrenunciables

1. **La web comunica, las apps operan.** No introducir pedidos, pagos, paneles o autenticación en esta web sin un mandato arquitectónico nuevo.
2. **No fingir operaciones.** Sin testimonios, clientes, flota, tiempos, cobertura, precios, reservas o descargas inventados.
3. **Reutilizar identidad propia.** Logo y assets aprobados, tokens originales, arte Rider/Business y patrones de movimiento útiles; no importar CSS experimental ni monolitos por comodidad.
4. **Diseño responsive y accesible.** La composición editorial y cinematográfica de Prime prevalece sobre el Bento experimental antiguo. No ocultar contenido ni prohibir scroll por imitar ese prototipo.
5. **Separación total de producción.** No DNS, no Cloudflare, no cambios en la página pública experimental, no releases, no auto-merge, no publicación automática ni eliminación de ramas sin autorización específica.

## Arquitectura inicial de información

- Inicio: propuesta comercial clara y marca
- Soluciones: pedidos, entregas y alcance real
- Para negocios: valor para comercios
- Cómo funciona: ilustraciones de proceso **conceptual**
- Ecosistema: Customer / Business / Rider / Control (sin simular estado de producción)
- Identidad: historia y visión
- Contacto: canales oficiales confirmados
- Legal: textos efectivos solo cuando se aprueben y correspondan al servicio

## Ingeniería: alcance de aceptación

**Primero fijar el alcance:** arquitectura; compilación; pruebas unitarias e instrumentadas; cobertura; análisis estático; calidad de CI; seguridad; reproducibilidad; mutation testing; deuda técnica; y evidencia de ejecución.

- Código y dependencias reproducibles; nada de secretos en el repositorio.
- Pruebas unitarias/contratos de enlaces, contenidos, interacción y estados.
- Pruebas browser en 320, 390, 768, 1024 y 1440 px; zoom, teclado, contraste y reducción de movimiento.
- Seguridad estática, CSP, dependencias auditadas y comprobación de recursos locales.
- Manifiesto verificable con SHA del diseño y artefactos; CI sin capacidad de publicar automáticamente.
- Capturas y logs como evidencia, no como sustitutos de aprobación visual humana.

## Flujo de trabajo

1. Inventariar y cotejar frames y componentes Figma (sin reinterpretarlos).
2. Aprobar sistema visual y arquitectura de contenido.
3. Implementar candidato en este repositorio, con vista previa **local**.
4. Ejecutar pruebas, revisión visual y gates por SHA.
5. Solicitar autorizaciones separadas para fusionar Prime y después publicar su propio artefacto en `desset.lat`, sin utilizar ni fusionar el diseño experimental antiguo.

**No considerar este README una aprobación de identidad, legalidad u operación comercial.**
