'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Wordmark } from '@/components/Wordmark';

function PortalRedirect() {
  const uid = useSearchParams().get('uid');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      return;
    }
    fetch('/api/portal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ uid }),
    })
      .then(async (res) => {
        if (res.status === 404) throw new Error('No encontramos una suscripción activa para tu cuenta.');
        if (!res.ok) throw new Error('No pudimos abrir el portal, intenta de nuevo.');
        const { url } = await res.json();
        window.location.href = url;
      })
      .catch((e: Error) => setError(e.message));
  }, [uid]);

  const displayError = !uid ? 'Falta información de tu cuenta. Abre esta página desde la app.' : error;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Wordmark className="text-2xl" />
      {displayError ? (
        <p role="alert" className="max-w-md text-muted">{displayError}</p>
      ) : (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-ember" aria-hidden />
          <p className="text-muted">Abriendo tu portal de suscripción…</p>
        </>
      )}
    </main>
  );
}

export default function Portal() {
  return (
    <Suspense>
      <PortalRedirect />
    </Suspense>
  );
}
