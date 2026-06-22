import { Download, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent } from "@/utils/cockpit-v2-mappers";

type TableRow = {
  code: string;
  assessor: string;
  team: string;
  netClientes: number;
  metaCaptacao: number;
  captacaoLiquida: number;
  metaReceita: number;
  receitaTotal: number;
  receitaInvest: number;
  receitaCs: number;
  roaTotal: number;
  ativacao300k: number;
  repasseTotal: number;
};

export function CockpitV2IndicatorsTable({
  rows,
  onExport,
}: {
  rows: TableRow[];
  onExport: () => void;
}) {
  return (
    <section id="table" className="scroll-mt-28">
      <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,#121826_0%,#0A1019_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
        <div className="flex flex-col gap-4 border-b border-white/6 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-data uppercase tracking-[0.22em] text-euro-gold">
              <Table2 className="h-4 w-4" />
              Indicadores gerais
            </div>
            <p className="mt-2 text-sm text-white/48">Fechamento auditável do recorte atual com receita, captação, ativações e repasse.</p>
          </div>

          <Button
            onClick={onExport}
            className="rounded-full border border-euro-gold/20 bg-euro-gold/10 text-euro-gold hover:bg-euro-gold/20"
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>

        <div className="overflow-auto custom-scrollbar">
          <table className="min-w-[1180px] w-full border-collapse text-left">
            <thead className="sticky top-0 z-10">
              <tr className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-[0.18em]">
                <th className="px-4 py-4">Time</th>
                <th className="px-4 py-4">Assessor</th>
                <th className="px-4 py-4 text-right">Custódia</th>
                <th className="px-4 py-4 text-right">Meta Cap.</th>
                <th className="px-4 py-4 text-right">Cap. Líquida</th>
                <th className="px-4 py-4 text-right">Meta Receita</th>
                <th className="px-4 py-4 text-right">Receita Total</th>
                <th className="px-4 py-4 text-right">Receita Invest</th>
                <th className="px-4 py-4 text-right">Receita CS</th>
                <th className="px-4 py-4 text-right">ROA Total</th>
                <th className="px-4 py-4 text-right">Ativ. 300k</th>
                <th className="px-4 py-4 text-right">Repasse</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {rows.map((row) => (
                <tr key={`${row.code}-${row.team}`} className="bg-transparent text-sm font-data hover:bg-white/[0.03]">
                  <td className="px-4 py-4 text-white/70">{row.team}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-white">{row.assessor}</span>
                      <span className="text-[11px] text-white/32">{row.code}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right text-white/72">{formatCurrency(row.netClientes)}</td>
                  <td className="px-4 py-4 text-right text-white/72">{formatCurrency(row.metaCaptacao)}</td>
                  <td className="px-4 py-4 text-right text-emerald-400">{formatCurrency(row.captacaoLiquida)}</td>
                  <td className="px-4 py-4 text-right text-white/72">{formatCurrency(row.metaReceita)}</td>
                  <td className="px-4 py-4 text-right text-white">{formatCurrency(row.receitaTotal)}</td>
                  <td className="px-4 py-4 text-right text-cyan-300">{formatCurrency(row.receitaInvest)}</td>
                  <td className="px-4 py-4 text-right text-fuchsia-300">{formatCurrency(row.receitaCs)}</td>
                  <td className="px-4 py-4 text-right text-euro-gold">{formatPercent(row.roaTotal * 100, 2)}</td>
                  <td className="px-4 py-4 text-right text-white/72">{row.ativacao300k}</td>
                  <td className="px-4 py-4 text-right text-euro-gold">{formatCurrency(row.repasseTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
