# PRIME LAUNCH READINESS 01 — cierre técnico previo a publicación

**Repositorio definitivo:** `M0-coder/DESSET-prime`. **Objetivo:** sustituir por completo el experimento actual en `desset.lat`, no migrar su diseño. **Estado:** DRAFT / SOLO PRUEBAS / NO-GO.

## Alcance y evidencias

Evaluar arquitectura, compilación, pruebas unitarias e instrumentadas, cobertura real, análisis estático, seguridad, calidad de CI, reproducibilidad, mutation testing, deuda técnica y evidencia ejecutada. No asignar porcentajes de cobertura o certificaciones sin resultados suficientes.

| Área | Control verificable | Situación |
|---|---|---|
| Identidad visual | 18 activos originales SHA-256, declarados de DESSET | Verificados por integridad; titularidad declarada |
| Dependencias | Three.js 0.187.0 y esbuild 0.28.2, npm lock, MIT | Auditoría de licencias; avisos completos incorporados al paquete futuro |
| Código de terceros | Bundle Three.js no es propiedad exclusiva | Separación documentada |
| Compilación | Dos árboles limpios desde HEAD, dos `npm ci` y `npm run build:site` | Ejecución CI en PR (verificar resultados por SHA) |
| Paquete de publicación | 34 archivos: 33 de la copia de ensayo + `THIRD-PARTY-NOTICES.txt` | Inventario por SHA-256 y verificador independiente |
| SEO | `NOINDEX` / `INDEX` por autorización distinta | Política explícita, no cambios en dominio |
| Web institucional | Sin pagos/pedidos, apps aún no publicadas | Contrato automatizado |
| Canales | Instagram, X y Facebook mantienen `data-channel-review="pending"` | **PENDIENTE**: verificar que los enlaces y cuentas sean efectivamente oficiales antes de cambiarlos a `verified` |
| Recuperación | Revalidación read-only del ID actual en Cloudflare | **PENDIENTE**: respaldo autónomo probado y permisos reales de rollback |
| Navegadores físicos | iOS/Safari y Android reales | **PENDIENTE**: la simulación WebGL SwiftShader no es prueba física |
| Seguridad | Auditorías npm/HTTP/CI, contratos de host | Análisis existente; SBOM y escaneo adicional antes de release |
| Aprobaciones | GitHub Environment, SHA exacto, ventana y secreto Pages | **NO CONFIGURADOS NI ACTIVADOS** en este PR |

## Cadena de evidencia, no cadenas de supuestos

La declaración del propietario de DESSET sobre los activos originales se mantiene registrada. Los perfiles sociales públicos son una categoría diferente: una cuenta podría estar asociada a la marca sin que nosotros hayamos verificado aún su autenticidad o acceso administrativo. Por ello el script `prime-channel-readiness.mjs` informa los tres enlaces pendientes y, en una eventual publicación, detiene el proceso hasta que el código marque las verificaciones pertinentes. **No quitar enlaces ni poner etiquetas oficiales sin evidencia o autorización del titular.**

Las licencias MIT de Three.js y esbuild se reproducen íntegramente, obtenidas de las versiones de npm instaladas por `npm ci`. El archivo `THIRD-PARTY-NOTICES.txt` se incluye exclusivamente en el **futuro paquete de 34 archivos**, NO en el `dist/` original de 30 archivos, ni se altera el diseño. Su SHA-256 queda en la evidencia independiente.

## Condiciones de lanzamiento aún abiertas

1. Verificar que las tres URL publicadas corresponden a canales oficialmente administrados por DESSET. Actualizar de forma revisada `data-channel-review="verified"` y confirmar el estado por SHA exacto. No habilitar apps ficticias.
2. Completar prueba manual de accesibilidad, interacción y estabilidad en Safari/iOS y Android físicos, además de las simulaciones CI.
3. Comprobar un respaldo autónomo recuperable del despliegue experimental y el rollback, sin borrar el repositorio antiguo antes del cambio.
4. Revisar privacidad/avisos y datos institucionales aplicables a la situación real de la empresa; sin inventar RUC, domicilio fiscal o empresa constituida.
5. Ejecutar SAST/SCA/SBOM, mutation testing dirigido y cobertura con umbrales reales, conservar evidencias por SHA.
6. Autorizar por separado y por SHA concreto los merges y después la publicación manual; configurar realmente el GitHub Environment protegido y credenciales de mínimo alcance. No basta con declararlos en YAML.

**Decisión: NO-GO para publicación**, aunque estas pruebas alcancen PASS. Se está cerrando infraestructura y evidencia, no autorizando el reemplazo.

**Restricciones mantenidas:** ningún merge, despliegue, release, rollback automático, borrado de ramas/repositorios, cambios DNS o activación de publicación.
