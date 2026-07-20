'use client';

import { useState } from 'react';
import { Zap, Loader2 } from 'lucide-react';

const CREDIT_PACK_ID = 'pack_3';
const CREDIT_PACK_SIZE = 3;
const CREDIT_PACK_PRICE = '$99';

export function CreditPackSection({ uid }: { uid: string | null }) {
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
        body: JSON.stringify({ kind: 'credit_pack', packId: CREDIT_PACK_ID, uid }),
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

  return (
    <section className="mx-auto w-full max-w-md px-4">
      <div className="rounded-2xl border border-subtle bg-surface/70 p-6 text-center">
        <Zap className="mx-auto h-8 w-8 text-amber-bright" aria-hidden />
        <h3 className="mt-3 font-display text-3xl">+{CREDIT_PACK_SIZE} planes extra</h3>
        <p className="mb-6 mt-2 text-2xl font-bold text-ember">
          {CREDIT_PACK_PRICE} <span className="text-sm font-normal text-muted">MXN</span>
        </p>
        <p className="mb-6 text-sm text-muted">
          Sin suscripción. Úsalos cuando quieras en planes de entreno o de alimentación.
        </p>
        {uid ? (
          <>
            <button
              onClick={startCheckout}
              disabled={loading}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-ember py-3.5 font-bold text-carbon transition-colors duration-200 hover:bg-amber-bright disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Comprar créditos
            </button>
            {error && (
              <p role="alert" className="mt-3 text-center text-sm text-destructive">
                {error}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">Abre este link desde la app para comprar.</p>
        )}
      </div>
    </section>
  );
}
