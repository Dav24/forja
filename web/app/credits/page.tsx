import { EmberField } from '@/components/EmberField';
import { Wordmark } from '@/components/Wordmark';
import { CreditPackSection } from '@/components/CreditPackSection';
import { isValidUid } from '@/lib/checkout';

export default async function Credits({
  searchParams,
}: {
  searchParams: Promise<{ uid?: string }>;
}) {
  const params = await searchParams;
  const uid = isValidUid(params.uid) ? params.uid : null;

  return (
    <main className="flex flex-col gap-12 pb-24">
      <header className="relative overflow-hidden pb-6 pt-16 text-center">
        <EmberField />
        <div className="relative">
          <Wordmark className="text-3xl" />
          <h1 className="mx-auto mt-8 max-w-2xl px-4 font-display text-5xl leading-none md:text-6xl">
            CRÉDITOS EXTRA
          </h1>
          <p className="mx-auto mt-4 max-w-xl px-4 text-muted">
            Ya usaste tu plan gratuito de este mes. Compra créditos extra sin suscribirte.
          </p>
        </div>
      </header>

      <CreditPackSection uid={uid} />

      <footer className="px-4 text-center text-xs text-muted">
        Pago procesado de forma segura con Stripe
      </footer>
    </main>
  );
}
