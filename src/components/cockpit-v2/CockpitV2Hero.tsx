import { CalendarDays, Medal, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type HeroData = {
  assessorName: string;
  assessorCode: string;
  teamName: string;
  photo?: string | null;
  monthLabel: string;
};

type RankingSummary = {
  position: number;
  points: number;
  totalAssessors: number;
} | null;

export function CockpitV2Hero({ hero, rankingSummary, selectedYear }: { hero: HeroData; rankingSummary: RankingSummary; selectedYear: string }) {
  return (
    <section id="hero" className="grid grid-cols-1 gap-6 lg:grid-cols-12 scroll-mt-28">
      <div className="lg:col-span-4 overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(250,192,23,0.12),_transparent_38%),linear-gradient(180deg,#121826_0%,#0A1019_100%)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex items-start gap-5">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-euro-gold/40 bg-white/5 shadow-[0_0_30px_rgba(250,192,23,0.18)]">
            {hero.photo ? (
              <img src={hero.photo} alt={hero.assessorName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-3xl text-euro-gold">
                {hero.assessorName.charAt(0)}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Badge className="border border-white/10 bg-white/5 text-[10px] uppercase tracking-[0.22em] text-white/55">
              Meu cockpit
            </Badge>
            <div>
              <h1 className="font-display text-3xl uppercase tracking-[0.12em] text-white">{hero.assessorName}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-data uppercase tracking-[0.18em] text-white/45">
                <span>{hero.assessorCode}</span>
                <span className="text-white/20">•</span>
                <span>{hero.teamName}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-white/60">
              <CalendarDays className="h-4 w-4 text-euro-gold" />
              <span className="capitalize">{hero.monthLabel}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-8 overflow-hidden rounded-[30px] border border-euro-gold/20 bg-[radial-gradient(circle_at_top_right,_rgba(250,192,23,0.12),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(59,130,246,0.14),_transparent_32%),linear-gradient(180deg,#101724_0%,#0A1019_100%)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-data uppercase tracking-[0.24em] text-white/40">
              <Medal className="h-4 w-4 text-euro-gold" />
              Super Ranking • {selectedYear}
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-white/60">
              Uma leitura única para acompanhar a régua do assessor, enxergar os vetores de receita e antecipar o fechamento do mês.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
            {rankingSummary ? (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-[10px] font-data uppercase tracking-[0.22em] text-white/35">Posição</div>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="font-display text-5xl text-euro-gold">#{rankingSummary.position}</span>
                    <span className="pb-2 text-[11px] font-data uppercase tracking-[0.18em] text-white/35">/ {rankingSummary.totalAssessors}</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-data uppercase tracking-[0.22em] text-white/35">Pontuação</div>
                  <div className="mt-2 flex items-end gap-3">
                    <span className="font-display text-4xl text-white">{rankingSummary.points.toLocaleString("pt-BR")}</span>
                    <Trophy className="mb-2 h-5 w-5 text-euro-gold" />
                  </div>
                  <div className="mt-1 text-[11px] font-data uppercase tracking-[0.18em] text-white/35">Pts acumulados</div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-[10px] font-data uppercase tracking-[0.22em] text-white/35">Super Ranking</div>
                <div className="font-display text-2xl text-white">Selecione um assessor</div>
                <div className="text-sm text-white/45">O ranking detalhado aparece quando a visão está filtrada em um assessor específico.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
