const FAQS = [
  {
    q: '¿Cómo se activa en la app?',
    a: 'Automático. Al completar el pago, tu cuenta se convierte en Maestro Forjador en segundos. Solo vuelve a la app.',
  },
  {
    q: '¿Puedo cancelar cuando quiera?',
    a: 'Sí, desde "Gestionar suscripción" en tu perfil. Conservas Maestro Forjador hasta el final del periodo que ya pagaste.',
  },
  {
    q: '¿Qué métodos de pago aceptan?',
    a: 'Tarjetas de crédito y débito (Visa, Mastercard, Amex), procesadas de forma segura por Stripe. Nunca vemos tu tarjeta.',
  },
  {
    q: 'Tengo un código, ¿dónde lo pongo?',
    a: 'Toca "¿Tienes un código?" bajo el botón de pago, o escríbelo directo en la pantalla de pago de Stripe.',
  },
];

export function Faq() {
  return (
    <section className="mx-auto w-full max-w-2xl px-4">
      <h2 className="mb-6 text-center font-display text-4xl">Preguntas frecuentes</h2>
      <div className="space-y-3">
        {FAQS.map(({ q, a }) => (
          <details key={q} className="group rounded-xl border border-subtle bg-surface/70 p-4">
            <summary className="cursor-pointer list-none font-semibold marker:hidden">{q}</summary>
            <p className="mt-2 text-sm leading-relaxed text-muted">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
