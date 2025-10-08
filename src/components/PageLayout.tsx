import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export const PageLayout = ({ children, className }: PageLayoutProps) => {
  const isMobile = useIsMobile();

  return (
    <div 
      className={cn(
        "min-h-screen bg-background",
        // Ajusta o padding superior baseado no mobile
        // Mobile: 16 (header) + 40 (user info bar) = 56px = pt-14
        // Desktop: apenas 16 (header) = pt-16
        isMobile ? "pt-14" : "pt-16",
        className
      )}
    >
      {children}
    </div>
  );
};