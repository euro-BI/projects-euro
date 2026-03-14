import React, { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export const ScrollToTop = () => {
  const [isVisible, setIsVisible] = useState(false);

  // Show button when page is scrolled down
  const toggleVisibility = () => {
    if (window.scrollY > 300) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  };

  // Set the top cordinate to 0
  // make scrolling smooth
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    window.addEventListener("scroll", toggleVisibility);
    return () => {
      window.removeEventListener("scroll", toggleVisibility);
    };
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 20 }}
          whileHover={{ scale: 1.1, y: -2 }}
          whileTap={{ scale: 0.9 }}
          onClick={scrollToTop}
          className={cn(
            "fixed bottom-6 left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-auto sm:bottom-8 sm:right-8 z-50 p-2 sm:p-3 rounded-full",
            "bg-gradient-to-b from-euro-gold to-yellow-600",
            "text-euro-navy shadow-[0_0_20px_rgba(250,192,23,0.4)]",
            "border border-white/20 backdrop-blur-sm",
            "transition-all duration-300 group"
          )}
          title="Voltar ao topo"
        >
          <ArrowUp className="w-4 h-4 sm:w-6 sm:h-6 group-hover:-translate-y-1 transition-transform duration-300" strokeWidth={2.5} />
          
          {/* Glow Effect */}
          <div className="absolute inset-0 rounded-full bg-euro-gold blur-md opacity-40 group-hover:opacity-70 transition-opacity duration-300 -z-10" />
        </motion.button>
      )}
    </AnimatePresence>
  );
};
