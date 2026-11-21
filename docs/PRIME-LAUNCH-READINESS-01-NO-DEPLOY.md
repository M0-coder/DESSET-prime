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
| Canales | Instagram, Facebook, TikTok, YouTube y X; URL exactas en `config/prime-social-owner-attestation.json` | **DECLARACIÓN DEL TITULAR: 5/5**. Acceso administrativo y propiedad de las cuentas no verificados independientemente |
| Recuperación | Revalidación read-only del ID actual en Cloudflare | **PENDIENTE**: respaldo autónomo probado y permisos reales de rollback |
| Navegadores físicos | iOS/Safari y Android reales | **PENDIENTE**: la simulación WebGL SwiftShader no es prueba física |
| Seguridad | Auditorías npm/HTTP/CI, contratos de host | Análisis existente; SBOM y escaneo adicional antes de release |
| Aprobaciones | GitHub Environment, SHA exacto, ventana y secreto Pages | **NO CONFIGURADOS NI ACTIVADOS** en este PR |

## Cadena de evidencia, no cadenas de supuestos

La declaración del propietario de DESSET sobre los activos originales se mantiene registrada. El titular confirmó expresamente que los perfiles sociales enlazados pertenecen a DESSET. La declaración se conserva en `config/prime-social-owner-attestation.json` con las cinco URL exactas. Los enlaces se identifican en el código como `verified` **únicamente respecto a la declaración del titular** (`data-channel-basis="owner-attested"`); no se afirma haber iniciado sesión ni comprobado permisos de administrador en las plataformas. El script `prime-channel-readiness.mjs` rechaza la sustitución de URL o la introducción de otro perfil falsamente verificado.

Las licencias MIT de Three.js y esbuild se reproducen íntegramente, obtenidas de las versiones de npm instaladas por `npm ci`. El archivo `THIRD-PARTY-NOTICES.txt` se incluye exclusivamente en el **futuro paquete de 34 archivos**, NO en el `dist/` original de 30 archivos, ni se altera el diseño. Su SHA-256 queda en la evidencia independiente.

## Condiciones de lanzamiento aún abiertas

1. Declaración del titular de Instagram, Facebook, TikTok, YouTube y X: **registrada con cinco URL fijas**. Pendiente: comprobar acceso administrativo real y continuidad operativa, si se pretende llamar a esos perfiles independientemente verificados. No habilitar aplicaciones ficticias.
2. Completar prueba manual de accesibilidad, interacción y estabilidad en Safari/iOS y Android físicos, además de las simulaciones CI.
3. Comprobar un respaldo autónomo recuperable del despliegue experimental y el rollback, sin borrar el repositorio antiguo antes del cambio.
4. Revisar privacidad/avisos y datos institucionales aplicables a la situación real de la empresa; sin inventar RUC, domicilio fiscal o empresa constituida.
5. Ejecutar SAST/SCA/SBOM, mutation testing dirigido y cobertura con umbrales reales, conservar evidencias por SHA.
6. Autorizar por separado y por SHA concreto los merges y después la publicación manual; configurar realmente el GitHub Environment protegido y credenciales de mínimo alcance. No basta con declararlos en YAML.

**Decisión: NO-GO para publicación**, aunque estas pruebas alcancen PASS. Se está cerrando infraestructura y evidencia, no autorizando el reemplazo.

**Restricciones mantenidas:** ningún merge, despliegue, release, rollback automático, borrado de ramas/repositorios, cambios DNS o activación de publicación.
