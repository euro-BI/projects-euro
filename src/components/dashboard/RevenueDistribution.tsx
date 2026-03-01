import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Building2, 
  ChevronRight, 
  ChevronDown, 
  TrendingUp, 
  PieChart, 
  DollarSign,
  Briefcase,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { REPASSE_CONFIG, PRODUCT_KEYS } from "@/constants/revenue";

interface RevenueDistributionProps {
  simulatedValues: Record<string, number>;
  targetRevenue: number;
}

interface DistributionNode {
  id: string;
  label: string;
  value: number;
  color: string; // Tailwind class prefix like 'emerald' or hex
  icon?: React.ReactNode;
  children?: DistributionNode[];
  description?: string;
}

const formatMoney = (val: number) => new Intl.NumberFormat('pt-BR', { 
  style: 'currency', 
  currency: 'BRL', 
  maximumFractionDigits: 0 
}).format(val);

const formatPercent = (val: number) => `${val.toFixed(1)}%`;

export function RevenueDistribution({ simulatedValues, targetRevenue }: RevenueDistributionProps) {
  
  // Build the hierarchical data structure
  const data = useMemo(() => {
    // 1. Calculate Repasse Details
    let repasseInvestimentos = 0;
    let repasseCrossSell = 0;
    
    const investimentosChildren: DistributionNode[] = [];
    const crossSellChildren: DistributionNode[] = [];

    Object.entries(simulatedValues).forEach(([key, value]) => {
      // Investimentos
      if (key in REPASSE_CONFIG.investimentos.produtos) {
        const rate = (REPASSE_CONFIG.investimentos.produtos as any)[key];
        const commission = value * rate * REPASSE_CONFIG.investimentos.base;
        repasseInvestimentos += commission;
        
        investimentosChildren.push({
          id: key,
          label: PRODUCT_KEYS[key as keyof typeof PRODUCT_KEYS],
          value: commission,
          color: 'emerald',
          description: `Comissão: ${(rate * 100).toFixed(0)}% x Base ${(REPASSE_CONFIG.investimentos.base * 100).toFixed(0)}%`
        });
      }
      // Cross-Sell
      else if (key in REPASSE_CONFIG.cross_sell.produtos) {
        const rate = (REPASSE_CONFIG.cross_sell.produtos as any)[key];
        const commission = value * rate * REPASSE_CONFIG.cross_sell.base;
        repasseCrossSell += commission;

        crossSellChildren.push({
          id: key,
          label: PRODUCT_KEYS[key as keyof typeof PRODUCT_KEYS],
          value: commission,
          color: 'amber',
          description: `Comissão: ${(rate * 100).toFixed(0)}% x Base ${(REPASSE_CONFIG.cross_sell.base * 100).toFixed(0)}%`
        });
      }
    });

    // Sort children by value desc
    investimentosChildren.sort((a, b) => b.value - a.value);
    crossSellChildren.sort((a, b) => b.value - a.value);

    const totalAssessores = repasseInvestimentos + repasseCrossSell;
    const totalAdm = targetRevenue - totalAssessores;

    // Root Nodes
    const rootNodes: DistributionNode[] = [
      {
        id: 'assessores',
        label: 'Repasse Assessores',
        value: totalAssessores,
        color: 'emerald',
        icon: <Users className="w-5 h-5" />,
        description: 'Valor destinado ao comissionamento da força de vendas.',
        children: [
          {
            id: 'investimentos',
            label: 'Investimentos',
            value: repasseInvestimentos,
            color: 'emerald',
            icon: <Briefcase className="w-4 h-4" />,
            children: investimentosChildren,
            description: 'Produtos de investimento (Renda Fixa, Variável, Fundos, etc.)'
          },
          {
            id: 'cross-sell',
            label: 'Cross-Sell',
            value: repasseCrossSell,
            color: 'amber',
            icon: <ShieldCheck className="w-4 h-4" />,
            children: crossSellChildren,
            description: 'Seguros, Consórcios e outros produtos de proteção.'
          }
        ]
      },
      {
        id: 'house',
        label: 'Administrativo (House)',
        value: totalAdm,
        color: 'cyan',
        icon: <Building2 className="w-5 h-5" />,
        description: 'Receita retida pela empresa para custos operacionais e margem.',
        children: [] // Could add breakdown of costs if available
      }
    ];

    return rootNodes;
  }, [simulatedValues, targetRevenue]);

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-display text-white flex items-center gap-2">
            <PieChart className="w-5 h-5 text-euro-gold" />
            Distribuição Estimada Interativa
          </h3>
          <p className="text-sm text-white/60">
            Explore a composição da receita clicando nos cards abaixo.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {data.map((node) => (
          <ExpandableNode key={node.id} node={node} total={targetRevenue} level={0} />
        ))}
      </div>
    </div>
  );
}

// --- SUB-COMPONENT: COMPACT PRODUCT NODE ---
function CompactProductNode({ node, total }: { node: DistributionNode, total: number }) {
  const percentage = total > 0 ? (node.value / total) * 100 : 0;
  
  const getColors = (colorName: string) => {
    const map: Record<string, string> = {
      emerald: 'bg-emerald-500',
      cyan: 'bg-cyan-500',
      amber: 'bg-amber-500'
    };
    return map[colorName] || 'bg-emerald-500';
  };

  const barColor = getColors(node.color);

  return (
    <div className="flex items-center gap-3 py-2 group">
      <div className="w-32 md:w-48 flex-shrink-0">
        <p className="text-xs font-data text-white/70 truncate group-hover:text-white transition-colors">
          {node.label}
        </p>
      </div>
      
      <div className="flex-1 relative h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={cn("absolute left-0 top-0 bottom-0 rounded-full", barColor)}
        />
      </div>

      <div className="w-24 text-right flex-shrink-0">
        <p className="text-xs font-mono font-bold text-white/90">
          {formatMoney(node.value)}
        </p>
      </div>
    </div>
  );
}

