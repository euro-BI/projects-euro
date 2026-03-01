
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
}

export const LoadingOverlay = ({ isLoading, message = "Carregando dados..." }: LoadingOverlayProps) => {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-euro-navy/80 backdrop-blur-md"
        >
          <div className="flex flex-col items-center space-y-6">
            <div className="relative">
              {/* Outer glow circle */}
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute inset-0 rounded-full bg-euro-gold blur-xl"
              />
              
              {/* Spinning icon */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "linear",
                }}
                className="relative z-10 flex items-center justify-center w-20 h-20 rounded-full bg-euro-card border-2 border-euro-gold/50 shadow-[0_0_20px_rgba(250,192,23,0.3)]"
              >
                <RefreshCw className="w-10 h-10 text-euro-gold" />
              </motion.div>
            </div>

            {/* Loading text */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <h2 className="text-sm font-data text-euro-gold uppercase tracking-[0.3em] animate-pulse">
                {message}
              </h2>
              <p className="text-[10px] font-ui text-[#8A8A7A] mt-2 uppercase tracking-widest">
                Eurostock Performance Hub
              </p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
