import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  useGradient?: boolean;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, useGradient = false, ...props }, ref) => {
  // Função para calcular a cor baseada no valor (0-100)
  const getProgressColor = (progress: number) => {
    if (!useGradient) return "bg-primary";
    
    // Normaliza o valor entre 0 e 1
    const normalizedValue = Math.max(0, Math.min(100, progress)) / 100;
    
    // Calcula RGB para transição de vermelho (255,0,0) para verde (0,255,0)
    const red = Math.round(255 * (1 - normalizedValue));
    const green = Math.round(255 * normalizedValue);
    const blue = 0;
    
    return `rgb(${red}, ${green}, ${blue})`;
  };

  const progressValue = value || 0;
  const progressColor = getProgressColor(progressValue);

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn("relative h-4 w-full overflow-hidden rounded-full bg-secondary", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full w-full flex-1 transition-all duration-500",
          !useGradient && "bg-primary"
        )}
        style={{ 
          transform: `translateX(-${100 - progressValue}%)`,
          ...(useGradient && { backgroundColor: progressColor })
        }}
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
