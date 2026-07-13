# Guía de compra y configuración de dominios — Forja

> ✅ **DECISIÓN EJECUTADA 2026-07-13:** comprados **forjafit.mx** (principal) y **forjafit.com.mx** (defensivo/redirect) en Akky. Siguiente: §7 pasos 4-8 (Cloudflare, Email Routing, Resend). Todo `forja.fit`/`pay.forja.fit` en código y docs se actualizará a `forjafit.mx` en el Paso 15. Oportunidad futura: forja.fit expira dic-2026 (backorder/broker si el dueño no renueva).

**Fecha de verificación: 2026-07-13** (disponibilidad comprobada contra RDAP y whois oficial del NIC México ese día — re-verificar al momento de comprar, los dominios vuelan).

## 0. Hallazgo crítico: forja.fit NO está disponible

| Dominio | Estado verificado | Detalle |
|---|---|---|
| forja.fit | ❌ Registrado por un tercero | Expira 2026-12-10, nameservers de GoDaddy, aparcado sin página de venta explícita |
| forjafit.com | ❌ Registrado | Expira 2027-06 |
| forja.app | ❌ Registrado | Expira 2027-04 |
| forja.mx | ❌ Registrado | Desde 2016 (Wingu Networks) |
| forja.com.mx | ❌ Registrado | Desde 1998 |
| forja.fitness / appforja.com | ❌ Registrados | — |
| **forjafit.mx** | ✅ **DISPONIBLE** | Confirmado en whois del NIC México |
| **forjaapp.mx** | ✅ **DISPONIBLE** | Confirmado en whois del NIC México |

**Cómo re-verificar tú mismo:** busca el nombre en https://www.akky.mx o en el buscador de cualquier registrador; para gTLDs (.com/.fit/.app) cualquier registrador te lo dice al buscar.

## 1. La decisión previa a comprar (elige una)

- **Opción A — `forjafit.mx` (recomendada):** disponible hoy, alineado a la marca y al plan "validar B2C en México primero". La app se sigue llamando FORJA (el dominio no manda sobre la marca) y el scheme `forja://` de deep links NO depende del dominio.
- **Opción B — intentar comprar forja.fit a su dueño:** vía brokers (GoDaddy Domain Broker / Afternic / Dan.com). Costo impredecible (cientos a miles de USD) y semanas de proceso. Solo si la marca exacta te importa más que el tiempo. Puede intentarse EN PARALELO ya teniendo la opción A operando.
- **Opción C — otro nombre:** si prefieres explorar (p. ej. `laforja.mx`, `soyforja.mx`, `forja.gym`), verifica disponibilidad con el método de arriba antes de enamorarte.

**Nota de marca (hazlo antes de invertir fuerte):** "Forja" es palabra común — búsqueda rápida en IMPI (marcanet.impi.gob.mx) clases 41 (servicios deportivos) y 9/42 (software) para saber si alguien la tiene registrada en fitness. Una consulta con especialista en marcas es barata comparada con renombrar después.

## 2. Cuántos dominios comprar: UNO

Los "dominios" de pagos, correo, etc. son **subdominios del mismo dominio y son gratis** (se crean como registros DNS):
- `pay.forjafit.mx` → web de pagos
- `hola@forjafit.mx` / `no-reply@forjafit.mx` → correos
- futuro: lo que haga falta (`api.`, `www.`…)

No compres paquetes ni variantes defensivas por ahora (el .com equivalente ya está tomado; no hay nada que defender barato).

## 3. Dónde comprarlo y con qué configuración

- **.mx se compra en registradores acreditados por Registry .MX**: Akky (el local histórico) o revendedores como Namecheap/GoDaddy. Compara el precio de **renovación**, no solo el del primer año (~$300–500 MXN/año aprox.; verifica al buscar).
- Al comprar, SIEMPRE: **2FA activado** en la cuenta del registrador, **auto-renovación ON**, **bloqueo de transferencia (domain lock) ON**, y correo de recuperación que controles bien. El dominio será la llave de tus correos de auth — perderlo = perder todo.
- **DNS en Cloudflare (plan free):** tras comprar, apunta los nameservers del registrador a Cloudflare. Te da SSL, proxy, email routing gratis y cambios de records instantáneos, sin importar dónde compraste.

