import React, { useMemo, useState } from "react";
import { Briefcase, Building2, ChevronLeft, Layers3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import ConsorciosDash, { DANIEL_CONSORCIO_USER_ID } from "@/components/dashboard/ConsorciosDash";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const BERTE_CONSORCIO_USER_ID = "18c768b8-0100-4e26-afab-81df3fc27205";

type ConsorcioView = "legacy" | "owned";

interface ConsorciosHubProps {
  selectedMonth: string;
  selectedYear: string;
  selectedTeam: string[];
  selectedAssessorId: string[];
  teamPhotos?: Map<string, string>;
}

function resolveForcedView(userId: string | undefined | null): ConsorcioView | null {
  if (!userId) return null;
  if (userId === BERTE_CONSORCIO_USER_ID) return "legacy";
  if (userId === DANIEL_CONSORCIO_USER_ID) return "owned";
  return null;
}

export default function ConsorciosHub({
  selectedMonth,
  selectedYear,
  selectedTeam,
  selectedAssessorId,
  teamPhotos,
}: ConsorciosHubProps) {
  const { user } = useAuth();
  const forcedView = useMemo(() => resolveForcedView(user?.id), [user?.id]);
  const [pickedView, setPickedView] = useState<ConsorcioView | null>(null);

  const activeView = forcedView ?? pickedView;

  if (activeView) {
    return (
      <div className="space-y-4">
        {!forcedView && (
          <div className="flex justify-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPickedView(null)}
              className="glass border-white/20 hover:border-euro-gold/50 hover:bg-euro-gold/10 text-[#A0A090] hover:text-euro-gold h-8"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Trocar visão
            </Button>
          </div>
        )}
        <ConsorciosDash
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          selectedTeam={selectedTeam}
          selectedAssessorId={selectedAssessorId}
          teamPhotos={teamPhotos}
          ownerMode={activeView}
          ownerUserId={activeView === "owned" ? DANIEL_CONSORCIO_USER_ID : undefined}
          showHabilitacaoAtivacao={activeView === "legacy"}
          title="Consórcios"
          subtitle=""
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-display text-white tracking-wide flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-euro-gold/20 flex items-center justify-center border border-euro-gold/30">
              <Briefcase className="w-6 h-6 text-euro-gold" />
            </span>
            Consórcios
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
        <button
          type="button"
          onClick={() => setPickedView("legacy")}
          className={cn(
            "text-left rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-transparent",
            "p-6 transition-all hover:border-euro-gold/40 hover:bg-euro-gold/5 group",
          )}
        >
          <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:border-euro-gold/30">
            <Building2 className="w-5 h-5 text-euro-gold" />
          </div>
          <h3 className="text-white font-display text-xl tracking-wide">Visão Legado (Berté)</h3>
          <p className="text-white/45 text-sm mt-2 leading-relaxed">
            Carteira histórica e acompanhamento de habilitações/ativações PJ.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setPickedView("owned")}
          className={cn(
            "text-left rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-transparent",
            "p-6 transition-all hover:border-euro-gold/40 hover:bg-euro-gold/5 group",
          )}
        >
          <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:border-euro-gold/30">
            <Layers3 className="w-5 h-5 text-euro-gold" />
          </div>
          <h3 className="text-white font-display text-xl tracking-wide">Visão Atual (Daniel)</h3>
          <p className="text-white/45 text-sm mt-2 leading-relaxed">
            Vendas com responsável registrado. Sem habilitações e ativações PJ.
          </p>
        </button>
      </div>
    </div>
  );
}
