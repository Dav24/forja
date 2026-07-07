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
