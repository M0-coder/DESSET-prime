# Preparación final Work — 21 de noviembre de 2026

## Alcance y límites
Arquitectura, compilación, pruebas Node y navegador, cobertura, análisis estático, CI, seguridad, reproducibilidad, mutation smoke, deuda técnica, Figma y preparación del corte manual. Solo DESSET Prime; sin cambiar HTML, CSS, fotografías, fuentes, logo, animaciones ni modelos. Sin merge, publicación, DNS, indexación ni rollback.

Base recibida: `82d88317757a381269e9c976d608d49a8f21a0b7`, PR #24. La evidencia definitiva se debe consultar en los jobs y artefactos del nuevo HEAD de este PR, nunca reutilizar resultados anteriores como nuevos.

## Defectos reproducidos y correcciones
1. Los dos jobs de `preview-checks.yml` usaban el merge ref sintético. Ahora hacen checkout del head exacto, comprueban la identidad y archivan `reports/quality/source-sha.txt`. Se desactiva persistencia de credenciales.
2. El preflight Cloudflare comprobaba `latest_deployment`, que puede ser preview. Ahora exige `canonical_deployment`, el destino de producción. Una prueba negativa demuestra que un latest coincidente no puede encubrir un canonical distinto o ausente; un preview posterior no invalida por sí solo producción intacta.
3. Con Node 24.22.3 el build genera GLB con hashes distintos y fallan dos contratos de integridad. Repetido con Node 22.16.0: 242/242 tests PASS y hashes originales preservados. Se fija engines/.nvmrc y se rechaza compilación con otra versión antes de generar geometría. No se alteran hashes aprobados para hacer pasar la prueba.
4. Se excluyen del seguimiento dependencias, dist, informes y binarios generados. No se elimina ningún activo fuente.

5. El workflow manual exigía 34 archivos, pero el paquete real tiene 35 al incluir THIRD-PARTY-NOTICES.txt. Se retira el contador obsoleto: el verificador independiente ya exige el inventario exacto y todos los hashes. El job offline ahora ejecuta las mismas CLI reales de empaquetado/verificación y archiva el paquete NOINDEX para detectar esta divergencia antes de publicar.

## Estado administrativo observado, solo lectura
Cloudflare autenticado: cuenta `5a1fbee5f06b8dcec986caa4e080c8d9`, proyecto `desset-institucional`, ID `e9b820a9-744f-44df-b59a-a4650197d440`, producción `release-approved`. Canonical y latest `b107eff2-6511-4e04-a780-fbd28e93e4e9`, success, commit `9f48d62cdadb43135fc9c2072cdc9e31f695c9ab`, sin Functions. Dominios `desset.lat` y `www.desset.lat` activos. Revalidar inmediatamente antes de cualquier corte.

GitHub Settings autenticado: no reglas clásicas de protección, no rulesets, no environments, no repository secrets y no repository variables. Auto-merge y eliminación automática de ramas desactivados. Declarar un environment en YAML NO crea una aprobación humana efectiva. No se crean credenciales ni se habilitan flags.

## Figma y aceptación visual
Conector Figma agotó cuota Starter. Navegador permitió inspeccionar páginas 12 Website Final y 13 Website Responsive Final. Los marcos PR5 Homepage Storytelling Desktop/Mobile y DELIVER ASSETS Website Final muestran composiciones anteriores: hero crema con diagrama, tarjetas de aplicaciones y otras ilustraciones. No corresponden exactamente al hero fotográfico y composición Prime. No se importa ni restaura ese diseño. Comparación de paridad: NO VERIFICADA / discrepancia identificada; se requiere referencia actualizada o aceptación explícita de Prime como baseline visual final.

## Bloqueos de publicación que CI verde no resuelve
- Configurar y verificar protección de main y environment `desset-prime-production` con aprobación efectiva, restricción a main y política explícita de bypass/autorrevisión.
- Proveer `CLOUDFLARE_API_TOKEN` con Pages Edit limitado a la cuenta prevista, sin exponerlo, y `DESSET_CF_ACCOUNT_ID`. La presencia o los permisos de una credencial ausente no pueden certificarse.
- Mantener `DESSET_PRIME_RELEASE_ENABLED` ausente/false. Ninguna variable de aprobación debe hacerse true sin evidencia y autorización específica.
- El contrato de canales conserva cinco perfiles owner-attested. `--require-verified` falla deliberadamente; la implementación actual fija verificación independiente a false. Requiere evidencia administrativa y un cambio revisado que la valide, no quitar el bloqueo ni convertir declaraciones en verificaciones.
- Derechos originales declarados por titular, sin cadena de titularidad adjunta. Las licencias MIT/OFL y hashes no prueban derechos comerciales de imágenes.
- Dispositivos físicos Safari/iOS y Chrome/Android, lector de pantalla y aceptación visual pendientes. SwiftShader y Lighthouse no los sustituyen.
- El respaldo debe tener bytes y hashes verificables; un ID de despliegue existente no basta para certificar recuperación autónoma. No ejecutar rollback como ensayo.
- Confirmar política SEO: paquete de ensayo NOINDEX; no autoriza alterar la indexación del sitio vigente.

## Puertas
A: solo tras cerrar condiciones de integración y repetir todos los controles sobre HEAD, solicitar autorización para merge por SHA exacto. B: después del merge autorizado, revalidar el nuevo SHA de main, backup y configuración, repetir QA, y solicitar autorización independiente para publicación manual. Conservar ramas, repositorios y despliegues. No deducir ninguna autorización de resultados verdes.
