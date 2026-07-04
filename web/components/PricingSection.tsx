'use client';

import { useState } from 'react';
import { Check, Minus, Flame, Loader2 } from 'lucide-react';
import type { Billing } from '@/lib/checkout';

const APRENDIZ = [
  '20 mensajes al día con Vulcano',
  '1 plan de entrenamiento al mes',
  '1 plan alimenticio',
  'Seguimiento corporal (14 días)',
  'Conexión de pulsera o reloj',
];

const MAESTRO = [
  'Chat ilimitado con Vulcano',
  'Planes de entrenamiento ilimitados',
  '10 planes alimenticios al mes',
  '365 días de historial corporal',
  'Composición corporal (% grasa, músculo)',
  'Vulcano analiza tus datos de actividad',
];

const EN_CAMINO = [
  'Fotos de comida con análisis IA',
  'Análisis de técnica de ejercicio',
  'Coaching en tiempo real',
];

export function PricingSection({
  uid,
  initialBilling,
  initialPromo,
}: {
  uid: string | null;
  initialBilling: Billing;
  initialPromo: string;
}) {
  const [billing, setBilling] = useState<Billing>(initialBilling);
  const [promo, setPromo] = useState(initialPromo);
  const [promoOpen, setPromoOpen] = useState(!!initialPromo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    if (!uid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ billing, uid, promo: promo || undefined }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { url } = await res.json();
      if (!url) throw new Error('missing url');
      window.location.href = url;
    } catch {
      setError('No pudimos iniciar el pago, intenta de nuevo.');
      setLoading(false);
    }
  }

  const price = billing === 'monthly' ? '$179' : '$1,299';
  const period = billing === 'monthly' ? '/mes' : '/año';

  return (
    <section id="planes" className="mx-auto w-full max-w-4xl px-4">
      {/* Toggle */}
      <div className="mx-auto mb-2 flex w-fit rounded-xl bg-surface p-1">
        {(['monthly', 'yearly'] as const).map((b) => (
          <button
            key={b}
            aria-pressed={billing === b}
            onClick={() => setBilling(b)}
            className={`cursor-pointer rounded-lg px-6 py-2 text-sm font-semibold transition-colors duration-200 ${
              billing === b ? 'bg-ember text-carbon' : 'text-muted hover:text-foreground'
            }`}
          >
            {b === 'monthly' ? 'Mensual' : 'Anual'}
          </button>
        ))}
      </div>
      <p className="mb-8 h-5 text-center text-sm text-amber-bright">
        {billing === 'yearly' ? '2 meses gratis · ahorra 40%' : ''}
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Aprendiz */}
        <div className="rounded-2xl border border-subtle bg-surface/70 p-6">
          <h3 className="font-display text-3xl">Aprendiz</h3>
          <p className="mb-6 mt-2 text-2xl font-bold">
            $0 <span className="text-sm font-normal text-muted">para siempre</span>
          </p>
          <ul className="space-y-3">
            {APRENDIZ.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-muted">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Maestro Forjador */}
        <div className="ember-glow relative rounded-2xl bg-gradient-to-br from-amber-bright to-ember p-[2px]">
          <span className="absolute -top-3 left-6 rounded-full bg-ember px-3 py-1 text-xs font-bold tracking-wide text-carbon">
            RECOMENDADO
          </span>
          <div className="h-full rounded-[14px] bg-surface p-6">
            <h3 className="font-display text-3xl">Maestro Forjador</h3>
            <p className="mb-1 mt-2 text-2xl font-bold text-ember">
              {price} <span className="text-sm font-normal text-muted">MXN{period}</span>
            </p>
            <p className="mb-5 h-4 text-xs text-muted">
              {billing === 'yearly' ? 'Equivale a $108/mes' : ''}
            </p>
            <ul className="space-y-3">
              {MAESTRO.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-bright" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <p className="mb-2 mt-5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-amber-bright">
              <Flame className="h-3.5 w-3.5" aria-hidden /> EN CAMINO
            </p>
            <ul className="space-y-2">
              {EN_CAMINO.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-muted">
                  <Minus className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>

            {uid ? (
              <>
                <button
                  onClick={startCheckout}
                  disabled={loading}
                  className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-ember py-3.5 font-bold text-carbon transition-colors duration-200 hover:bg-amber-bright disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  Convertirme en Maestro
                </button>
                {error && (
                  <p role="alert" className="mt-3 text-center text-sm text-destructive">
                    {error}
                  </p>
                )}
                <button
                  onClick={() => setPromoOpen((v) => !v)}
                  className="mt-4 w-full cursor-pointer text-center text-sm text-muted transition-colors duration-200 hover:text-foreground"
                >
                  ¿Tienes un código?
                </button>
                {promoOpen && (
                  <input
                    value={promo}
                    onChange={(e) => setPromo(e.target.value.toUpperCase())}
                    placeholder="CODIGO"
                    aria-label="Código promocional"
                    className="mt-2 w-full rounded-lg border border-subtle bg-carbon px-3 py-2 text-sm uppercase placeholder:text-muted focus:border-ember focus:outline-none"
                  />
                )}
              </>
            ) : (
              <div className="mt-6 space-y-2">
                <p className="text-center font-bold">Descarga Forja y empieza gratis</p>
                <a
                  href={process.env.NEXT_PUBLIC_APP_STORE_URL ?? '#'}
                  className="block w-full cursor-pointer rounded-xl bg-ember py-3.5 text-center font-bold text-carbon transition-colors duration-200 hover:bg-amber-bright"
                >
                  Descargar en App Store
                </a>
                <a
                  href={process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? '#'}
                  className="block w-full cursor-pointer rounded-xl bg-ember py-3.5 text-center font-bold text-carbon transition-colors duration-200 hover:bg-amber-bright"
                >
                  Descargar en Google Play
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
