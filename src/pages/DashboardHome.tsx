import React from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/PageLayout";
import { ImpactfulBackground } from "@/components/dashboard/ImpactfulBackground";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Briefcase, ShoppingBag, ArrowRight } from "lucide-react";

export default function DashboardHome() {
  const navigate = useNavigate();

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-4">
          {/* Card Comercial */}
          <div 
            onClick={() => navigate("/dash/comercial")}
            className="group cursor-pointer"
          >
            <Card className="h-[320px] bg-gradient-to-br from-white/[0.08] to-transparent bg-euro-card/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:border-euro-gold/50 hover:shadow-[0_0_30px_rgba(250,192,23,0.15)] group-hover:bg-white/[0.12]">
              <CardContent className="h-full flex flex-col items-center justify-center p-8 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-euro-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-euro-gold to-[#B8860B] flex items-center justify-center mb-8 shadow-lg transform transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110">
                  <Briefcase className="w-10 h-10 text-white" />
                </div>
                
                <h2 className="text-3xl font-display text-white mb-3 tracking-wide group-hover:text-euro-gold transition-colors">
                  Comercial
                </h2>
                
                <p className="text-[#A0A090] text-center font-light mb-8 max-w-xs group-hover:text-white/80 transition-colors">
                  Acompanhe métricas de receita, captação, ROA e performance dos assessores.
                </p>
                
                <div className="flex items-center gap-2 text-euro-gold font-data text-xs uppercase tracking-widest opacity-0 transform translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500">
                  Acessar Dashboard <ArrowRight className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Card Produtos */}
          <div 
            onClick={() => navigate("/dash/produtos")}
            className="group cursor-pointer"
          >
            <Card className="h-[320px] bg-gradient-to-br from-white/[0.08] to-transparent bg-euro-card/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:border-[#4ADE80]/50 hover:shadow-[0_0_30px_rgba(74,222,128,0.15)] group-hover:bg-white/[0.12]">
              <CardContent className="h-full flex flex-col items-center justify-center p-8 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-[#4ADE80]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#4ADE80] to-[#22C55E] flex items-center justify-center mb-8 shadow-lg transform transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110">
                  <ShoppingBag className="w-10 h-10 text-white" />
                </div>
                
                <h2 className="text-3xl font-display text-white mb-3 tracking-wide group-hover:text-[#4ADE80] transition-colors">
                  Produtos
                </h2>
                
                <p className="text-[#A0A090] text-center font-light mb-8 max-w-xs group-hover:text-white/80 transition-colors">
                  Renda Fixa, Variável, Consórcios, Seguros e Posição Black.
                </p>
                
                <div className="flex items-center gap-2 text-[#4ADE80] font-data text-xs uppercase tracking-widest opacity-0 transform translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500">
                  Acessar Produtos <ArrowRight className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
