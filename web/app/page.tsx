import { EmberField } from '@/components/EmberField';
import { Wordmark } from '@/components/Wordmark';
import { PricingSection } from '@/components/PricingSection';
import { ComparisonTable } from '@/components/ComparisonTable';
import { Faq } from '@/components/Faq';
import { isValidUid } from '@/lib/checkout';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ uid?: string; billing?: string; promo?: string }>;
}) {
  const params = await searchParams;
  const uid = isValidUid(params.uid) ? params.uid : null;
  const initialBilling = params.billing === 'monthly' ? 'monthly' : 'yearly';
  const initialPromo = (params.promo ?? '').toUpperCase().slice(0, 40);

  return (
    <main className="flex flex-col gap-20 pb-24">
      {/* Hero */}
      <header className="relative overflow-hidden pb-10 pt-16 text-center">
        <EmberField />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-64 bg-[radial-gradient(ellipse_at_bottom,rgba(249,115,22,0.22),transparent_65%)]"
        />
        <div className="relative">
          <Wordmark className="text-3xl" />
          <h1 className="mx-auto mt-8 max-w-3xl px-4 font-display text-6xl leading-none md:text-8xl">
            FORJA TU MEJOR VERSIÓN
          </h1>
          <p className="mx-auto mt-4 max-w-xl px-4 text-muted">
            Tu entrenador con IA: rutinas, nutrición y seguimiento, forjados para ti por Vulcano.
          </p>
        </div>
      </header>

      <PricingSection uid={uid} initialBilling={initialBilling} initialPromo={initialPromo} />
      <ComparisonTable />
      <Faq />

      <footer className="px-4 text-center text-xs text-muted">
        Cancela cuando quieras · Pago procesado de forma segura con Stripe
      </footer>
    </main>
  );
}
