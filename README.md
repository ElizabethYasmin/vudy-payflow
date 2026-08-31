# PayGate B2B — prototipo para el assessment técnico de Vudy

🔗 **Demo en vivo**: https://vudy-payflow.vercel.app

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
- **PostgreSQL** (Vercel Storage / Neon) para `payment_requests` + `audit_log` —
  ver [Actualización: persistencia real](#actualización-persistencia-real-con-postgresql) abajo.

## Integración con la API de Vudy

Documentación real usada: `https://docs.vudy.services`. Cliente en
[`lib/vudy.ts`](./lib/vudy.ts).

| Endpoint | Método | Patrón de auth | Uso en la app | Estado |
|---|---|---|---|---|
| `/v1/wallet/portfolio?wallets={addr}` | GET | A (`x-api-key`) | Balance mostrado en el dashboard | ✅ real, verificado contra la cuenta de prueba |
| `/v1/config/chains` | GET | A (`x-api-key`) | Poblar los selectores de chain/moneda en "Nueva solicitud" con datos reales de Vudy (en vez de opciones inventadas a mano) | ✅ real, verificado |
| `/channel/vudy/send/create` | POST | B (`x-api-key` + `x-profile-id` + `x-team-id`) | Liquidar el pago al aprobar una solicitud | ⚠️ conectado con el formato real, pero el propio servidor de Vudy falla (`500`) — ver hallazgos abajo |

`portfolio` y `config/chains` solo requieren el Patrón A (la API key), así que
ya están 100% conectados a la API real de Vudy — no dependen de que Vudy
responda sobre `profile-id`/`team-id`.

**Sobre `send/create`:** se consiguieron `profile-id` y `team-id` por cuenta
propia (login por email, ver hallazgos abajo) y se probó un envío real de
0.1 USDT en Polygon a una segunda wallet propia, con el balance verificado
antes/después. El servidor de Vudy rechaza la llamada con un error 500 de
su lado (ver "Hallazgo más importante" abajo) — no se perdió ni movió
ningún fondo. El código queda listo con el formato correcto; en cuanto Vudy
resuelva ese error, la misma llamada debería liquidar de verdad.

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

**Camino para desbloquearlo sin esperar soporte (✅ funcionó):** la doc
documenta `GET /v1/profile` (Patrón C, devuelve `profile.id`) y el flujo de
login por email (`POST /v1/auth/send-otp` → `POST /v1/auth/verify-otp`, que
devuelve el arreglo `teams[]` con el `team-id`). Se hizo ese login una vez y
se obtuvieron ambos IDs sin depender de que Vudy respondiera por soporte —
ya están en `.env.local` y el Patrón B está activo.

### Feedback honesto sobre la documentación (pedido explícito del reto)

- **Hallazgo más importante — el schema documentado de `send/create` no
  coincide con el que la API real exige.** La doc describe el body como
  `{ sendWallet, chain, token, recipients, note }` en el nivel superior.
  Probando contra la API real, el servidor lo rechaza (`400
  LIB_BODY_PARSE_02`) y exige en su lugar:
  ```json
  {
    "targetAddress": "0x...",
    "amount": 0.1,
    "channelParams": { "chain": "polygon", "token": "USDT", "recipients": [...] }
  }
  ```
  Esto se descubrió por prueba y error (leyendo los mensajes de validación
  del propio servidor), no porque la doc lo explicara. `lib/vudy.ts` ya
  arma el body con el formato real.
- **Segundo hallazgo — el endpoint falla consistentemente en producción, en
  más de una cadena.** Con el formato correcto, `send/create` devuelve `500
  LIB_PRICE_FETCH_04: "Failed to get token price from Alchemy"` — su backend
  intenta cotizar el token nativo de la cadena contra un proveedor externo
  (Alchemy) y esa llamada devuelve HTML en vez de JSON. Reproducido 3 veces
  en total, con dos herramientas distintas (`curl` y Postman) y dos cadenas
  distintas: `polygon` (falla cotizando `POL`) y `avalanche` (falla
  cotizando `AVAX`) — mismo error de fondo en ambos casos, lo que descarta
  que sea algo específico de una sola cadena. **Esto no se pudo resolver
  desde el lado del cliente**: es un bug/caída de una dependencia en la
  infraestructura de Vudy. Se verificó con el balance antes/después
  (`GET /v1/wallet/portfolio`) que ningún fondo se movió — el error ocurre
  antes de tocar la blockchain. Reportado directamente a `contact@vudy.me`.
- Varias páginas de referencia clave devuelven un placeholder ("esta página
  estará disponible pronto"): *Quick Start*, *Create Request* (Payment
  Requests), *Send Preview*, *Response Format*, *Environments*, *Wallet
  Types*, *EVM Allowances*, *API Keys & Webhooks*. Hubo que reconstruir el
  flujo cruzando el *Overview* de cada sección con páginas hermanas que sí
  estaban completas (ej. `send/gas-sponsor`, `api/config`, `api/profile`).
- No hay un endpoint de referencia documentado con un ejemplo end-to-end
  completo (auth → IDs de equipo → llamada de negocio) en un solo lugar.
  `x-profile-id`/`x-team-id` se terminaron obteniendo combinando dos páginas
  distintas: el login por email (`/v1/auth/send-otp` + `/verify-otp`, en
  *Getting Started → Authentication*) y el endpoint de perfil (`GET
  /v1/profile`, en *API Reference*) — nada en la doc conecta ambos pasos
  explícitamente como el camino a seguir.
- No hay mención de un ambiente sandbox/testnet separado de producción —
  las pruebas de integración se hicieron contra producción con saldo real
  (por eso se probó con montos mínimos, ver sección de envío real abajo).
- Lo que sí funcionó bien: `wallet/portfolio` y `config/chains` están
  documentados con precisión y coinciden exactamente con la respuesta real
  — se integraron sin fricción.

## Actualización: persistencia real con PostgreSQL

La primera versión guardaba el estado en memoria (`globalThis`). Al probar el
deploy en Vercel, se observó el problema real que esa simplificación predecía:
al ser funciones serverless (cada invocación puede correr en una instancia
distinta y efímera), aprobar una solicitud podía devolver `404` porque la
instancia que atendía el clic nunca había visto la instancia que la creó.

Se resolvió conectando **PostgreSQL** (Vercel Storage → Neon, plan gratis):
tablas `payment_requests` + `audit_log`, mismo modelo que ya existía en
`lib/types.ts`. Gracias a que las rutas de la API nunca tocaban el
almacenamiento directamente — siempre llamaban a funciones con nombre en
`lib/store.ts` (`listRequests`, `createRequest`, `updateStatus`) — migrar de
memoria a base de datos solo significó reescribir ese archivo (ahora usando
`pg` con SQL parametrizado) y agregar `await` en las rutas; ni el frontend ni
la forma de llamar a esas funciones cambiaron.

**Verificado, no solo dicho:** se creó una solicitud, se mató el proceso del
servidor local y se levantó uno nuevo — el proceso nuevo encontró la
solicitud del proceso anterior, confirmando que el problema de estado
efímero está resuelto.

## Simplificaciones conscientes para 1 día

| Simplificación | Qué se haría en producción |
|---|---|
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
