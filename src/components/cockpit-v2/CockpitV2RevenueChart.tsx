import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { CockpitV2ChartPoint, RevenueViewKey, formatCurrency } from "@/utils/cockpit-v2-mappers";

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as CockpitV2ChartPoint;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#101826] p-4 shadow-2xl">
      <div className="text-[10px] font-data uppercase tracking-[0.22em] text-euro-gold">{label}</div>
      <div className="mt-3 space-y-2 text-xs font-data">
        <div className="flex justify-between gap-6 text-white/60"><span>Realizado</span><span className="text-white">{formatCurrency(data.realized)}</span></div>
        <div className="flex justify-between gap-6 text-white/60"><span>Meta</span><span className="text-white">{formatCurrency(data.target)}</span></div>
        <div className="flex justify-between gap-6 border-t border-white/5 pt-2 text-white/60">
          <span>Gap</span>
          <span className={data.gap > 0 ? "text-rose-400" : "text-emerald-400"}>
            {data.gap > 0 ? "-" : "+"}{formatCurrency(Math.abs(data.gap))}
          </span>
        </div>
      </div>
    </div>
  );
}

const revenueViews: { key: RevenueViewKey; label: string }[] = [
  { key: "total", label: "Receita Total" },
  { key: "investimentos", label: "Investimentos" },
  { key: "cross_sell", label: "Cross-Sell" },
  { key: "captação", label: "Captação" },
];

export function CockpitV2RevenueChart({
  data,
  selectedView,
  onChangeView,
}: {
  data: CockpitV2ChartPoint[];
  selectedView: RevenueViewKey;
  onChangeView: (view: RevenueViewKey) => void;
}) {
  if (!data.length) return null;
  const activeLabel = revenueViews.find((view) => view.key === selectedView)?.label ?? "Receita Total";

  return (
    <section id="revenue" className="scroll-mt-28">
      <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(250,192,23,0.12),_transparent_26%),linear-gradient(180deg,#121826_0%,#0A1019_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
        <div className="flex flex-col gap-4 border-b border-white/6 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-data uppercase tracking-[0.22em] text-euro-gold">
              <TrendingUp className="h-4 w-4" />
              Evolução de {activeLabel}
            </div>
            <p className="mt-2 text-sm text-white/48">Acompanhe o realizado mês a mês comparado à meta calculada para o tipo de leitura selecionado.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {revenueViews.map((view) => (
              <button
                key={view.key}
                type="button"
                onClick={() => onChangeView(view.key)}
                className={`rounded-full px-3 py-2 text-[10px] font-data uppercase tracking-[0.18em] transition-all ${
                  selectedView === view.key
                    ? "bg-euro-gold text-euro-navy shadow-[0_0_20px_rgba(250,192,23,0.18)]"
                    : "border border-white/10 bg-[#151C29] text-white/55 hover:text-white hover:bg-[#192132]"
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[360px] px-4 pb-4 pt-2 md:px-6 md:pb-6">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 20, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="cockpitV2Revenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FAC017" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#FAC017" stopOpacity={0.15} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="monthLabel"
                axisLine={false}
                tickLine={false}
                dy={10}
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10, fontFamily: "var(--font-data, monospace)" }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                dx={-8}
                tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 10, fontFamily: "var(--font-data, monospace)" }}
              />
              <Tooltip content={<RevenueTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="realized" fill="url(#cockpitV2Revenue)" radius={[6, 6, 0, 0]} barSize={34} />
              <Line
                type="monotone"
                dataKey="target"
                stroke="#FFFFFF"
                strokeWidth={2}
                strokeDasharray="4 5"
                dot={{ r: 3, fill: "#FFFFFF" }}
                activeDot={{ r: 5, fill: "#FAC017" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
