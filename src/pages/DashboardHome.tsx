import React from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/PageLayout";
import { ImpactfulBackground } from "@/components/dashboard/ImpactfulBackground";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Briefcase, ShoppingBag, ArrowRight, Settings, BarChart3, User, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardHome() {
  const navigate = useNavigate();
  const { userRole, userCode } = useAuth();
  
  const isMarketing = userRole === "marketing";
  const isProdutosOnly = userRole === "produtos";
  const isAdminOrMaster = userRole === "admin" || userRole === "admin_master";
  const isRegularUser = userRole === "user" || userRole === "lider" || userRole === "consorcio" || userRole === "seguros";
  const canAccessAdvisors = isAdminOrMaster || userCode === "A39869";

  return (
    <PageLayout className="bg-transparent text-[#E8E8E0] font-ui px-8 pb-8 selection:bg-euro-gold/30 custom-scrollbar relative min-h-screen flex flex-col items-center justify-center">
      <ImpactfulBackground opacity={0.4} />
      
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
              className="group cursor-pointer"
            >
              <Card className="h-[340px] bg-gradient-to-br from-white/[0.08] to-transparent bg-euro-card/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:border-euro-gold/50 hover:shadow-[0_0_30px_rgba(250,192,23,0.15)] group-hover:bg-white/[0.12]">
                <CardContent className="h-full flex flex-col items-center p-8 pt-10 relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-euro-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-euro-gold to-[#B8860B] flex items-center justify-center mb-6 shadow-lg transform transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110 shrink-0">
                    <Briefcase className="w-10 h-10 text-white" />
                  </div>
                  
                  <h2 className="text-3xl font-display text-white mb-3 tracking-wide group-hover:text-euro-gold transition-colors">
                    Comercial
                  </h2>
                  
                  <p className="text-[#A0A090] text-center font-light mb-auto max-w-xs group-hover:text-white/80 transition-colors line-clamp-3 min-h-[4.5rem]">
                    Acompanhe métricas de receita, captação, ROA e performance dos assessores.
                  </p>
                  
                  <div className="flex items-center gap-2 text-euro-gold font-data text-xs uppercase tracking-widest opacity-0 transform translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 mt-4">
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
              className="group cursor-pointer"
            >
              <Card className="h-[340px] bg-gradient-to-br from-white/[0.08] to-transparent bg-euro-card/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:border-euro-gold/50 hover:shadow-[0_0_30px_rgba(250,192,23,0.15)] group-hover:bg-white/[0.12]">
                <CardContent className="h-full flex flex-col items-center p-8 pt-10 relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-euro-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-euro-gold to-[#B8860B] flex items-center justify-center mb-6 shadow-lg transform transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110 shrink-0">
                    <TrendingUp className="w-10 h-10 text-white" />
                  </div>
                  
                  <h2 className="text-3xl font-display text-white mb-3 tracking-wide group-hover:text-euro-gold transition-colors">
                    Advisors
                  </h2>
                  
                  <p className="text-[#A0A090] text-center font-light mb-auto max-w-xs group-hover:text-white/80 transition-colors line-clamp-3 min-h-[4.5rem]">
                    Dashboard exclusivo para o time de Advisors com indicadores de performance.
                  </p>
                  
                  <div className="flex items-center gap-2 text-euro-gold font-data text-xs uppercase tracking-widest opacity-0 transform translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 mt-4">
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
              className="group cursor-pointer"
            >
              <Card className="h-[340px] bg-gradient-to-br from-white/[0.08] to-transparent bg-euro-card/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] group-hover:bg-white/[0.12]">
                <CardContent className="h-full flex flex-col items-center p-8 pt-10 relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center mb-6 shadow-lg transform transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110 shrink-0">
                    <User className="w-10 h-10 text-white" />
                  </div>
                  
                  <h2 className="text-3xl font-display text-white mb-3 tracking-wide group-hover:text-blue-400 transition-colors">
                    Meu Cockpit
                  </h2>
                  
                  <p className="text-[#A0A090] text-center font-light mb-auto max-w-xs group-hover:text-white/80 transition-colors line-clamp-3 min-h-[4.5rem]">
                    Sua performance individual, receitas, gap e posição no Super Ranking.
                  </p>
                  
                  <div className="flex items-center gap-2 text-blue-400 font-data text-xs uppercase tracking-widest opacity-0 transform translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 mt-4">
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
              className="group cursor-pointer"
            >
              <Card className="h-[340px] bg-gradient-to-br from-white/[0.08] to-transparent bg-euro-card/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:border-euro-gold/50 hover:shadow-[0_0_30px_rgba(250,192,23,0.15)] group-hover:bg-white/[0.12]">
                <CardContent className="h-full flex flex-col items-center p-8 pt-10 relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-euro-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#A0A090] to-[#5C5C50] flex items-center justify-center mb-6 shadow-lg transform transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110 shrink-0">
                    <Settings className="w-10 h-10 text-white" />
                  </div>
                  
                  <h2 className="text-3xl font-display text-white mb-3 tracking-wide group-hover:text-euro-gold transition-colors">
                    Gerencial
                  </h2>
                  
                  <p className="text-[#A0A090] text-center font-light mb-auto max-w-xs group-hover:text-white/80 transition-colors line-clamp-3 min-h-[4.5rem]">
                    Cockpit de metas, projeções em tempo real e análises executivas.
                  </p>
                  
                  <div className="flex items-center gap-2 text-euro-gold font-data text-xs uppercase tracking-widest opacity-0 transform translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 mt-4">
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
              className="group cursor-pointer"
            >
              <Card className="h-[340px] bg-gradient-to-br from-white/[0.08] to-transparent bg-euro-card/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:border-[#4ADE80]/50 hover:shadow-[0_0_30px_rgba(74,222,128,0.15)] group-hover:bg-white/[0.12]">
                <CardContent className="h-full flex flex-col items-center p-8 pt-10 relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-[#4ADE80]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#4ADE80] to-[#22C55E] flex items-center justify-center mb-6 shadow-lg transform transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110 shrink-0">
                    <ShoppingBag className="w-10 h-10 text-white" />
                  </div>
                  
                  <h2 className="text-3xl font-display text-white mb-3 tracking-wide group-hover:text-[#4ADE80] transition-colors">
                    Produtos
                  </h2>
                  
                  <p className="text-[#A0A090] text-center font-light mb-auto max-w-xs group-hover:text-white/80 transition-colors line-clamp-3 min-h-[4.5rem]">
                    Renda Fixa, Variável, Consórcios, Seguros e Posição Black.
                  </p>
                  
                  <div className="flex items-center gap-2 text-[#4ADE80] font-data text-xs uppercase tracking-widest opacity-0 transform translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 mt-4">
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
              className="group cursor-pointer"
            >
            <Card className="h-[340px] bg-gradient-to-br from-white/[0.08] to-transparent bg-euro-card/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:border-[#A855F7]/50 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] group-hover:bg-white/[0.12]">
              <CardContent className="h-full flex flex-col items-center p-8 pt-10 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-[#A855F7]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#A855F7] to-[#7C3AED] flex items-center justify-center mb-6 shadow-lg transform transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110 shrink-0">
                  <BarChart3 className="w-10 h-10 text-white" />
                </div>
                
                <h2 className="text-3xl font-display text-white mb-3 tracking-wide group-hover:text-[#A855F7] transition-colors">
                  Marketing
                </h2>
                
                <p className="text-[#A0A090] text-center font-light mb-auto max-w-xs group-hover:text-white/80 transition-colors line-clamp-3 min-h-[4.5rem]">
                  Análise de performance de tráfego pago, campanhas e gestão de leads e custos.
                </p>
                
                <div className="flex items-center gap-2 text-[#A855F7] font-data text-xs uppercase tracking-widest opacity-0 transform translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 mt-4">
                  Acessar Marketing <ArrowRight className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
          </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
