import React from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/PageLayout";
import { ImpactfulBackground } from "@/components/dashboard/ImpactfulBackground";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Briefcase, ShoppingBag, ArrowRight, Settings, User, TrendingUp, CalendarCheck, BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useReducedMotion } from "framer-motion";

export default function DashboardHome() {
  const navigate = useNavigate();
  const { userRole, userCode } = useAuth();
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const [showBackground, setShowBackground] = React.useState(false);
  
  const isMarketing = userRole === "marketing";
  const isProdutosOnly = userRole === "produtos";
  const isAdminOrMaster = userRole === "admin" || userRole === "admin_master";
  const isRegularUser = userRole === "user" || userRole === "lider" || userRole === "consorcio" || userRole === "seguros";
  const canAccessAdvisors = isAdminOrMaster || userCode === "A39869";
  const enableBackground = showBackground && !isMobile && !reduceMotion;

  React.useEffect(() => {
    const id = window.setTimeout(() => setShowBackground(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <PageLayout className="bg-transparent text-[#E8E8E0] font-ui px-8 pb-8 selection:bg-euro-gold/30 custom-scrollbar relative min-h-screen flex flex-col items-center justify-center">
      {enableBackground ? (
        <ImpactfulBackground opacity={0.4} />
      ) : (
        <div className="fixed inset-0 z-[-1] overflow-hidden bg-euro-navy pointer-events-none select-none" />
      )}
      
      <div className="relative z-10 w-full max-w-5xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-display text-white tracking-tight">
            Bem-vindo ao <span className="text-euro-gold">EuroDash</span>
          </h1>
          <p className="text-lg text-[#A0A090] font-light max-w-2xl mx-auto">
            Selecione a vertente que deseja visualizar para acessar os indicadores de performance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-4">
          {/* Card Comercial */}
          {(!isMarketing && !isProdutosOnly && userRole !== "consorcio" && userRole !== "seguros") && (
            <div 
              onClick={() => navigate("/dash/comercial")}
              className="cursor-pointer"
            >
              <Card className="h-[340px] bg-gradient-to-br from-white/[0.08] to-transparent bg-euro-card/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden">
                <CardContent className="h-full flex flex-col items-center p-8 pt-10 relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-euro-gold/5 to-transparent" />
                  
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-euro-gold to-[#B8860B] flex items-center justify-center mb-6 shadow-lg shrink-0">
                    <Briefcase className="w-10 h-10 text-white" />
                  </div>
                  
                  <h2 className="text-3xl font-display text-white mb-3 tracking-wide">
                    Comercial
                  </h2>
                  
                  <p className="text-[#A0A090] text-center font-light mb-auto max-w-xs line-clamp-3 min-h-[4.5rem]">
                    Acompanhe métricas de receita, captação, ROA e performance dos assessores.
                  </p>
                  
                  <div className="flex items-center gap-2 text-euro-gold font-data text-xs uppercase tracking-widest mt-4">
                    Acessar Dashboard <ArrowRight className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Card Advisors — visível apenas para admin_master */}
          {canAccessAdvisors && (
            <div 
              onClick={() => navigate("/dash/advisors")}
              className="cursor-pointer"
            >
              <Card className="h-[340px] bg-gradient-to-br from-white/[0.08] to-transparent bg-euro-card/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden">
                <CardContent className="h-full flex flex-col items-center p-8 pt-10 relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-euro-gold/5 to-transparent" />
                  
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-euro-gold to-[#B8860B] flex items-center justify-center mb-6 shadow-lg shrink-0">
                    <TrendingUp className="w-10 h-10 text-white" />
                  </div>
                  
                  <h2 className="text-3xl font-display text-white mb-3 tracking-wide">
                    Advisors
                  </h2>
                  
                  <p className="text-[#A0A090] text-center font-light mb-auto max-w-xs line-clamp-3 min-h-[4.5rem]">
                    Dashboard exclusivo para o time de Advisors com indicadores de performance.
                  </p>
                  
                  <div className="flex items-center gap-2 text-euro-gold font-data text-xs uppercase tracking-widest mt-4">
                    Acessar Dash Advisors <ArrowRight className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Card Meu Cockpit */}
          {(!isMarketing && !isProdutosOnly && userRole !== "consorcio" && userRole !== "seguros") && (
            <div
              onClick={() => navigate("/dash/meu-cockpit")}
              className="cursor-pointer"
            >
              <Card className="h-[340px] bg-gradient-to-br from-white/[0.08] to-transparent bg-euro-card/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden">
                <CardContent className="h-full flex flex-col items-center p-8 pt-10 relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-euro-gold/10 via-cyan-400/5 to-transparent" />

                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center mb-6 shadow-lg shrink-0">
                    <User className="w-10 h-10 text-white" />
                  </div>

                  <h2 className="text-3xl font-display text-white mb-3 tracking-wide">
                    Meu Cockpit
                  </h2>

                  <p className="text-[#A0A090] text-center font-light mb-auto max-w-xs line-clamp-3 min-h-[4.5rem]">
                    Sua performance individual, receitas, gap e posição no Super Ranking.
                  </p>

                  <div className="flex items-center gap-2 text-blue-400 font-data text-xs uppercase tracking-widest mt-4">
                    Acessar Meu Cockpit <ArrowRight className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Card Gerencial */}
          {(!isMarketing && !isRegularUser && !isProdutosOnly) && (
            <div 
              onClick={() => navigate("/dash/gerencial")}
              className="cursor-pointer"
            >
              <Card className="h-[340px] bg-gradient-to-br from-white/[0.08] to-transparent bg-euro-card/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden">
                <CardContent className="h-full flex flex-col items-center p-8 pt-10 relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-euro-gold/5 to-transparent" />
                  
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#A0A090] to-[#5C5C50] flex items-center justify-center mb-6 shadow-lg shrink-0">
                    <Settings className="w-10 h-10 text-white" />
                  </div>
                  
                  <h2 className="text-3xl font-display text-white mb-3 tracking-wide">
                    Gerencial
                  </h2>
                  
                  <p className="text-[#A0A090] text-center font-light mb-auto max-w-xs line-clamp-3 min-h-[4.5rem]">
                    Cockpit de metas, projeções em tempo real e análises executivas.
                  </p>
                  
                  <div className="flex items-center gap-2 text-euro-gold font-data text-xs uppercase tracking-widest mt-4">
                    Acessar Gerencial <ArrowRight className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Card Produtos */}
          {(!isMarketing) && (
            <div 
              onClick={() => navigate("/dash/produtos")}
              className="cursor-pointer"
            >
              <Card className="h-[340px] bg-gradient-to-br from-white/[0.08] to-transparent bg-euro-card/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden">
                <CardContent className="h-full flex flex-col items-center p-8 pt-10 relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-[#4ADE80]/5 to-transparent" />
                  
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#4ADE80] to-[#22C55E] flex items-center justify-center mb-6 shadow-lg shrink-0">
                    <ShoppingBag className="w-10 h-10 text-white" />
                  </div>
                  
                  <h2 className="text-3xl font-display text-white mb-3 tracking-wide">
                    Produtos
                  </h2>
                  
                  <p className="text-[#A0A090] text-center font-light mb-auto max-w-xs line-clamp-3 min-h-[4.5rem]">
                    Renda Fixa, Variável, Consórcios, Seguros e Posição Black.
                  </p>
                  
                  <div className="flex items-center gap-2 text-[#4ADE80] font-data text-xs uppercase tracking-widest mt-4">
                    Acessar Produtos <ArrowRight className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Card Marketing */}
          {(!isRegularUser && !isProdutosOnly && userRole !== "seguros") && (
            <div 
              onClick={() => navigate("/dash/marketing")}
              className="cursor-pointer"
            >
            <Card className="h-[340px] bg-gradient-to-br from-white/[0.08] to-transparent bg-euro-card/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden">
              <CardContent className="h-full flex flex-col items-center p-8 pt-10 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-[#A855F7]/5 to-transparent" />
                
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#A855F7] to-[#7C3AED] flex items-center justify-center mb-6 shadow-lg shrink-0">
                  <BarChart3 className="w-10 h-10 text-white" />
                </div>
                
                <h2 className="text-3xl font-display text-white mb-3 tracking-wide">
                  Marketing
                </h2>
                
                <p className="text-[#A0A090] text-center font-light mb-auto max-w-xs line-clamp-3 min-h-[4.5rem]">
                  Análise de performance de tráfego pago, campanhas e gestão de leads e custos.
                </p>
                
                <div className="flex items-center gap-2 text-[#A855F7] font-data text-xs uppercase tracking-widest mt-4">
                  Acessar Marketing <ArrowRight className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
          </div>
          )}

          {/* Card Esforço Semanal */}
          <div 
            onClick={() => navigate("/dash/esforco-semanal")}
            className="cursor-pointer"
          >
            <Card className="h-[340px] bg-gradient-to-br from-white/[0.08] to-transparent bg-euro-card/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden">
              <CardContent className="h-full flex flex-col items-center p-8 pt-10 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-[#06B6D4]/5 to-transparent" />
                
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#06B6D4] to-[#0891B2] flex items-center justify-center mb-6 shadow-lg shrink-0">
                  <CalendarCheck className="w-10 h-10 text-white" />
                </div>
                
                <h2 className="text-3xl font-display text-white mb-3 tracking-wide text-center leading-tight">
                  Esforços
                </h2>
                
                <p className="text-[#A0A090] text-center font-light mb-auto max-w-xs line-clamp-3 min-h-[4.5rem]">
                  Acompanhamento de reuniões de diagnóstico (R1).
                </p>
                
                <div className="flex items-center gap-2 text-[#06B6D4] font-data text-xs uppercase tracking-widest mt-4">
                  Acessar Esforços <ArrowRight className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
