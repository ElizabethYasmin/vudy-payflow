# PayGate B2B — prototipo para el assessment técnico de Vudy

Prototipo de **aprobación de pagos B2B con liquidación real en Vudy**. Una
pyme registra una solicitud de pago a un proveedor; al aprobarla, el backend
llama a la API de Vudy para liquidar el pago on-chain y deja un registro de
auditoría de todo lo que pasó.

Construido para el proceso de Full Stack Sr. en Vudy — el stack elegido
(Next.js + TypeScript + Node.js) es intencionalmente el mismo que pide la
vacante, en vez de una herramienta 100% no-code, porque el rol es justo tomar
prototipos vibecodeados y llevarlos a un estado estable/desplegable.

## Por qué esta idea

De los dolores sugeridos en el brief ("conciliación multi-moneda", "remesas
con enrutamiento", "aprobación de pagos B2B"), elegí **aprobación de pagos
B2B** porque:

- Encaja con el foco de Vudy en pymes / mid-market / instituciones B2B.
- El concepto de "más de un par de ojos antes de liquidarse" mapea
  directamente a algo nativo de blockchain (autorización explícita antes de
  una acción irreversible), sin tener que inventar una narrativa.
- Es la más viable de construir con integración *real* a la API de Vudy en
  un día, dejando tiempo para documentar el proceso con cuidado.

## Cómo funciona

1. **Nueva solicitud** (`/new`) — un "Solicitante" registra proveedor, wallet
   destino, monto, moneda, chain y motivo. Queda en estado `pending`.
2. **Dashboard** (`/`) — lista las solicitudes y muestra el balance real de
   la wallet configurada (vía Vudy).
3. **Aprobar** — dispara la llamada a Vudy (`send/create`) para liquidar el
   pago al proveedor. Si Vudy responde, el estado pasa a `settled` y se
   guarda la referencia de la transacción. Si falla, pasa a `failed` con el
   motivo. Toda transición queda en el log de auditoría de la solicitud.
4. **Rechazar** — corta el flujo sin llamar a Vudy.

## Stack

- **Next.js 16 (App Router) + TypeScript** — frontend y backend (API routes)
  en un solo proyecto: exactamente el stack "imprescindible" del rol.
- **Tailwind CSS** para la UI.
- **Estado en memoria** (`lib/store.ts`) en vez de PostgreSQL — ver
  [Simplificaciones](#simplificaciones-conscientes-para-1-día) abajo.

## Integración con la API de Vudy

Documentación real usada: `https://docs.vudy.services`. Cliente en
[`lib/vudy.ts`](./lib/vudy.ts).

| Endpoint | Método | Patrón de auth | Uso en la app | Estado |
|---|---|---|---|---|
| `/v1/wallet/portfolio?wallets={addr}` | GET | A (`x-api-key`) | Balance mostrado en el dashboard | ✅ real, verificado contra la cuenta de prueba |
| `/v1/config/chains` | GET | A (`x-api-key`) | Poblar los selectores de chain/moneda en "Nueva solicitud" con datos reales de Vudy (en vez de opciones inventadas a mano) | ✅ real, verificado |
| `/channel/vudy/send/create` | POST | B (`x-api-key` + `x-profile-id` + `x-team-id`) | Liquidar el pago al aprobar una solicitud | ⏳ mock — ver abajo |

`portfolio` y `config/chains` solo requieren el Patrón A (la API key), así que
ya están 100% conectados a la API real de Vudy — no dependen de que Vudy
responda sobre `profile-id`/`team-id`.

### Modo mock

El Patrón B requiere `x-profile-id` y `x-team-id`. Al momento de construir
esto, la documentación no explicaba claramente cómo obtenerlos (varias
páginas de referencia estaban en construcción — ver feedback abajo). Para no
bloquear el resto del prototipo, `lib/vudy.ts` cae automáticamente a un
**modo simulado** cuando faltan credenciales, y lo marca explícitamente en la
respuesta (`mock: true`, badge "(simulado)" en la UI, evento de auditoría
"Simulado — sin credenciales/IDs de Vudy configurados"). En cuanto se
confirmen los IDs, basta con completarlos en `.env.local` para que la misma
llamada sea real.

**Camino para desbloquearlo sin esperar soporte:** la doc documenta
`GET /v1/profile` (Patrón C, devuelve `profile.id`) y el flujo de login por
email (`POST /v1/auth/send-otp` → `POST /v1/auth/verify-otp`, que devuelve el
arreglo `teams[]` con el `team-id`). En teoría se pueden obtener ambos IDs
haciendo ese login una vez, sin depender de que Vudy responda por soporte —
pendiente de intentarlo.

### Feedback honesto sobre la documentación (pedido explícito del reto)

- Varias páginas de referencia clave devuelven un placeholder ("esta página
  estará disponible pronto"): *Quick Start*, *Create Request* (Payment
  Requests), *Send Preview*, *Response Format*, *Environments*. Hubo que
  reconstruir el flujo cruzando el *Overview* de cada sección con páginas
  hermanas que sí estaban completas (ej. `send/gas-sponsor`).
- No quedó claro dónde se obtienen `x-profile-id` / `x-team-id` para el
  Patrón B — no hay un endpoint de referencia documentado ni un ejemplo
  end-to-end completo (auth → IDs → llamada de negocio) en un solo lugar.
- No hay mención de un ambiente sandbox/testnet separado de producción —
  quedó ambiguo si las pruebas de integración consumen saldo real.
- Lo que sí funcionó bien: los endpoints que están documentados (`portfolio`,
  `send/create`, `gas-sponsor`) traen ejemplos de request/response completos
  y suficientes para integrar sin adivinar.

## Simplificaciones conscientes para 1 día

| Simplificación | Qué se haría en producción |
|---|---|
| Estado en memoria (`globalThis`) | PostgreSQL: tablas `payment_requests` + `audit_log`, con el mismo modelo de `lib/types.ts` |
| Una sola aprobación liquida | Regla configurable de N aprobadores (ej. 2 de 3), con roles reales y autenticación |
| Sin autenticación de usuarios | Auth real (ej. NextAuth) + roles (solicitante/aprobador) por equipo |
| Llamada a Vudy sin reintentos | Idempotencia explícita (evitar liquidar dos veces si se reintenta la aprobación) + circuit breaker ante fallas repetidas del proveedor |
| Sin tests automatizados | Tests de integración para el cliente de Vudy (mock del `fetch`) y de la máquina de estados |
| Optimización de llamadas RPC/nodos | Se evaluaría un servicio en Python si el volumen de consultas on-chain lo justifica (mencionado en el perfil como bonus) |

## Cómo correrlo local

```bash
npm install
cp .env.local.example .env.local   # completa tu VUDY_API_KEY, wallet, etc.
npm run dev
```

Sin `.env.local` completo, la app funciona igual en modo simulado (dummy
data + mock de Vudy) — no se queda bloqueada.

## Estructura

```
app/
  page.tsx                     # dashboard
  new/page.tsx                 # formulario de nueva solicitud
  api/
    balance/route.ts           # GET balance (Vudy portfolio)
    config/chains/route.ts     # GET chains/tokens soportados (Vudy config)
    requests/route.ts          # GET lista / POST crear
    requests/[id]/approve/     # POST aprobar -> liquida en Vudy
    requests/[id]/reject/      # POST rechazar
components/
  Nav.tsx, StatusBadge.tsx
lib/
  types.ts                     # modelo de dominio
  store.ts                     # persistencia en memoria (temporal)
  vudy.ts                      # cliente de la API de Vudy + modo mock
```
