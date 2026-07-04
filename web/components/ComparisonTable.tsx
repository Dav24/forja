import { Check, Minus } from 'lucide-react';

const ROWS: [string, string | boolean, string | boolean][] = [
  ['Chat con Vulcano', '20 msgs/día', 'Ilimitado'],
  ['Planes de entrenamiento', '1 al mes', 'Ilimitados'],
  ['Planes alimenticios', '1', '10 al mes'],
  ['Historial corporal', '14 días', '365 días'],
  ['Conexión pulsera/reloj', true, true],
  ['Composición corporal (% grasa, músculo)', false, true],
  ['IA de Vulcano sobre tus datos de actividad', false, true],
];

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <Check className="mx-auto h-4 w-4 text-amber-bright" aria-label="Incluido" />;
  if (v === false) return <Minus className="mx-auto h-4 w-4 text-muted" aria-label="No incluido" />;
  return <span>{v}</span>;
}

export function ComparisonTable() {
  return (
    <section className="mx-auto w-full max-w-4xl px-4">
      <h2 className="mb-6 text-center font-display text-4xl">Compara los planes</h2>
      <div className="overflow-x-auto rounded-2xl border border-subtle">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="bg-surface text-left">
              <th className="p-4 font-semibold"> </th>
              <th className="p-4 text-center font-display text-lg font-normal">Aprendiz</th>
              <th className="p-4 text-center font-display text-lg font-normal text-ember">
                Maestro Forjador
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([label, free, paid], i) => (
              <tr key={label} className={i % 2 ? 'bg-surface/50' : ''}>
                <td className="p-4">{label}</td>
                <td className="p-4 text-center text-muted"><Cell v={free} /></td>
                <td className="p-4 text-center"><Cell v={paid} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