// --- SUB-COMPONENT: EXPANDABLE NODE ---

function ExpandableNode({ node, total, level }: { node: DistributionNode, total: number, level: number }) {
  const [isOpen, setIsOpen] = useState(level === 0 && node.id === 'assessores'); // Default open assessores
  const percentage = total > 0 ? (node.value / total) * 100 : 0;
  const hasChildren = node.children && node.children.length > 0;
  
  // Logic: Level 0 (Roots) -> Expandable Blocks
  // Logic: Level 1 (Categories) -> Expandable Blocks (but cleaner bg)
  // Logic: Level 2 (Products) -> Compact List (handled inside Level 1's children loop)

  // Dynamic colors based on props
  const getColors = (colorName: string) => {
    const map: Record<string, any> = {
      emerald: {
        bg: level === 0 ? 'bg-emerald-500/10' : 'bg-transparent hover:bg-white/5',
        border: level === 0 ? 'border-emerald-500/20' : 'border-white/10',
        text: 'text-emerald-400',
        bar: 'bg-emerald-500',
        glow: 'shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]'
      },
      cyan: {
        bg: level === 0 ? 'bg-cyan-500/10' : 'bg-transparent hover:bg-white/5',
        border: level === 0 ? 'border-cyan-500/20' : 'border-white/10',
        text: 'text-cyan-400',
        bar: 'bg-cyan-500',
        glow: 'shadow-[0_0_15px_-3px_rgba(6,182,212,0.3)]'
      },
      amber: {
        bg: level === 0 ? 'bg-amber-500/10' : 'bg-transparent hover:bg-white/5',
        border: level === 0 ? 'border-amber-500/20' : 'border-white/10',
        text: 'text-amber-400',
        bar: 'bg-amber-500',
        glow: 'shadow-[0_0_15px_-3px_rgba(245,158,11,0.3)]'
      }
    };
    return map[colorName] || map.emerald;
  };

  const colors = getColors(node.color);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-xl border transition-all duration-300",
        colors.bg,
        colors.border,
        isOpen && level === 0 ? colors.glow : ""
      )}
      style={{ marginLeft: level * 0 }} // Removed indentation for cleaner look, relying on nesting visual
    >
      {/* Background Progress Bar - Only for Level 0 to avoid visual noise */}
      {/* Moved inside the header container to avoid overlapping children content */}
      
      <div 
        className="relative z-10 p-4 cursor-pointer flex items-center gap-4 overflow-hidden"
        onClick={() => hasChildren && setIsOpen(!isOpen)}
      >
        {level === 0 && (
          <div 
            className={cn("absolute left-0 top-0 bottom-0 opacity-50 transition-all duration-1000 -z-10", colors.bar)} 
            style={{ width: `${percentage}%` }}
          />
        )}

        {/* Icon & Label */}
        <div className="flex-1 flex items-center gap-3">
          <div className={cn("p-2 rounded-lg backdrop-blur-sm", level === 0 ? "bg-black/20" : "bg-white/5", colors.text)}>
            {node.icon || <DollarSign className="w-4 h-4" />}
          </div>
          <div>
            <h4 className={cn("font-display text-sm md:text-base", level === 0 ? colors.text : "text-white")}>
              {node.label}
            </h4>
            {node.description && (
              <p className="text-[10px] md:text-xs text-white/40 hidden md:block">
                {node.description}
              </p>
            )}
          </div>
        </div>

        {/* Values */}
        <div className="text-right">
          <p className={cn("text-lg md:text-xl font-mono font-bold", level === 0 ? colors.text : "text-white")}>
            {formatMoney(node.value)}
          </p>
          <p className="text-xs text-white/50 font-mono">
            {percentage.toFixed(1)}%
          </p>
        </div>

        {/* Chevron */}
        {hasChildren && (
          <div className={cn("transition-transform duration-300 text-white/50", isOpen ? "rotate-180" : "")}>
            <ChevronDown className="w-5 h-5" />
          </div>
        )}
      </div>

      {/* Children Expansion */}
      <AnimatePresence>
        {isOpen && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden border-t border-white/5 bg-black/20"
          >
            <div className="p-4 space-y-1">
               {/* Insight/Storytelling Header inside Expansion */}
               <div className="flex items-center gap-2 mb-4 px-2">
                 <Zap className="w-3 h-3 text-euro-gold" />
                 <span className="text-[10px] uppercase tracking-widest text-white/40 font-data">
                   Detalhamento de {node.label}
                 </span>
                 <div className="h-px bg-white/10 flex-1" />
               </div>

               {node.children!.map((child) => {
                 // If the child is a leaf node (product level), use Compact view
                 // Assuming Level 1 children are products (Level 2)
                 if (level >= 0 && (!child.children || child.children.length === 0)) {
                   return (
                     <CompactProductNode 
                        key={child.id} 
                        node={child} 
                        total={node.value} 
                     />
                   );
                 }
                 
                 // Otherwise recursive expandable
                 return (
                   <ExpandableNode 
                     key={child.id} 
                     node={child} 
                     total={node.value} 
                     level={level + 1} 
                   />
                 );
               })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
