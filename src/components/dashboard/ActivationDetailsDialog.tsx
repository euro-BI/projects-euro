import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Target, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingOverlay } from "@/components/dashboard/LoadingOverlay";
import { cn } from "@/lib/utils";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);
};

interface ActivationDetailsProps {
  children: React.ReactNode;
  selectedMonth: string;
  assessorId: string;
  team: string;
}

export function ActivationDetailsDialog({ children, selectedMonth, assessorId, team }: ActivationDetailsProps) {
  const { data: details, isLoading } = useQuery({
    queryKey: ["activation-details", selectedMonth, assessorId, team],
    queryFn: async () => {
      let query = supabase
        .from("detalhamento_ativacoes" as any)
        .select("*")
        .eq("data_posicao", selectedMonth);

      if (assessorId !== "all") {
        query = query.eq("cod_assessor", assessorId.startsWith("A") ? assessorId : `A${assessorId}`);
      } else if (team !== "all") {
        query = query.eq("time", team);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching activation details:", error);
        return [];
      }
      return data as any[];
    },
    enabled: !!selectedMonth,
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="bg-[#0a0e14] border-white/10 text-[#E8E8E0] max-w-3xl p-0 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <DialogHeader className="p-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-euro-gold/20 flex items-center justify-center border border-euro-gold/40 shadow-[0_0_20px_rgba(250,192,23,0.1)]">
              <Target className="w-5 h-5 text-euro-gold" />
            </div>
            <DialogTitle className="text-2xl font-display text-euro-gold tracking-tight">
              Detalhamento de Ativações 300k+
            </DialogTitle>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="p-6">
            <div className="bg-euro-card/40 border border-white/10 rounded-xl overflow-hidden shadow-2xl relative">
              {isLoading && <LoadingOverlay isLoading={true} />}
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-euro-gold text-euro-navy text-[10px] font-data uppercase tracking-widest">
                    <th className="py-3 px-4 font-bold border-r border-euro-navy/10">Cliente</th>
                    <th className="py-3 px-4 font-bold text-right border-r border-euro-navy/10">Net Original</th>
                    <th className="py-3 px-4 font-bold text-right">Vlr Ativação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {details && details.length > 0 ? (
                    details.map((item, idx) => (
                      <tr
                        key={idx}
                        className="group even:bg-white/[0.02] hover:bg-white/[0.05] transition-all text-[12.6px] font-data"
                      >
                        <td className="py-3 px-4 border-r border-white/5">
                          <span className="font-bold uppercase tracking-tight text-white">
                            {item.cliente || "N/A"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-white border-r border-white/5">
                          {formatCurrency(parseFloat(String(item.net_original_texto || "0").replace(",", ".")) || 0)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-euro-gold">
                          {formatCurrency(item.valor_ativacao_final || 0)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-20 text-center opacity-20">
                        <div className="flex flex-col items-center gap-4">
                          <Search className="w-10 h-10" />
                          <p className="text-sm font-data uppercase tracking-widest">Nenhuma ativação encontrada</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
