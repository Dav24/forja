# Paso 12 — Freemium Gates y Upgrade Progress Ledger

Plan: docs/superpowers/plans/2026-06-27-freemium-upgrade.md

## Tasks
- [x] Task 1: UpgradeSheet component
- [x] Task 2: PaywallBanner component
- [x] Task 3: /upgrade screen + _layout.tsx hidden tab
- [x] Task 4: Wire existing gates
- [x] Task 5: Profile screen

## Base commit: 03fc31c
Task 1: complete (commits 03fc31c..c699eee, review clean; minor: Linking.openURL promise unhandled, sheet close race)
Task 2: complete (commits c699eee..4e4c884, review clean)
Task 3: complete (commits 4e4c884..84a27b8, review clean; minor: NativeWind layout in style={{}} throughout upgrade.tsx — matches existing codebase pattern in full screens)
Task 4: complete (commits 84a27b8..85cf113, review clean; minor: TouchableOpacity wrapping editable Input may compete for touches on Android — needs manual test)
Task 5: complete (commits 85cf113..0631103, review clean)
Final review: complete (commits 03fc31c..0631103, ready to merge — 0 critical, 0 important, 7 minor: Linking.openURL unhandled, sheet/nav race, TouchableOpacity Android, NativeWind layout in full screens, Input style prop lands on TextInput, meal_plan context dead, as-never route casts)

---

# Rediseño de Marca Forja — Progress Ledger

Plan: docs/superpowers/plans/2026-07-03-forja-brand-redesign.md
Base commit: 1d57359

## Tasks
Task 1: complete (commits 1d57359..da5fd04, review clean)
Task 2: complete (commits da5fd04..0994081, review clean)
Task 3: complete (commits 0994081..1cdcebb, review clean)
Task 4: complete (commits 1cdcebb..35bbd08, review clean; minor: unused 'r' var in Ember.tsx — spec-inherited)
Task 5: complete (commits 35bbd08..f69d00e, review clean)
Task 6: complete (commits f69d00e..7447ea0, review clean after fix: Inter font on tagline)
Task 7: complete (commits 7447ea0..073f6bf, review clean after fix: composed press handlers)
Task 8: complete (commits 073f6bf..4760a15, review clean)
Task 9: complete (commits 4760a15..297d821, review clean)
Task 10: complete (commits 297d821..b48b90e, review clean; minor for T23 sweep: unused Animated import in CountUpText.tsx, no progress reset on value change)
Task 11: complete (commits b48b90e..864bec3, review clean after fix: cancelAnimation on dead streak)
Task 12: complete (commits 864bec3..2e1f55f, review clean; minor for final review: onDone stale closure in SparkBurst deps)
Task 13: complete (commits 2e1f55f..21f6ed6, review clean after fix: secondary variant no-plan CTA; minors for final review: no skeleton on cold-load hero/stats, DÍA 0 edge)
Task 14: complete (commits 21f6ed6..c094c6c, review clean; typing-indicator grep verified clean)
Task 15: complete (commits c094c6c..c4d2dcd, review clean; minors for final review: trailing row border, empty focus separator)
Task 16: complete (commits c4d2dcd..b324c63, review clean after fix: uppercase className; hex grep verified clean)
Task 17: complete (commits b324c63..c734966, review clean; celebration race fixed via onDone deferral)
Task 18: complete (commits c734966..7f39d2e, review clean)
Task 19: complete (commits 7f39d2e..1f31160, review clean; day chips spot-checked compliant)
Task 20: complete (commits 1f31160..d632e6c, review clean; PaywallBanner/lock icons grep-verified compliant)
Task 21: complete (commits d632e6c..fea6136, review clean after fix: effect redirect + shared useGeneratePlan hook; minor for final review: progress stalls at 93%)
Task 22: complete (commits fea6136..440b7b6, review clean)
Task 23: complete (commits 440b7b6..fa04c9c, review clean)
Final review: complete (commits 1d57359..ac4dff1, READY TO MERGE — 0 critical, 0 important; post-review fix: Bebas titles plans/profile; accepted: 3 gradients on upgrade conversion screen, VulcanoAvatar doc drift, redundant nav on workout index)

