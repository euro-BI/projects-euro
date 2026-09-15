import { useMemo, useState } from "react";
import { AssessorResumo } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, Shield, User } from "lucide-react";
import { Input } from "@/components/ui/input";

interface FundingAssessorTableProps {
  data: AssessorResumo[];
  teamPhotos?: Map<string, string>;
  onAssessorClick?: (assessor: AssessorResumo) => void;
}

type SortKey =
  | "time"
  | "nome_assessor"
  | "captacao_entradas"
  | "captacao_saidas"
  | "captacao_liquida"
  | "captacao_entrada_transf"
  | "captacao_saida_transf"
  | "captacao_transf_liquida"
  | "captacao_liquida_total"
  | "captacao_liquida_total_pf"
  | "captacao_liquida_total_pj"
  | "meta_captacao";

const COLUMNS: { key: SortKey; label: string; hideOnMobile?: boolean; emphasize?: boolean }[] = [
  { key: "captacao_entradas", label: "Entradas", hideOnMobile: true },
  { key: "captacao_saidas", label: "Saídas", hideOnMobile: true },
  { key: "captacao_liquida", label: "Líquida", hideOnMobile: true },
  { key: "captacao_entrada_transf", label: "Transf. entrada", hideOnMobile: true },
  { key: "captacao_saida_transf", label: "Transf. saída", hideOnMobile: true },
  { key: "captacao_transf_liquida", label: "Transf. líquida", hideOnMobile: true },
  { key: "captacao_liquida_total", label: "Líquida total", emphasize: true },
  { key: "captacao_liquida_total_pf", label: "PF", hideOnMobile: true },
  { key: "captacao_liquida_total_pj", label: "PJ", hideOnMobile: true },
  { key: "meta_captacao", label: "Meta", hideOnMobile: true },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function moneyClass(value: number, emphasize?: boolean) {
  if (value < 0) return "text-red-400";
  if (emphasize) return "text-euro-gold font-bold";
  return "text-white";
}

export default function FundingAssessorTable({
  data,
  teamPhotos,
  onAssessorClick,
}: FundingAssessorTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: "asc" | "desc" }>({
    key: "captacao_liquida_total",
    direction: "desc",
  });

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 opacity-20 ml-auto" />;
    return sortConfig.direction === "asc"
      ? <ArrowUp className="w-3 h-3 text-euro-navy ml-auto" />
      : <ArrowDown className="w-3 h-3 text-euro-navy ml-auto" />;
  };

  const rows = useMemo(() => {
    const filtered = data.filter((item) => {
      const term = searchTerm.toLowerCase();
      return (
        (item.nome_assessor || "").toLowerCase().includes(term) ||
        (item.cod_assessor || "").toLowerCase().includes(term)
      );
    });

    return [...filtered].sort((a, b) => {
      const { key, direction } = sortConfig;
      const aValue = a[key] ?? (typeof a[key] === "string" ? "" : 0);
      const bValue = b[key] ?? (typeof b[key] === "string" ? "" : 0);

      if (typeof aValue === "string" || typeof bValue === "string") {
        return direction === "asc"
          ? String(aValue).localeCompare(String(bValue))
          : String(bValue).localeCompare(String(aValue));
      }

      return direction === "asc"
        ? Number(aValue) - Number(bValue)
        : Number(bValue) - Number(aValue);
    });
  }, [data, searchTerm, sortConfig]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, curr) => ({
        captacao_entradas: acc.captacao_entradas + (curr.captacao_entradas || 0),
        captacao_saidas: acc.captacao_saidas + (curr.captacao_saidas || 0),
        captacao_liquida: acc.captacao_liquida + (curr.captacao_liquida || 0),
        captacao_entrada_transf: acc.captacao_entrada_transf + (curr.captacao_entrada_transf || 0),
        captacao_saida_transf: acc.captacao_saida_transf + (curr.captacao_saida_transf || 0),
        captacao_transf_liquida: acc.captacao_transf_liquida + (curr.captacao_transf_liquida || 0),
        captacao_liquida_total: acc.captacao_liquida_total + (curr.captacao_liquida_total || 0),
        captacao_liquida_total_pf: acc.captacao_liquida_total_pf + (curr.captacao_liquida_total_pf || 0),
        captacao_liquida_total_pj: acc.captacao_liquida_total_pj + (curr.captacao_liquida_total_pj || 0),
        meta_captacao: acc.meta_captacao + (curr.meta_captacao || 0),
      }),
      {
        captacao_entradas: 0,
        captacao_saidas: 0,
        captacao_liquida: 0,
        captacao_entrada_transf: 0,
        captacao_saida_transf: 0,
        captacao_transf_liquida: 0,
        captacao_liquida_total: 0,
        captacao_liquida_total_pf: 0,
        captacao_liquida_total_pj: 0,
        meta_captacao: 0,
      },
    );
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="relative w-full md:w-80 group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5C5C50] group-focus-within:text-euro-gold transition-colors" />
        <Input
          type="text"
          placeholder="Buscar assessor por nome ou código..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-euro-elevated border-white/5 text-white placeholder:text-[#5C5C50] focus:border-euro-gold/50 transition-all h-10"
        />
      </div>

      <div className="bg-gradient-to-b from-white/[0.08] to-transparent bg-euro-card/60 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden relative">
        <div className="overflow-auto custom-scrollbar relative max-h-[560px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-30">
              <tr className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-widest border-b border-euro-navy/20">
                <th
                  onClick={() => handleSort("time")}
                  className="py-4 px-4 font-bold border-r border-euro-navy/10 sticky left-0 bg-euro-gold z-40 w-[80px] min-w-[80px] max-w-[80px] cursor-pointer hover:bg-euro-gold/80 transition-colors hidden md:table-cell"
                >
                  <div className="flex items-center gap-2">Time <SortIcon column="time" /></div>
                </th>
                <th
                  onClick={() => handleSort("nome_assessor")}
                  className="py-4 px-4 font-bold border-r border-euro-navy/10 sticky left-0 md:left-[80px] bg-euro-gold z-40 min-w-[220px] cursor-pointer hover:bg-euro-gold/80 transition-colors"
                >
                  <div className="flex items-center gap-2">Assessor <SortIcon column="nome_assessor" /></div>
                </th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={cn(
                      "py-4 px-4 font-bold text-right border-r border-euro-navy/5 cursor-pointer hover:bg-euro-gold/80 transition-colors whitespace-nowrap",
                      col.hideOnMobile && "hidden md:table-cell",
                      col.key === "meta_captacao" && "border-r-0",
                    )}
                  >
                    <div className="flex items-center justify-end gap-2">
                      {col.label} <SortIcon column={col.key} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-white/[0.05]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 2} className="py-10 text-center text-white/40 font-data">
                    Nenhum assessor encontrado
                  </td>
                </tr>
              ) : rows.map((item) => {
                const teamKey = (item.time || "").toUpperCase();
                return (
                  <tr
                    key={item.cod_assessor}
                    onClick={() => onAssessorClick?.(item)}
                    className="group even:bg-white/[0.02] hover:bg-euro-gold/10 transition-all cursor-pointer text-xs font-data"
                  >
                    <td className="py-3 px-4 border-r border-white/10 sticky left-0 bg-euro-navy group-hover:bg-[#1e2538] z-10 w-[80px] min-w-[80px] max-w-[80px] hidden md:table-cell">
                      <div className="flex items-center justify-center">
                        {teamPhotos?.has(teamKey) ? (
                          <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden shadow-lg group-hover:border-euro-gold transition-colors bg-black/40 p-1">
                            <img src={teamPhotos.get(teamKey)} alt={item.time} className="w-full h-full object-contain" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-euro-elevated flex items-center justify-center text-[10px] text-euro-gold/40 border border-white/5 group-hover:border-euro-gold">
                            {(item.time || "—").substring(0, 3).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 border-r border-white/10 sticky left-0 md:left-[80px] bg-euro-navy group-hover:bg-[#1e2538] z-10">
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          <div className={cn(
                            "w-10 h-10 rounded-full bg-euro-inset flex items-center justify-center text-xs font-bold text-euro-gold/40 border border-white/10 overflow-hidden group-hover:border-euro-gold transition-colors",
                            item.lider && "border-euro-gold shadow-[0_0_12px_rgba(250,192,23,0.3)]",
                          )}>
                            {item.foto_url ? (
                              <img src={item.foto_url} alt={item.nome_assessor} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-5 h-5 opacity-20" />
                            )}
                          </div>
                          {item.lider && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-euro-gold rounded-full flex items-center justify-center shadow-lg">
                              <Shield className="w-2 h-2 text-euro-navy" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-white font-bold truncate group-hover:text-euro-gold transition-colors uppercase tracking-tight">
                            {item.nome_assessor}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-white/90 font-medium">
                            <span className="font-mono">{item.cod_assessor}</span>
                            {item.cluster && (
                              <>
                                <span className="text-white/40">•</span>
                                <span className="uppercase">{item.cluster}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {COLUMNS.map((col) => {
                      const value = Number(item[col.key] || 0);
                      return (
                        <td
                          key={col.key}
                          className={cn(
                            "py-3 px-4 text-right border-r border-white/5 whitespace-nowrap",
                            col.hideOnMobile && "hidden md:table-cell",
                            col.key === "meta_captacao" && "border-r-0",
                            moneyClass(value, col.emphasize),
                          )}
                        >
                          {formatCurrency(value)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>

            <tfoot className="sticky bottom-0 z-30">
              <tr className="bg-black/80 backdrop-blur-md text-xs font-bold font-data border-t-2 border-euro-gold">
                <td className="py-4 px-4 text-euro-gold uppercase tracking-widest sticky left-0 bg-black/90 z-40 border-r border-white/10 w-[80px] min-w-[80px] max-w-[80px] hidden md:table-cell">
                  Total
                </td>
                <td className="sticky left-0 md:left-[80px] bg-black/90 z-40 border-r border-white/10" />
                {COLUMNS.map((col) => {
                  const value = totals[col.key as keyof typeof totals];
                  return (
                    <td
                      key={col.key}
                      className={cn(
                        "py-4 px-4 text-right border-r border-white/5 bg-black/80 whitespace-nowrap",
                        col.hideOnMobile && "hidden md:table-cell",
                        col.key === "meta_captacao" && "border-r-0",
                        moneyClass(value, col.emphasize),
                      )}
                    >
                      {formatCurrency(value)}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
