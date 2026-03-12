
import React, { useMemo } from "react";
import { motion } from "framer-motion";

interface ImpactfulBackgroundProps {
  opacity?: number;
}

export const ImpactfulBackground = ({ 
  opacity = 0.3
}: ImpactfulBackgroundProps) => {
  // URLs from user
  const CENTRAL_ROCK = "https://pub-b2b30f370a3947899854a061170643ea.r2.dev/utils/rocha.png";
  const ROCK_1 = "https://pub-b2b30f370a3947899854a061170643ea.r2.dev/utils/rocha_1.png";
  const ROCK_3 = "https://pub-b2b30f370a3947899854a061170643ea.r2.dev/utils/rocha_3.png";

  // Generate random positions for rocks with "coming towards user" animation
  const rocks = useMemo(() => [
    { id: 1, src: ROCK_1, size: 250, duration: 20, delay: 0, x: "5%", y: "45%", scale: [0.8, 1.2, 0.8] },
    { id: 2, src: ROCK_3, size: 300, duration: 25, delay: 5, x: "75%", y: "20%", scale: [0.7, 1.1, 0.7] },
    { id: 3, src: ROCK_1, size: 180, duration: 18, delay: 2, x: "85%", y: "70%", scale: [0.9, 1.3, 0.9] },
    { id: 4, src: ROCK_3, size: 220, duration: 22, delay: 8, x: "10%", y: "65%", scale: [0.6, 1.0, 0.6] },
  ], [ROCK_1, ROCK_3]);

  // Stars generation for extra depth
  const stars = useMemo(() => Array.from({ length: 100 }).map((_, i) => ({
    id: i,
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    size: Math.random() * 1.5 + 0.5,
    duration: Math.random() * 3 + 2,
    delay: Math.random() * 5
  })), []);

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-euro-navy pointer-events-none select-none">
      
      {/* 1. Dark Background Overlay (Previously Video) */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-[#0A0A0B]" />

      {/* 2. Extra Animated Stars for Parallax depth */}
      <div className="absolute inset-0 z-10">
        {stars.map((star) => (
          <motion.div
            key={star.id}
            initial={{ opacity: 0.1 }}
            animate={{ 
              opacity: [0.1, 0.6, 0.1],
              scale: [1, 1.5, 1]
            }}
            transition={{
              duration: star.duration,
              repeat: Infinity,
              delay: star.delay,
              ease: "easeInOut"
            }}
            className="absolute rounded-full bg-white shadow-[0_0_8px_white]"
            style={{
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
            }}
          />
        ))}
      </div>

      {/* 3. Central Rock (Static and perfectly centered) */}
      <div 
        className="absolute top-[60%] left-1/2 z-20 w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2"
      >
        <img 
          src={CENTRAL_ROCK} 
          alt="Central Rock" 
          className="w-full h-full object-contain"
        />
      </div>

      {/* 4. Random Floating Rocks with Depth Animation (Coming towards user) */}
      <div className="absolute inset-0 z-30 overflow-hidden">
        {rocks.map((rock) => (
          <motion.div
            key={rock.id}
            initial={{ x: rock.x, y: rock.y, scale: rock.scale[0], rotate: 0, opacity: 1 }}
            animate={{ 
              scale: rock.scale,
              y: ["-2%", "2%", "-2%"],
              x: ["-1%", "1%", "-1%"],
              rotate: [0, 10, -10, 0]
            }}
            transition={{
              duration: rock.duration,
              repeat: Infinity,
              delay: rock.delay,
              ease: "easeInOut"
            }}
            className="absolute"
            style={{
              width: rock.size,
              height: rock.size,
              left: rock.x,
              top: rock.y,
            }}
          >
            <img 
              src={rock.src} 
              alt="Floating Rock" 
              className="w-full h-full object-contain"
            />
          </motion.div>
        ))}
      </div>

      {/* 5. Final Vignette and Atmospheric Blur */}
      <div className="absolute inset-0 z-40 bg-radial-gradient from-transparent via-transparent to-euro-navy/60 pointer-events-none" />
    </div>
  );
};
