import { motion } from "framer-motion";
import { BriefcaseBusiness, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { CockpitV2Kpis, ProductRow, formatCurrency, formatPercent, getGaugeTone } from "@/utils/cockpit-v2-mappers";

function ProductBreakdown({ rows }: { rows: ProductRow[] }) {
  return (
    <div className="mt-6 border-t border-white/8 pt-4">
      <div className="mb-3 grid grid-cols-4 gap-2 text-[10px] font-data uppercase tracking-[0.2em] text-white/35">
        <div>Produto</div>
        <div className="text-right">Meta</div>
        <div className="text-right">Real.</div>
        <div className="text-right">Gap</div>
      </div>
      <div className="space-y-1.5">
        {rows.slice().sort((a, b) => b.target - a.target).map((row) => (
          <div key={row.label} className="grid grid-cols-4 gap-2 rounded-xl px-2 py-2 text-[11px] font-data hover:bg-white/[0.04]">
            <div className="truncate text-white">{row.label}</div>
            <div className="text-right text-white/55">{formatCurrency(row.target)}</div>
            <div className="text-right text-white">{formatCurrency(row.realized)}</div>
            <div className={cn("text-right", row.gap > 0 ? "text-rose-400" : "text-emerald-400")}>
              {row.gap > 0 ? "-" : "+"}{formatCurrency(Math.abs(row.gap))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressCard({
  title,
  accentClass,
  percent,
  target,
  realized,
  gap,
  icon,
  rows,
}: {
  title: string;
  accentClass: string;
  percent: number;
  target: number;
  realized: number;
  gap: number;
  icon: React.ReactNode;
  rows: ProductRow[];
}) {
  const tone = getGaugeTone(percent);

  return (
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#121826_0%,#0A1019_100%)] p-6 shadow-[0_22px_70px_rgba(0,0,0,0.28)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10", accentClass)}>{icon}</div>
          <div>
            <div className="text-[10px] font-data uppercase tracking-[0.22em] text-white/35">Eixo de performance</div>
            <div className="mt-1 font-data text-lg uppercase tracking-[0.14em] text-white">{title}</div>
          </div>
        </div>
        <div className={cn("font-display text-4xl", tone.text)}>{formatPercent(percent)}</div>
      </div>

      <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/6">
        <motion.div
          className={cn("h-full rounded-full", tone.bar)}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percent, 100)}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl border border-white/8 bg-black/20 p-4">
        <div>
          <div className="text-[10px] font-data uppercase tracking-[0.18em] text-white/35">Meta</div>
          <div className="mt-2 font-display text-base text-euro-gold">{formatCurrency(target)}</div>
        </div>
        <div>
          <div className="text-[10px] font-data uppercase tracking-[0.18em] text-white/35">Realizado</div>
          <div className="mt-2 font-display text-base text-white">{formatCurrency(realized)}</div>
        </div>
        <div>
          <div className="text-[10px] font-data uppercase tracking-[0.18em] text-white/35">Gap</div>
          <div className={cn("mt-2 font-display text-base", gap > 0 ? "text-rose-400" : "text-emerald-400")}>
            {gap > 0 ? "-" : "+"}{formatCurrency(Math.abs(gap))}
          </div>
        </div>
      </div>

      <ProductBreakdown rows={rows} />
    </div>
  );
}

export function CockpitV2PerformanceSection({ kpis }: { kpis: CockpitV2Kpis }) {
  if (!kpis) return null;
  const gaugeTone = getGaugeTone(kpis.global.percent);
  const circumference = 2 * Math.PI * 88;
  const strokeDashoffset = circumference * (1 - Math.min(kpis.global.percent, 100) / 100);

  return (
    <section id="performance" className="grid grid-cols-1 gap-6 xl:grid-cols-12 scroll-mt-28">
      <div className="xl:col-span-4 rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(250,192,23,0.14),_transparent_30%),linear-gradient(180deg,#121826_0%,#0A1019_100%)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="text-center">
          <div className="text-[10px] font-data uppercase tracking-[0.24em] text-euro-gold">Performance global</div>
          <div className="mt-3 text-sm text-white/55">A régua consolidada do assessor combinando investimentos e cross-sell.</div>
        </div>

        <div className="relative mx-auto mt-8 flex h-[250px] w-[250px] items-center justify-center">
          <svg className="h-full w-full -rotate-90">
            <circle cx="125" cy="125" r="88" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="14" />
            <motion.circle
              cx="125"
              cy="125"
              r="88"
              fill="none"
              stroke={gaugeTone.line}
              strokeWidth="14"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.4, ease: "easeOut" }}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={cn("font-display text-6xl", gaugeTone.text)}>{kpis.global.percent.toFixed(0)}%</div>
            <div className="mt-2 text-[11px] font-data uppercase tracking-[0.18em] text-white/35">Atingimento</div>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-3 border-t border-white/8 pt-6">
          <div className="text-center">
            <div className="text-[10px] font-data uppercase tracking-[0.18em] text-white/35">Meta</div>
            <div className="mt-2 font-display text-sm text-euro-gold">{formatCurrency(kpis.global.target)}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-data uppercase tracking-[0.18em] text-white/35">Realizado</div>
            <div className="mt-2 font-display text-sm text-white">{formatCurrency(kpis.global.realized)}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-data uppercase tracking-[0.18em] text-white/35">Gap</div>
            <div className={cn("mt-2 font-display text-sm", kpis.global.gap > 0 ? "text-rose-400" : "text-emerald-400")}>
              {kpis.global.gap > 0 ? "-" : "+"}{formatCurrency(Math.abs(kpis.global.gap))}
            </div>
          </div>
        </div>
      </div>

      <div className="xl:col-span-8 grid grid-cols-1 gap-6 2xl:grid-cols-2">
        <ProgressCard
          title="Investimentos"
          accentClass="bg-cyan-400/10 text-cyan-300"
          percent={kpis.invest.percent}
          target={kpis.invest.target}
          realized={kpis.invest.realized}
          gap={kpis.invest.gap}
          icon={<TrendingUp className="h-5 w-5" />}
          rows={kpis.invest.products}
        />
        <ProgressCard
          title="Cross-Sell"
          accentClass="bg-fuchsia-400/10 text-fuchsia-300"
          percent={kpis.cs.percent}
          target={kpis.cs.target}
          realized={kpis.cs.realized}
          gap={kpis.cs.gap}
          icon={<BriefcaseBusiness className="h-5 w-5" />}
          rows={kpis.cs.products}
        />
      </div>

    </section>
  );
}
