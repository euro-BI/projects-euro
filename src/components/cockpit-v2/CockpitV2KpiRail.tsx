import { cn } from "@/lib/utils";
import { CockpitV2TopMetric } from "@/utils/cockpit-v2-mappers";

const toneMap: Record<CockpitV2TopMetric["tone"], string> = {
  gold: "from-euro-gold/18 to-transparent border-euro-gold/20",
  green: "from-emerald-400/18 to-transparent border-emerald-400/20",
  blue: "from-cyan-400/18 to-transparent border-cyan-400/20",
  magenta: "from-fuchsia-400/18 to-transparent border-fuchsia-400/20",
  neutral: "from-white/10 to-transparent border-white/10",
};

export function CockpitV2KpiRail({ metrics }: { metrics: CockpitV2TopMetric[] }) {
  return (
    <section id="kpis" className="scroll-mt-28">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[11px] font-data uppercase tracking-[0.24em] text-euro-gold">Pulso do assessor</h2>
          <p className="mt-2 text-sm text-white/50">Indicadores rápidos para abrir a leitura do mês sem precisar navegar por outras telas.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {metrics.map((metric) => (
          <div
            key={metric.id}
            className={cn(
              "overflow-hidden rounded-[26px] border p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)]",
              "bg-[linear-gradient(180deg,#151C29_0%,#101722_100%)]",
              toneMap[metric.tone]
            )}
          >
            <div className="text-[10px] font-data uppercase tracking-[0.22em] text-white/38">{metric.label}</div>
            <div className="mt-4 font-display text-4xl text-white">{metric.value}</div>
            <div className="mt-3 text-sm leading-relaxed text-white/48">{metric.support}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