## Plan: Paso 13 — Web de Pagos (docs/superpowers/plans/2026-07-03-payments-web.md), rama paso-13-pagos, base 8f9aa6f
Task 1: complete (commits 8f9aa6f..834026b, review clean; minor: --no-turbopack posible no-op en Next 16)
Task 2: complete (commits 834026b..37b52a3, review clean; minor p/final review: falta test integración promo-no-encontrado en createCheckoutSession)
Task 3: complete (commits 37b52a3..98e3b13, review clean tras fix a11y/token/guard; minors p/final review: hex hardcoded en EmberField, verificar 502+375px en navegador en Task 9)
Task 4: complete (commits 98e3b13..49455ea, review clean)
Task 5: complete (commits 49455ea..975a637, review clean; desviación aprobada: derived error en vez de setState-in-effect; minor p/final review: comentar dependencia isValidUid del search query)
Task 6: complete (commits 975a637..b06a104, review clean tras fix: userIdForSub propaga errores DB → 500/retry; minor p/final review: decidir deno.lock commit vs gitignore)
Task 7: complete (commits b06a104..24b6856 [2 commits: rework + fix tsconfig exclude web], review clean; minors p/final review: type Billing duplicado en upgrade.tsx, spacing bajo card premium a revisar en pase visual; pendiente humano: verificación Expo Go)
Task 8: complete (commits 24b6856..6931a06, review clean; pendiente humano: verificación Expo Go)
Task 9: complete (setup Stripe test mode + verificación E2E automatizable + docs; sin commits de código app — solo forja-docs.md + .gitignore, ver task-9-report.md). Producto/precios/cupón/promo ya existían en Stripe test mode; verificado end-to-end: checkout (monthly/promo/yearly) → checkout.session.completed (sintético firmado sobre suscripción real, ya que el fixture built-in de `stripe trigger` es pago único no subscription) → plan=premium; portal → URL real; cancel → customer.subscription.deleted real → plan=free/canceled; landing SSR con/sin uid. Pendiente humano: pago real 4242 desde teléfono + Expo Go.
Task 9: complete (commits 6931a06..1548c2a, review clean; E2E automatizado PASS: checkout/webhook/cancel/portal/landing; pendiente humano: pago real 4242 desde teléfono + pase Expo Go; nota: fixture CLI no soporta subscription-mode, documentado en forja-docs §8)
Final review: complete (commits 8f9aa6f..969f45f, READY TO MERGE tras fix wave 969f45f: guards webhook mode/stale-sub, URL webhook docs, promo array, badge Play, comment portal, Billing dedup; deferrals documentados: sticky CTA, API version pinning, hex EmberField, test promo integración, E2E humano teléfono+Expo Go)

## Plan: multi-modalidad (2026-07-07, docs/superpowers/plans/2026-07-07-multi-modalidad.md, rama feat/multi-modalidad)
Task 1: complete (commits dea3bf1..80c43a1, review clean; minor p/final: as-cast en MODALITY_LABELS oculta exhaustividad)
Task 2: complete (commits 80c43a1..e0ebb22, review clean, checks verificados funcionalmente contra DB)
Task 3: complete (commits e0ebb22..621a4c2, review clean; adaptación válida: STEPS array de onboarding/_layout actualizado por los renombres)
Task 4: complete (commits 621a4c2..6891e45 [impl + fix sheet montado], review clean tras fix wave; pendiente humano: scroll del sheet en dispositivo)
Task 5: complete (commits 6891e45..206a0c7, review clean, E2E running PASS; minor p/final: 3 líneas en blanco extra en prompt cuando modality=null)
Task 6: complete (commits 206a0c7..dd70e4f, review clean, E2E Vulcano habla en lenguaje de corredor)
Task 7: complete (E2E home_calisthenics PASS + gym_strength/endurance PASS, repo limpio)
Final review: complete (commits dea3bf1..5794d6b, READY TO MERGE tras fix wave 5794d6b: Sheet scrollable + export muerto; pendiente humano: scroll del sheet + onboarding en Expo Go; límite conocido: ball_sports desde el sheet no captura sport_type)

