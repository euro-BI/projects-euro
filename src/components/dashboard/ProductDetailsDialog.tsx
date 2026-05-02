import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AssessorResumo } from "@/types/dashboard";
import { ArrowUpDown, ArrowUp, ArrowDown, User, Shield, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const formatCurrency = (value: number) => {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export interface ProductDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  product: { key: string; label: string; fields: string[]; roa: number } | null;
  data: AssessorResumo[];
  getPaceValue: (value: number) => number;
  getProportionalTarget: (target: number) => number;
}

export function ProductDetailsDialog({
  isOpen,
  onClose,
  product,
  data,
  getPaceValue,
  getProportionalTarget
}: ProductDetailsDialogProps) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'gap',
    direction: 'asc'
  });

  const { data: teamPhotos } = useQuery({
    queryKey: ["dados_times_photos"],
    queryFn: async () => {
      const { data } = await supabase.from("dados_times").select("time, foto_url");
      const map = new Map<string, string>();
      if (data) {
        data.forEach((t: any) => {
          if (t.time && t.foto_url) map.set(t.time.toUpperCase(), t.foto_url);
        });
      }
      return map;
    },
    staleTime: Infinity,
  });

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="w-3 h-3 opacity-20 ml-auto" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-euro-gold ml-auto" /> 
      : <ArrowDown className="w-3 h-3 text-euro-gold ml-auto" />;
  };

  const tableData = useMemo(() => {
    if (!product) return [];

    const mapped = data.map(assessor => {
      let rawRealized = 0;
      product.fields.forEach(field => {
        rawRealized += (assessor as any)[field] || 0;
      });

      const realized = getPaceValue(rawRealized);
      const rawTarget = (assessor.custodia_net * product.roa) / 12;
      const target = getProportionalTarget(rawTarget);
      const gap = target - realized;

      return {
        ...assessor,
        realized,
        target,
        gap
      };
    });

    return mapped.sort((a, b) => {
      const { key, direction } = sortConfig;
      let aValue: any = a[key as keyof typeof a];
      let bValue: any = b[key as keyof typeof b];

      if (aValue === null || aValue === undefined) aValue = "";
      if (bValue === null || bValue === undefined) bValue = "";

      if (typeof aValue === 'string') {
        return direction === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
      
      return direction === 'asc' 
        ? (aValue > bValue ? 1 : -1) 
        : (bValue > aValue ? 1 : -1);
    });
  }, [data, product, sortConfig, getPaceValue, getProportionalTarget]);

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="bg-[#0A0A0B] border-euro-gold/20 text-white sm:max-w-[1000px] p-0 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col h-[80vh]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-euro-gold/10 via-transparent to-transparent pointer-events-none" />
        
        <DialogHeader className="p-6 pb-4 border-b border-white/5 bg-white/5 flex-shrink-0">
          <DialogTitle className="text-euro-gold font-display text-xl tracking-wide flex items-center gap-3">
            <Target className="w-5 h-5 text-euro-gold" />
            Detalhamento por Assessor: {product.label}
          </DialogTitle>
          <DialogDescription className="text-white/60 font-data text-xs uppercase tracking-wider">
            Receita Realizada vs Meta ROA ({((product.roa * 100).toFixed(4))}%)
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto custom-scrollbar relative">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-30">
              <tr className="bg-[#0A0A0B] text-euro-gold text-[10px] font-data uppercase tracking-widest border-b border-white/10 shadow-md">
                <th 
                  onClick={() => handleSort('time')}
                  className="py-4 px-4 font-bold border-r border-white/5 cursor-pointer hover:bg-white/5 transition-colors sticky left-0 z-40 bg-[#0A0A0B] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]"
                >
                  <div className="flex items-center gap-2">Time <SortIcon column="time" /></div>
                </th>
                <th 
                  onClick={() => handleSort('nome_assessor')}
                  className="py-4 px-4 font-bold border-r border-white/5 cursor-pointer hover:bg-white/5 transition-colors sticky left-[80px] z-40 bg-[#0A0A0B] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]"
                >
                  <div className="flex items-center gap-2">Assessor <SortIcon column="nome_assessor" /></div>
                </th>
                <th 
                  onClick={() => handleSort('custodia_net')}
                  className="py-4 px-4 font-bold text-right border-r border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center justify-end gap-2">Net/Clientes <SortIcon column="custodia_net" /></div>
                </th>
                <th 
                  onClick={() => handleSort('target')}
                  className="py-4 px-4 font-bold text-right border-r border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center justify-end gap-2">Meta ROA <SortIcon column="target" /></div>
                </th>
                <th 
                  onClick={() => handleSort('realized')}
                  className="py-4 px-4 font-bold text-right border-r border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center justify-end gap-2">Realizado <SortIcon column="realized" /></div>
                </th>
                <th 
                  onClick={() => handleSort('gap')}
                  className="py-4 px-4 font-bold text-right cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center justify-end gap-2">Gap <SortIcon column="gap" /></div>
                </th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-white/[0.05]">
              {tableData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-white/50 font-data">
                    Nenhum dado encontrado.
                  </td>
                </tr>
              ) : tableData.map((item) => (
                <tr 
                  key={item.cod_assessor}
                  className="group even:bg-white/[0.02] hover:bg-white/[0.05] transition-all text-xs font-data"
                >
                  <td className="py-3 px-4 border-r border-white/5 sticky left-0 z-10 bg-[#0A0A0B] group-even:bg-[#0c0d10] group-hover:bg-[#15161a] w-[80px] min-w-[80px] max-w-[80px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                    {teamPhotos?.has(item.time.toUpperCase()) ? (
                      <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden shadow-lg group-hover:border-euro-gold transition-colors bg-black/40 p-1 mx-auto">
                        <img 
                          src={teamPhotos.get(item.time.toUpperCase())} 
                          alt={item.time} 
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-euro-elevated flex items-center justify-center text-[10px] text-euro-gold/40 border border-white/5 group-hover:border-euro-gold/50 mx-auto">
                        {item.time.substring(0, 3).toUpperCase()}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 border-r border-white/5 sticky left-[80px] z-10 bg-[#0A0A0B] group-even:bg-[#0c0d10] group-hover:bg-[#15161a] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <div className={cn(
                          "w-10 h-10 rounded-full bg-euro-inset flex items-center justify-center text-xs font-bold text-euro-gold/40 border border-white/10 overflow-hidden group-hover:border-euro-gold/50 transition-colors",
                          item.lider && "border-euro-gold shadow-[0_0_12px_rgba(250,192,23,0.3)]"
                        )}>
                          {item.foto_url ? (
                            <img src={item.foto_url} alt={item.nome_assessor} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-5 h-5 opacity-20" />
                          )}
                        </div>
                        {item.lider && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-euro-gold rounded-full flex items-center justify-center shadow-lg">
                            <Shield className="w-2 h-2 text-[#0A0A0B]" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-white font-bold truncate group-hover:text-euro-gold transition-colors uppercase tracking-tight">
                          {item.nome_assessor}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-white/50 font-medium">
                          <span className="font-mono">{item.cod_assessor}</span>
                          <span>•</span>
                          <span className="uppercase">{item.cluster}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right border-r border-white/5">
                    <div className="flex flex-col">
                      <span className="text-white">{formatCurrency(item.custodia_net)}</span>
                      <span className="text-[10px] text-white/40">({item.total_clientes})</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right border-r border-white/5 text-euro-gold font-bold">
                    {formatCurrency(item.target)}
                  </td>
                  <td className="py-3 px-4 text-right border-r border-white/5 text-white font-bold">
                    {formatCurrency(item.realized)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={cn("font-bold", item.gap > 0 ? "text-red-400" : "text-green-400")}>
                      {item.gap > 0 ? "-" : "+"}{formatCurrency(Math.abs(item.gap))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
