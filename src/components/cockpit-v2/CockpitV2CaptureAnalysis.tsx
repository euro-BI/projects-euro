import { ArrowDownLeft, ArrowUpRight, CandlestickChart } from "lucide-react";
import { Bar, CartesianGrid, Cell, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CaptureAnalysisPoint, formatCurrencyCompact } from "@/utils/cockpit-v2-mappers";

function CaptureTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload as CaptureAnalysisPoint;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#101826] p-4 shadow-2xl">
      <div className="text-[10px] font-data uppercase tracking-[0.22em] text-euro-gold">{label}</div>
      <div className="mt-3 space-y-2 text-xs font-data">
        <div className="flex justify-between gap-6 text-white/60"><span>Entradas + transf.</span><span className="text-emerald-300">{formatCurrencyCompact(data.incomingFlow)}</span></div>
        <div className="flex justify-between gap-6 text-white/60"><span>Saídas + transf.</span><span className="text-rose-400">{formatCurrencyCompact(Math.abs(data.outgoingFlow))}</span></div>
        <div className="flex justify-between gap-6 text-white/60"><span>Diretas</span><span className="text-white">{formatCurrencyCompact(data.entries)}</span></div>
        <div className="flex justify-between gap-6 text-white/60"><span>Transferências</span><span className="text-cyan-300">{formatCurrencyCompact(data.transfersIn - data.transfersOut)}</span></div>
        <div className="flex justify-between gap-6 border-t border-white/5 pt-2 text-white/60">
          <span>Líquido</span>
          <span className={data.net >= 0 ? "text-emerald-300" : "text-rose-400"}>{formatCurrencyCompact(data.net)}</span>
        </div>
      </div>
    </div>
  );
}

export function CockpitV2CaptureAnalysis({ data }: { data: CaptureAnalysisPoint[] }) {
  if (!data.length) return null;

  const totals = data.reduce(
    (acc, item) => {
      acc.incoming += item.incomingFlow;
      acc.outgoing += Math.abs(item.outgoingFlow);
      acc.net += item.net;
      return acc;
    },
    { incoming: 0, outgoing: 0, net: 0 }
  );

  return (
    <section id="funding-analysis" className="scroll-mt-28">
      <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.11),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(248,113,113,0.11),_transparent_22%),linear-gradient(180deg,#121826_0%,#0A1019_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
        <div className="flex flex-col gap-4 border-b border-white/6 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-data uppercase tracking-[0.22em] text-euro-gold">
              <CandlestickChart className="h-4 w-4" />
              Análise de captação
            </div>
            <p className="mt-2 text-sm text-white/48">Resultado líquido consolidado com leitura de fluxo de entrada, saída e transferências ao longo do ano.</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-[#151C29] px-4 py-3">
              <div className="flex items-center gap-2 text-[10px] font-data uppercase tracking-[0.18em] text-white/35">
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-300" />
                Fluxo de entrada
              </div>
              <div className="mt-2 font-display text-xl text-emerald-300">{formatCurrencyCompact(totals.incoming)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#151C29] px-4 py-3">
              <div className="flex items-center gap-2 text-[10px] font-data uppercase tracking-[0.18em] text-white/35">
                <ArrowDownLeft className="h-3.5 w-3.5 text-rose-400" />
                Fluxo de saída
              </div>
              <div className="mt-2 font-display text-xl text-rose-400">{formatCurrencyCompact(totals.outgoing)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#151C29] px-4 py-3">
              <div className="text-[10px] font-data uppercase tracking-[0.18em] text-white/35">Líquido consolidado</div>
              <div className={`mt-2 font-display text-xl ${totals.net >= 0 ? "text-emerald-300" : "text-rose-400"}`}>{formatCurrencyCompact(totals.net)}</div>
            </div>
          </div>
        </div>

        <div className="h-[360px] px-4 pb-4 pt-2 md:px-6 md:pb-6">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 20, right: 8, left: 8, bottom: 0 }}>
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
                tickFormatter={(value) => `R$${(Math.abs(value) / 1000).toFixed(0)}k`}
                tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 10, fontFamily: "var(--font-data, monospace)" }}
              />
              <Tooltip content={<CaptureTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="incomingFlow" radius={[6, 6, 0, 0]} barSize={34}>
                {data.map((entry) => (
                  <Cell key={`${entry.monthKey}-in`} fill="#22C55E" />
                ))}
              </Bar>
              <Bar dataKey="outgoingFlow" radius={[0, 0, 6, 6]} barSize={34}>
                {data.map((entry) => (
                  <Cell key={`${entry.monthKey}-out`} fill="#F43F5E" />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