## Plan: 2026-07-07-account-settings (ajustes de cuenta)
Base: dc439c9
Task 1: complete (commits 9d3d84c..96e3c44, review clean tras fix wave app.json)
Task 2: complete (commits a98c386..5fe2b0d, review clean tras fix seguridad: REVOKE authenticated en RPC — hallazgo Critical real del reviewer)
Task 3: complete (commit 39867c0, review clean, TDD 2/2 + suite 3/3)
Task 4: complete (commit eb5ccf4, review clean; ⚠️ E2E de subida/borrado real queda para Task 15)
Task 5: complete (commit c77d378, review clean; API SDK56 verificada vs .d.ts+docs; MINOR p/final: catch de useAvatarUpload traga el error sin console.error; ⚠️ subida real en device → Task 15)
Task 6: complete (commit 5d1268d, review clean, refactor puro verificado)
Task 7: complete (commit 4030a36, review clean; nota: briefs 8-23 en sdd/ eran scratch del plan viejo, se regeneran)
Task 8: complete (commit 22ce597, review clean; ⚠️ hueco navegación /settings/training hasta T12; pendiente humano Expo Go)
Task 9: complete (commits 22ce597..449666d [impl d2bcffe + fix 449666d sync nombre con nameTouched], review clean tras fix; copy "ambos correos" verificada vs config.toml double_confirm_changes=true; minors p/final review: updateUser email/pass sin try/catch → status stuck en saving si throw, async muerto en handleSaveName, back button sin accessibilityLabel)
Task 10: complete (commit 5a13256, review clean, TDD 5/5; Step 6 cerrado por controller: 401 propio de la función + 405 verificados con anon key vía Kong; minors p/final review: deleteUser que falla tras cancelar Stripe deja estado parcial sin test [plan-mandated], removeAvatar .catch(()=>{}) silencia errores de storage sin log [plan-mandated])
Task 11: complete (commits 5a13256..37b1e1e [impl aa8f98e + fix 37b1e1e signOut robusto con fallback scope local], review clean tras fix; minors p/final review: fallback local que falla deja deleting stuck sin recovery, error sintético de signOut sin console.warn, functions.invoke sin try/catch [plan-mandated])
Task 12: complete (commits 37b1e1e..ee8cf44 [impl 86899ea + fix ee8cf44 validación altura/edad + rollback goal activo], review clean tras fixes; queryKeys reales verificados [goal/body_data/profile-stats]; minors p/final review: sin range checks altura/edad, parseInt trunca edad decimal, guard INSERT body_data trata 0 como falsy, casts de union types sin guard en preload)
Task 13: complete (commits ee8cf44..227d97e [impl ff11c0a 3 pantallas + fix 227d97e update optimista en useUpdateProfile], review clean tras fix, consumers verificados sin regresión [account name save, push token, avatar]; minors p/final review: Linking.openSettings/openURL sin catch, rollback de switches silencioso sin toast, subscription sin estados loading/error, edge de mutaciones concurrentes en switches [self-heal via onSettled])
Task 14: complete (commit 9a6aed4, review clean sin Important; E2E curl PASS: signup sin sesión + mail en Mailpit + login rechazado email_not_confirmed; AuthGuard preserva flujo si confirmations se apaga; minors p/final review: handleResend sin guard anti doble-tap [rate limit server-side 1s lo mitiga], sent no se resetea al volver atrás; pendiente humano: deep link forja:// al confirmar en dispositivo)
Task 15: complete pasos 1/2/4 (commit e38ed8c solo docs; tsc 0 errores, deno test suite completa PASS; docs verificados factualmente por reviewer; Step 3 = checklist E2E humano de 9 puntos PENDIENTE con el usuario)
Post-E2E bugs (2026-07-08, commit 8c52dcf): (1) EFs de IA muertas tras el restart de T14 — supabase start NO carga supabase/.env, solo supabase/functions/.env; antes funcionaba por un functions serve --env-file manual. Fix: supabase/functions/.env gitignorado + doc en forja-docs. Verificado: chat streamea OK con token real. (2) Back desde Ajustes iba al dashboard (backBehavior default firstRoute del TabRouter al agotarse el stack anidado) — fix: backBehavior="history" en Tabs de (app)/_layout. Pendiente verificación humana en Expo Go de ambos.
Post-E2E bug 2 round 2 (d8be223): backBehavior no bastó (React Navigation crea el TabRouter una vez con opciones iniciales; Fast Refresh no lo recrea) → fix determinista: hub de Ajustes navega explícito a /(app)/profile + unstable_settings.initialRouteName='index' en settings/_layout para entradas directas a subpantallas. Requiere reload completo del bundle para probar. CONFIRMADO por el usuario 2026-07-08: navegación Ajustes→Perfil OK y APIs de IA OK.
Final review: complete (commits dc439c9..4802e03, READY TO MERGE tras fix wave 4802e03: banner permissionDenied en perfil + link "Abrir ajustes" en cuenta [spec §10], migración 0009 límites bucket avatars [1MB, image/jpeg, aplicada y verificada en DB], href:null corregido en docs; deferrals documentados para polish/i18n: console.error en useAvatarUpload, header compartido de settings [6 repeticiones], error.code en vez de string match en login, CORS en EF delete-account, signOut sin feedback en hub, copy de enumeración en register, range checks altura/edad, toasts de rollback, estados loading/error en subscription; pendiente humano: checklist E2E 9 puntos de Task 15 Step 3 + deep link forja:// en dispositivo)

## Plan: 2026-07-08-i18n (Paso 14)
Base: 555bd37
Task 1: complete (commit 1e51b85, review clean; stub previo de en/common.json sobrescrito — grep confirmó 0 consumidores de sus claves viejas; minors p/final review: flash de idioma si AsyncStorage difiere de device [by design], setAppLanguage sin try/catch en changeLanguage)
Task 2: complete (commit 2cdcd31, review clean, reviewer reprodujo el run: 98 [copy]/0 paridad/0 clave exit 1 esperado; minors p/final review [plan-mandated]: heurística de comentarios por línea no stateful en bloques /* */, KEY_RE no ve template literals t(`...`))
Task 3: complete (commits 2cdcd31..1fdcfd1 [impl 69e8587 + fix 1fdcfd1 aprobado por usuario: mutate estable en deps + Alert onError con claves saveError*], review clean tras fix; minors p/final review: onError no dispara si la pantalla se desmontó antes de settle, wroteInitial no reintenta backfill en la sesión, claves fully-qualified redundantes en OPTIONS)
Task 4: complete (commit 6aea14f, review clean; español verificado carácter por carácter vs constantes viejas, inglés según glosario, 6 consumidores actualizados sin scope creep, equipmentPresets intactos, sin t() en worklets; minor pre-existente: export Step3Level en step-4-level.tsx)
Task 5: complete (commit baa1884, review clean; extracción exacta verificada string por string, matching de API intacto, {{email}} simétrico; PENDIENTE barrido final: Input.tsx "Ver/Ocultar" copy propio de ui/ [excepción sancionada spec §3.4 → common.json], placeholder hola@ejemplo.com→hello@example.com decisión de glosario, inconsistencia pre-existente "email"/"correo" entre forgot y register)
Task 6: complete (commit 72890c8, review clean 0 issues; GENDERS/ACTIVITY_LEVELS de step-3 convertidos al patrón labelKey, _layout sin labels visibles [STEPS son rutas], secciones de Task 4 intactas, reviewer corrió tsc+check-i18n independiente)
Task 7: complete (commit d0eaeb9, review clean; día bilingüe verbatim del plan, hero EN según glosario compone bien, sin worklets en index.tsx, focus IA renderiza as-is con fallback t(); minor p/final review: separador ", " hardcodeado en saludo+nombre [pre-existente, neutral])
Task 8: complete (commit 63b6a22, review approved; desviación firmada por controller: "Te queda {{count}}" corrige gramática rota del original; patrón i18n.t() directo en useChat.ts para copy de hook [post-init verificado]; remainingOne/Other son claves explícitas no sufijos i18next; minor: error bubble efímero captura idioma al crearse [patrón pre-existente])
Task 9: complete (commits 63b6a22..2e92472 [impl d9a7241 commiteado por controller tras 2 cortes de sesión del subagente + fix 2e92472 precios]; review approved tras fix; equipmentPresets→claves resueltas con t() antes de enviar a EF [verificado, NO llega la clave], constants/mealOptions.ts preserva value canónico español [contrato EF], constants/pricing.ts fuente única de montos MXN, glosario verificado; minor p/final review: APRENDIZ_FEATURE_KEYS hand-indexed en vez de returnObjects, precios sin Intl.NumberFormat [neutral es-MX/en-US])
Task 10: complete (commit 317b9d3, review clean 0 issues; progress+profile+StreakFlame [rezagado de T7]; clave dinámica goal.labels.${type} verificada manualmente [6 tipos en ambos locales + defaultValue], 4 fechas a formatDate incl. x-axis de WeightChart [mejora: ahora locale-adaptive m/d en en-US], sin t() en worklet de StreakFlame; minor p/final: "kg current" fraseo, x-axis cambio de comportamiento a mencionar en E2E)
Task 11: complete (commit cd09446, review clean 0 issues; ÚLTIMA pantalla — check-i18n EXIT 0 TOTAL, toda la UI migrada; delete-account confirmWord como clave [ELIMINAR/DELETE] verificado en ambos idiomas, Input.tsx Ver/Ocultar→common:show/hide [excepción sancionada], subscription periodEnd→formatDate, fix latente: fila Idioma del hub mostraba siempre Español, friendlyAuthError movido a closure para t(); minors p/final: friendlyAuthError/confirmWord sin memoizar [estilo])
Task 12: complete (commit 7fed7bc, review approved, deno test 8/8; chat/generate-plan/generate-meal-plan leen profiles.language, línea de idioma en bloque per-user NO en SYSTEM_PROMPT [cache-safe verificado], schema JSON intacto, === 'en' estricto [es/es-MX/NULL→español], degradación graceful si falla el fetch; chat EN verificado por curl real; NOTA: TS2551 en generate-meal-plan/index.ts es PRE-EXISTENTE [anterior a la rama i18n, confirmado byte-a-byte] — no bloquea, candidato a fix aparte; minor: sin tests unitarios de la rama de idioma)
Task 13: complete (commit 926cec4, review approved, TDD genuino [RED verificado vía git history, no solo el reporte], suite 11/11; texts.ts con 6 kinds × es/en, español verbatim excepto Memo→Vulcano [0 Memo en prod], glosario EN consistente, decideNotification devuelve {type,kind,params}, query separada profiles.language + Map, get_notification_targets() SQL intacto, degradación graceful; minors: getNotificationText resuelto 2× por send [micro], sin console.error en fallo de query de idioma)
Task 14: complete (commit 38a64b7 docs + ac1f4f9 limpieza es-MX huérfano; verificación total en verde: tsc 0, check-i18n OK, deno 11/11; sección i18n en forja-docs revisada por controller [arquitectura namespaces, flujo idioma, cómo agregar string/idioma, contenido IA, push, formatDate, fuera de alcance]; Step 4 = E2E humano PENDIENTE con el usuario)
Final review: complete (commits 555bd37..ac1f4f9, 17 commits, READY TO MERGE — 0 critical, 0 important; los 11 minors acumulados TODOS diferidos; gates verificados independientemente por el reviewer [tsc 0/check-i18n OK/deno 11/11]; seams cross-task correctos: normalización === 'en' idéntica en 6 sitios, cache del SYSTEM_PROMPT aislada, matching de día bilingüe, pricing/mealOptions fuente única, es-MX removido sin refs colgantes. Pendiente humano: E2E §7.3 — el reviewer pide vigilar 3 cosas en runtime: chips de daysShort renderizan label no clave, plan ES bajo UI EN muestra lenguaje mixto [esperado por aiNote], x-axis de WeightChart ahora locale-adaptive. NO pusheado aún.)

## Mini-paso: traducción de planes con caché (plan 2026-07-12)
Task 1: complete (commits 4ea85de..1c2d08b, review clean 0 issues; migración 0010 verbatim, backfill 4/4 es, +1 línea por EF de generación, columnas verificadas independientemente por controller)
Task 2: complete (commits 1c2d08b..b30367b [impl 3902075 byte-idéntico al brief, TDD RED genuino + fix b30367b], re-review approved 16/16 tests; hallazgo Important resuelto: elementos no-objeto en arrays traducidos ahora ShapeMismatchError [antes TypeError crudo]; minors p/final review: WORKOUT_TOP_FIELDS incluye weekly_schedule_summary/progression_notes que extractOriginalContent nunca emite [no-op future-proof, heredado del plan])
Task 3: complete (commit 46d8332, review approved; index.ts byte-idéntico al brief, E2E real: Haiku 20.6s ES→EN correcto, caché 0.038s, 400/404/401, jsonb en persistido; desviación operativa documentada: EF nueva requiere supabase stop+start [config de ruteo congelada al crear contenedor] — política restart unless-stopped reaplicada por controller; PARA FINAL REVIEW [plan-mandated, decisión del usuario]: saveTranslation read-merge-write no atómico — race teórico entre 2 idiomas concurrentes puede perder un caché [costo: 1 re-traducción Haiku; sin corrupción]; minors: env vars con ! sin fail-fast, 405 fuera del contrato prose)
Task 4: complete (commit 6b5b398, review approved, hook byte-idéntico al brief, tsc+check-i18n verificados independientemente por reviewer; invalidateQueries cruzado vs query keys reales OK, sin hooks condicionales, guard useRef sobrevive Strict Mode; nota p/Tasks 5-6: mutation.data stale 1 frame si el plan cambia sin remount [workout mootea por ruta [id]; meal mootea por corto-circuito lang===source tras regenerar]; minors p/final: isTranslating perpetuo si session null con pantalla montada, identidad de plan en deps del effect [perf])
Task 5: complete (commit dbeb895, review clean 0 issues; 7/7 mods del brief en workout/[id].tsx verificadas contra archivo completo, tsc re-corrido por reviewer, caminos error/null/isTranslating validados contra el hook, NativeWind OK, claves i18n confirmadas en ambos locales)
Task 6: complete (commit 390aefa, review clean 0 issues; 6/6 mods del brief en meal/index.tsx, camino de error verificado contra el hook [planData=original, nunca null], header gated con && único, tsc+check-i18n re-corridos por reviewer; ⚠️ estructura de días preservada resuelto por controller: garantizado por construcción en applyTranslation + tests Task 2)
Task 7: complete (commit 18a0d76, review approved; hub pasivo verificado CRÍTICO [trigger:false corta el effect, único camino al fetch], WorkoutDay movido sin cambios, docs verbatim, verificación estática re-corrida por reviewer: tsc 0 + check-i18n OK + deno 16/16; minor p/final: types/database.types.ts sin source_language/translations en Rows [gap de tipado preexistente-0010, runtime OK])
Final review: complete (commits 4ea85de..88cfffd, 9 commits, READY TO MERGE tras 1 fix — 0 critical, 0 important; reviewer verificó seams cross-task [shape EF↔hook↔pantallas, invalidación por prefijo vs query keys reales, corto-circuito caché DB→EF→hook→pantalla], seguridad [RLS+JWT lectura, service role solo UPDATE translations, sin fugas], y re-corrió gates [tsc 0, check-i18n OK, deno 16/16]. Fix pre-merge aplicado por controller: 88cfffd regenera types/database.types.ts [solo reorden alfabético + columnas 0010, mode intacto] + LocalizablePlan.translations→unknown [tipo-only]. DIFERIDOS con justificación: race read-merge-write saveTranslation [plan-mandated, activar RPC atómico si +idiomas], RLS FOR ALL permite al cliente tocar su propio translations [vector de costo menor, backlog], planData={} si meals corrupto en meal screen [inalcanzable hoy, blindar en próximo touch], WORKOUT_TOP_FIELDS no-op, isTranslating con session null, select(*) arrastra translations. PENDIENTE: E2E humano Expo Go checklist spec §8 [6 puntos, en especial #5 source_language=en en plan nuevo]. NO pusheado aún.)
