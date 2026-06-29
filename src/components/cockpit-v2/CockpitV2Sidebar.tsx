import { BarChart3, CandlestickChart, Gauge, Trophy, Wallet, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SidebarItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const items: SidebarItem[] = [
  { id: "top", label: "Abertura", icon: Gauge },
  { id: "kpis", label: "Indicadores", icon: BarChart3 },
  { id: "funding-focus", label: "Captação", icon: CandlestickChart },
  { id: "performance", label: "Performance", icon: Trophy },
  { id: "revenue", label: "Receita", icon: Wallet },
  { id: "table", label: "Tabela", icon: Table2 },
];

export function CockpitV2Sidebar({
  activeSection,
  onNavigate,
  advisorPhoto,
  advisorName,
  isAssessorFiltered,
}: {
  activeSection: string;
  onNavigate: (id: string) => void;
  advisorPhoto?: string | null;
  advisorName?: string;
  isAssessorFiltered?: boolean;
}) {
  return (
    <aside className="hidden xl:flex sticky top-24 z-40 h-[calc(100vh-7rem)] w-[88px] shrink-0 flex-col items-center justify-between rounded-[28px] border border-white/10 bg-[#0A1019] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.4)]">
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-euro-gold/30 bg-euro-gold/10 shadow-[0_0_30px_rgba(250,192,23,0.15)]">
        {isAssessorFiltered && advisorPhoto ? (
          <img src={advisorPhoto} alt={advisorName || "Assessor"} className="h-full w-full object-cover" />
        ) : (
          <span className="font-display text-xl text-euro-gold">
            {isAssessorFiltered && advisorName ? advisorName.charAt(0).toUpperCase() : "M"}
          </span>
        )}
      </div>

      <nav className="flex flex-1 flex-col items-center justify-center gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={cn(
                "group relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl border transition-all duration-300",
                isActive
                  ? "border-euro-gold/40 bg-euro-gold/15 text-euro-gold shadow-[0_0_30px_rgba(250,192,23,0.14)]"
                  : "border-white/5 bg-white/[0.03] text-white/45 hover:border-white/15 hover:bg-white/[0.06] hover:text-white"
              )}
              aria-label={item.label}
              title={item.label}
            >
              <Icon className="h-5 w-5" />
              <span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-[80] hidden -translate-y-1/2 whitespace-nowrap rounded-full border border-white/10 bg-[#101826] px-3 py-1 text-[10px] font-data uppercase tracking-[0.18em] text-white/65 shadow-xl group-hover:block">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="text-[10px] font-data uppercase tracking-[0.24em] text-white/25 [writing-mode:vertical-rl] rotate-180">
        meu cockpit
      </div>
    </aside>
  );
}
