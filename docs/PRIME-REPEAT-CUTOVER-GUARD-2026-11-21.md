# DESSET Prime — Reparación del control de segunda publicación (solo código, NO DEPLOY)

**Fecha de auditoría:** 2026-11-21 (Perú). **Objetivo:** impedir que una publicación posterior a la primera quede silenciosamente omitida y que el preflight confunda el respaldo histórico con el despliegue actualmente activo.

## Evidencia del incidente

- GitHub Actions, ejecución manual #114 (run `44965276689`), creada el 2026-11-22 a las 00:09:56 UTC: `workflow_dispatch`, rama `main`, SHA `6a712cca9d6e50bf80ba54c6e03f627d36630fb3`. Ambos jobs terminaron `skipped`, sin pasos ni logs de runner.
- Cloudflare Pages `desset-institucional`: al auditar, `canonical_deployment.id = 0effd29b-f675-4529-bca9-2df86211983e`, SHA activo `3dd295e84541ee5773e9d9af26696694dbc293f7`, entorno producción, `success`; dominios `desset.lat` y `www.desset.lat`. Estos valores son **observaciones históricas, no autorizaciones ni valores perpetuos**.
- El campo `recovery_deployment_id` en `config/prime-release-target.json` conserva `b107eff2-6511-4e04-a780-fbd28e93e4e9`, despliegue histórico de recuperación. No es el `canonical_deployment.id` actual. La comparación previa bloqueaba cualquier actualización posterior que pasara el ID vivo.
- Causa exacta del `skipped` inicial: **no verificable** con los logs disponibles. El `if` de job evaluaba `vars.DESSET_PRIME_*` antes de arrancar y por ello podía omitir sin diagnóstico. Las variables de environment en GitHub solo están disponibles después de que el runner declara dicho environment. No se puede inferir cuál flag estaba ausente o desactualizado.

## Corrección controlada

1. `jobs.publish-only-after-independent-authorization.if` comprueba únicamente evento `workflow_dispatch`, repositorio oficial y `refs/heads/main`. Ninguna regla de negocio, aprobación ni secreto se evalúa antes de la puesta en marcha.
2. El job sigue vinculado al environment protegido `desset-prime-production`. El **primer preflight en el runner** verifica confirmación literal, SHA exacto, bandera desactivada por defecto, aprobación visual del nuevo SHA, derechos, contacto, seguridad, respaldo y política de indexación. Una falta produce `NO-GO` con motivo en logs, antes de acceder al token Cloudflare.
3. `expected_previous_deployment` del formulario identifica el despliegue **actual** que el operador revisó. Se exige UUID válido; su igualdad con `canonical_deployment.id` real se comprueba mediante **GET autenticado dos veces**, justo antes de desplegar. Nunca se sustituye por el ID histórico de recuperación.
4. El backup histórico permanece inalterado. No se desactiva ninguna autorización, revisión, check de seguridad ni limitación del token. Se refrescan proyecto y dominios en ambos controles de Cloudflare.
5. Pruebas de regresión cubren: segunda publicación exitosa cuando el ID vivo difiere del respaldo histórico; rechazo si la versión viva cambia entre revisiones; flags falsos; SHA erróneo; ID incorrecto; variables al entrar en el runner; verificación doble; un solo comando de despliegue, nunca por `push` ni PR.

## Límites y aceptación

- Este PR **NO** autoriza publicación ni indexación. No actualiza variables de GitHub, secretos, dominios, Cloudflare o configuración DNS.
- La aprobación por SHA anterior no autoriza automáticamente un commit nuevo: `DESSET_PRIME_VISUAL_APPROVED_SHA` deberá coincidir con el **nuevo SHA final de `main`**, después del merge independiente.
- Antes de cada ejecución comprobar: CI del SHA propuesto, protección de `main` y environment con revisores requeridos, derechos y respaldo restaurable, acceso a móviles reales, seguridad y autorización del titular. Si cualquiera no está demostrado, mantener `DESSET_PRIME_RELEASE_ENABLED=false`.
- Si el job se rechaza en el runner, inspeccionar el paso `Exact-SHA and independent business authorization preflight` y NO activar las banderas indiscriminadamente.
- El `expected_previous_deployment` debe venir de una **consulta reciente a Cloudflare**, no de un valor copiado de esta documentación. Toda publicación posterior genera un ID nuevo.
- Tras la autorización separada, ejecutar manualmente con `seo_policy=NOINDEX` salvo aprobación explícita para indexar. Verificar dominio raíz y `www`, CSP, integridad de archivos, título visible, 3D, móvil, estado de indexación y restauración.

**Dictamen inicial:** reparación de fuente propuesta. **Publicación: NO-GO** hasta aprobación y evidencias del commit definitivo.
