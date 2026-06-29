import { motion } from "framer-motion";
import { Target, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { CockpitV2Kpis, formatCurrency, getGaugeTone } from "@/utils/cockpit-v2-mappers";

export function CockpitV2FundingPulse({ kpis }: { kpis: CockpitV2Kpis }) {
  if (!kpis) return null;

  return (
    <div className="rounded-[30px] border border-emerald-400/18 bg-[radial-gradient(circle_at_bottom_right,_rgba(34,197,94,0.14),_transparent_28%),linear-gradient(180deg,#111925_0%,#0A1019_100%)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
            <Wallet className="h-7 w-7" />
          </div>
          <div>
            <div className="text-[10px] font-data uppercase tracking-[0.22em] text-white/35">Captação líquida</div>
            <div className="mt-1 font-display text-2xl uppercase tracking-[0.12em] text-white">Pulso mensal da captação</div>
          </div>
        </div>

        <div className="min-w-[240px] rounded-3xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-end justify-between">
            <div className="text-[10px] font-data uppercase tracking-[0.18em] text-white/35">Atingimento</div>
            <div className={cn("font-display text-4xl", getGaugeTone(kpis.funding.percent).text)}>{kpis.funding.percent.toFixed(1)}%</div>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/6">
            <motion.div
              className={cn("h-full rounded-full", getGaugeTone(kpis.funding.percent).bar)}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(kpis.funding.percent, 100)}%` }}
              transition={{ duration: 1.1, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center gap-2 text-[10px] font-data uppercase tracking-[0.2em] text-white/35">
            <Target className="h-3.5 w-3.5 text-euro-gold" />
            Objetivo
          </div>
          <div className="mt-3 font-display text-3xl text-white">{formatCurrency(kpis.funding.target)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-[10px] font-data uppercase tracking-[0.2em] text-white/35">Realizado</div>
          <div className="mt-3 font-display text-3xl text-emerald-300">{formatCurrency(kpis.funding.realized)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-[10px] font-data uppercase tracking-[0.2em] text-white/35">Gap</div>
          <div className={cn("mt-3 font-display text-3xl", kpis.funding.gap > 0 ? "text-rose-400" : "text-emerald-300")}>
            {kpis.funding.gap > 0 ? "-" : "+"}{formatCurrency(Math.abs(kpis.funding.gap))}
          </div>
        </div>
      </div>
    </div>
  );
}
