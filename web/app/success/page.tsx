'use client';

import { useEffect } from 'react';
import { Flame } from 'lucide-react';
import { Wordmark } from '@/components/Wordmark';

const DEEP_LINK = 'forja://success';

export default function Success() {
  useEffect(() => {
    const t = setTimeout(() => {
      window.location.href = DEEP_LINK;
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Wordmark className="text-2xl" />
      <Flame className="ember-glow h-16 w-16 rounded-full p-3 text-ember" aria-hidden />
      <h1 className="font-display text-6xl leading-none">EL ACERO ESTÁ FORJADO</h1>
      <p className="max-w-md text-muted">
        Ya eres <strong className="text-amber-bright">Maestro Forjador</strong>. Tu Premium está
        activo — vuelve a la app y forja.
      </p>
      <a
        href={DEEP_LINK}
        className="cursor-pointer rounded-xl bg-ember px-8 py-3.5 font-bold text-carbon transition-colors duration-200 hover:bg-amber-bright"
      >
        Volver a Forja
      </a>
      <p className="text-xs text-muted">Si la app no abre sola, ábrela manualmente — tu plan ya está activo.</p>
    </main>
  );
}
