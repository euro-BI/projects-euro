import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowUpRight,
  BrainCircuit,
  Database,
  FileSpreadsheet,
  MessageSquare,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/PageLayout";
import { HubAtmosphere } from "@/components/home/HubAtmosphere";
import { cn } from "@/lib/utils";
import { isAdvisorsOnlyUser } from "@/lib/access";

type HubRole =
  | "admin_master"
  | "admin"
  | "user"
  | "lider"
  | "consorcio"
  | "marketing"
  | "produtos"
  | "seguros";

interface HubModule {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  roles: HubRole[];
  featuredFor?: HubRole[];
}

const LOGO_URL =
  "https://rzdepoejfchewvjzojan.supabase.co/storage/v1/object/public/fotos/fotos/fotos-escudos/logo_.png";

const MODULES: HubModule[] = [
  {
    id: "intelligence",
    title: "Euro Intelligence",
    description: "Performance comercial, produtos e ranking dos assessores.",
    href: "/dash",
    icon: BrainCircuit,
    roles: ["admin_master", "admin", "marketing", "user", "lider", "consorcio", "produtos", "seguros"],
    featuredFor: ["admin_master", "admin", "marketing", "produtos", "user", "lider"],
  },
  {
    id: "chat",
    title: "IA Chat",
    description: "Pergunte sobre números, carteira e operação.",
    href: "/chat",
    icon: MessageSquare,
    roles: ["admin_master", "admin", "user", "lider"],
  },
  {
    id: "consorcios",
    title: "Consórcios",
    description: "Vendas, comissões e administradoras.",
    href: "/consorcios",
    icon: FileSpreadsheet,
    roles: ["admin_master", "consorcio"],
    featuredFor: ["consorcio"],
  },
  {
    id: "seguros",
    title: "Seguros",
    description: "Produção e acompanhamento da carteira.",
    href: "/seguros",
    icon: ShieldCheck,
    roles: ["admin_master", "seguros"],
    featuredFor: ["seguros"],
  },
  {
    id: "bi",
    title: "Atualizações",
    description: "Status das cargas que alimentam o BI.",
    href: "/atualizacao",
    icon: Database,
    roles: ["admin_master"],
  },
  {
    id: "users",
    title: "Usuários",
    description: "Acessos, perfis e permissões.",
    href: "/users",
    icon: Users,
    roles: ["admin_master"],
  },
];

function greetingForHour(hour: number) {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function cardClass(isFeatured: boolean, total: number) {
  if (total === 1) return "min-h-[220px] md:col-span-6 md:min-h-0";
  if (total === 2) return isFeatured ? "min-h-[220px] md:col-span-4 md:row-span-2 md:min-h-0" : "min-h-[220px] md:col-span-2 md:row-span-2 md:min-h-0";
  if (isFeatured) return "min-h-[240px] md:col-span-4 md:row-span-2 md:min-h-0";
  return "min-h-[160px] md:col-span-2 md:min-h-0";
}

export default function Welcome() {
  const { user, userRole, userCode } = useAuth();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());

  const visibleModules = useMemo(
    () => MODULES.filter((module) => module.roles.includes((userRole || "") as HubRole)),
    [userRole],
  );

  const orderedModules = useMemo(() => {
    const featured =
      visibleModules.find((module) => module.featuredFor?.includes((userRole || "") as HubRole)) ||
      visibleModules[0];
    if (!featured) return [];
    return [featured, ...visibleModules.filter((module) => module.id !== featured.id)];
  }, [userRole, visibleModules]);

  const { data: profile } = useQuery({
    queryKey: ["hub-home-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects_profiles")
        .select("first_name, last_name, profile_image_url")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (isAdvisorsOnlyUser(userCode) || userRole === "user" || userRole === "lider" || userRole === "admin") {
      navigate("/dash", { replace: true });
    }
  }, [navigate, userCode, userRole]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const firstName = profile?.first_name?.trim();
  const heading = firstName
    ? `${greetingForHour(now.getHours())}, ${firstName}`
    : greetingForHour(now.getHours());

  if (isAdvisorsOnlyUser(userCode) || userRole === "user" || userRole === "lider" || userRole === "admin") {
    return null;
  }

  return (
    <PageLayout className="relative overflow-hidden bg-transparent font-ui text-[#F4F1E8] selection:bg-euro-gold/30">
      <HubAtmosphere />

      <div className="relative z-10 flex min-h-[calc(100vh-4rem)] w-full flex-col px-5 py-6 sm:px-8 lg:px-10 xl:px-12">
        <header className="mb-6 shrink-0 sm:mb-8">
          <div className="flex items-center gap-4">
            {profile?.profile_image_url ? (
              <img
                src={profile.profile_image_url}
                alt=""
                className="h-14 w-14 rounded-2xl object-cover object-top ring-1 ring-white/10"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-euro-gold/15 text-lg font-semibold text-euro-gold ring-1 ring-euro-gold/20">
                {(firstName || "E").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm text-white/45">
                {format(now, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
              <h1 className="text-[1.85rem] font-semibold leading-tight tracking-tight sm:text-4xl">
                {heading}
              </h1>
            </div>
          </div>
        </header>

        <section className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-6 md:grid-rows-3">
          {orderedModules.map((module, index) => {
            const featured = index === 0;
            return (
              <ModuleCard
                key={module.id}
                module={module}
                featured={featured}
                className={cardClass(featured, orderedModules.length)}
                onOpen={() => navigate(module.href)}
              />
            );
          })}
        </section>
      </div>
    </PageLayout>
  );
}

function ModuleCard({
  module,
  featured,
  className,
  onOpen,
}: {
  module: HubModule;
  featured: boolean;
  className: string;
  onOpen: () => void;
}) {
  const Icon = module.icon;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group relative col-span-1 h-full overflow-hidden rounded-[28px] border border-white/10 bg-[#12141A] text-left",
        "shadow-[0_20px_50px_-28px_rgba(0,0,0,0.85)]",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-1 hover:border-euro-gold/35 hover:shadow-[0_24px_60px_-24px_rgba(250,192,23,0.28)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-euro-gold/50",
        "active:translate-y-0 active:scale-[0.99]",
        featured && "bg-[radial-gradient(120%_90%_at_100%_-10%,rgba(250,192,23,0.18),transparent_50%)]",
        className,
      )}
    >
      <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

      {featured && (
        <img
          src={LOGO_URL}
          alt=""
          className="pointer-events-none absolute -bottom-8 -right-8 h-56 w-56 opacity-[0.07] transition-transform duration-500 group-hover:scale-105 group-hover:opacity-[0.12]"
        />
      )}

      <div className={cn("relative flex h-full flex-col", featured ? "justify-between p-7 sm:p-8" : "p-5 sm:p-6")}>
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              "flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-euro-gold",
              featured ? "h-12 w-12" : "h-10 w-10",
            )}
          >
            <Icon className={featured ? "h-5 w-5" : "h-4 w-4"} strokeWidth={1.75} />
          </span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/35 transition-all duration-300 group-hover:border-euro-gold/40 group-hover:bg-euro-gold group-hover:text-euro-navy">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>

        <div className={cn(featured ? "mt-10" : "mt-auto pt-8")}>
          <h2 className={cn("font-semibold tracking-tight text-white", featured ? "text-3xl sm:text-4xl" : "text-lg")}>
            {module.title}
          </h2>
          <p className={cn("text-white/45", featured ? "mt-3 max-w-2xl text-base" : "mt-1.5 line-clamp-2 text-sm")}>
            {module.description}
          </p>
        </div>
      </div>
    </button>
  );
}