## 4. Mapa de configuración (qué apunta a dónde)

| Subdominio / registro | Tipo | Apunta a | Para qué |
|---|---|---|---|
| `pay.forjafit.mx` | CNAME | `cname.vercel-dns.com` (lo confirma Vercel al agregar el dominio al proyecto `web/`) | Web de pagos Next.js |
| `forjafit.mx` (raíz) | según hosting | Por ahora: redirect a `pay.` o página "próximamente" (Vercel también puede servirla) | Landing futura |
| `www` | CNAME | redirect a la raíz | Convención |
| SPF | TXT | lo da el proveedor de correo (p. ej. `v=spf1 include:...`) | Que tus correos no caigan en spam |
| DKIM | TXT/CNAME | lo da el proveedor | Firma criptográfica del correo |
| DMARC | TXT | `v=DMARC1; p=none; rua=mailto:...` (empezar en `p=none`) | Política anti-suplantación |
| Email Routing (Cloudflare) | — | `hola@forjafit.mx` → tu Gmail | Correo ENTRANTE gratis, sin pagar Workspace |

## 5. Correo SALIENTE (la pieza que desbloquea verificación de cuentas)

Supabase Auth en producción necesita un **SMTP propio** para mandar verificación de correo y reset de contraseña (hoy en local usamos Mailpit).

- **Recomendado: Resend** — free tier ~3,000 correos/mes, verificación de dominio sencilla (te da los records DKIM/SPF exactos para pegar en Cloudflare). Alternativas: Postmark (deliverability top, de pago), Brevo, Amazon SES (barato, más setup).
- Pasos: crear cuenta → agregar dominio `forjafit.mx` → pegar los records que te dé en Cloudflare → esperar verificación → crear API key SMTP.
- Dónde se conecta: **Supabase Dashboard → Authentication → SMTP Settings** del proyecto de PRODUCCIÓN (que se crea en el Paso 15 — no existe aún). Remitente: `no-reply@forjafit.mx`.

## 6. Qué se toca en el código/servicios cuando el dominio exista (Paso 15)

- `forja/.env.*`: `EXPO_PUBLIC_PAYMENTS_URL` → `https://pay.forjafit.mx`
- `web/`: dominio agregado en Vercel; variables de Stripe live; `success_url`/`cancel_url` al dominio real
- Stripe live: recrear prices ($219 mensual / $1,579 anual), webhook apuntando a la EF de producción
- Supabase prod: Site URL + Redirect URLs de Auth con el dominio
- Deep links: el scheme `forja://` sigue igual; **universal links** (https → abrir app) requieren servir `/.well-known/apple-app-site-association` y `assetlinks.json` desde el dominio raíz — llega con el dev build, solo hay que saber que ese archivo vivirá ahí.

## 7. Checklist de compra (en orden, ~30 min)

1. Decidir nombre (§1) y re-verificar disponibilidad ese mismo día.
2. Crear cuenta en el registrador con 2FA.
3. Comprar el dominio (1 año está bien con auto-renew ON) + lock ON.
4. Crear cuenta Cloudflare (free) → agregar el dominio → copiar los 2 nameservers.
5. En el registrador: cambiar nameservers a los de Cloudflare (propaga en minutos-horas).
6. En Cloudflare: activar Email Routing → `hola@` → tu correo personal. Probar mandándote un correo.
7. Crear cuenta en Resend → agregar dominio → pegar records SPF/DKIM/DMARC en Cloudflare → verificar.
8. Guardar en un lugar seguro: credenciales del registrador, API key de Resend.
9. (Cuando toque Paso 15) conectar Vercel, Stripe live y Supabase prod según §6.
10. Avisarme el dominio final para actualizar código, docs y memoria del proyecto.

## 8. Costos anuales aproximados (verificar al contratar)

- Dominio .mx: ~$300–500 MXN/año
- Cloudflare DNS + Email Routing: $0
- Resend free tier: $0 (hasta ~3k correos/mes — de sobra para validación)
- Vercel: hobby $0 para arrancar (uso comercial serio → Pro ~$20 USD/mes, decisión de Paso 15)
