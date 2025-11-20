## Problema
Los mensajes se persisten bajo un "demo user" porque `/api/send-message` cae al valor por defecto al no recibir identidad autenticada; el cliente SSE no envía cookies/Authorization, por lo que el servidor no puede resolver el `userId` real.

## Solución
- Servidor (`/api/send-message`):
  - Aplicar `authMiddleware` y responder 401 si no hay identidad.
  - Derivar `userId` exclusivamente de `userIdentityFromRequest`; no usar fallback a `default-user`.
  - Mantener heartbeat SSE y cierre ordenado.
- Cliente (`lib/sse-client.ts`):
  - Enviar `credentials: 'include'` para que las cookies de sesión viajen.
  - Añadir cabecera `Authorization: Bearer <access>` usando `authService.getCurrentTokens()`.
  - Incluir `X-User-Id` si `params.userId` viene definido.

## Verificación
- Enviar un mensaje autenticado y comprobar que el `userId` usado en `sessionMeta` y métricas coincide con el UID real.
- Validar que sin sesión el endpoint devuelve 401, evitando persistencia bajo usuario demo.
- Confirmar que chat-sessions y mensajes posteriores ya se guardan con el `userId` correcto.

¿Confirmas proceder?