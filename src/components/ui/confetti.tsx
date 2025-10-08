import * as React from "react";
import confettiLib, { type Options as ConfettiOptions } from "canvas-confetti";
import { Button } from "@/components/ui/button";

export type ConfettiRef = {
  shoot: (options?: ConfettiOptions) => void;
  random: () => void;
  fireworks: (duration?: number) => void;
  sideCannons: (duration?: number) => void;
  stars: (duration?: number) => void;
  customShapes: (duration?: number) => void;
  emoji: (duration?: number) => void;
};

const ConfettiContext = React.createContext<ConfettiRef | null>(null);

export const useConfetti = () => {
  const context = React.useContext(ConfettiContext);
  if (!context) throw new Error("useConfetti must be used within Confetti");
  return context;
};

export const Confetti = React.forwardRef<ConfettiRef, { children?: React.ReactNode }>((props, ref) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const shoot = React.useCallback((options?: ConfettiOptions) => {
    if (!canvasRef.current) return;
    
    const myConfetti = confettiLib.create(canvasRef.current, {
      resize: true,
      useWorker: true,
    });

    myConfetti(options || {});
  }, []);

  const random = React.useCallback(() => {
    shoot({
      angle: Math.random() * 360,
      spread: 360,
      particleCount: 100,
      origin: { x: Math.random(), y: Math.random() - 0.2 }
    });
  }, [shoot]);

  const fireworks = React.useCallback((duration = 5000) => {
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) =>
      Math.random() * (max - min) + min;

    const interval = window.setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      shoot({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      shoot({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);
  }, [shoot]);

  const sideCannons = React.useCallback((duration = 5000) => {
    const end = Date.now() + duration;
    const colors = ["#a786ff", "#fd8bbc", "#eca184", "#f8deb1"];

    const frame = () => {
      if (Date.now() > end) return;

      shoot({
        particleCount: 2,
        angle: 60,
        spread: 55,
        startVelocity: 60,
        origin: { x: 0, y: 0.5 },
        colors: colors,
      });
      shoot({
        particleCount: 2,
        angle: 120,
        spread: 55,
        startVelocity: 60,
        origin: { x: 1, y: 0.5 },
        colors: colors,
      });

      requestAnimationFrame(frame);
    };

    frame();
  }, [shoot]);

  const stars = React.useCallback((duration = 3000) => {
    const defaults = {
      spread: 360,
      ticks: 50,
      gravity: 0,
      decay: 0.94,
      startVelocity: 30,
      colors: ["#FFE400", "#FFBD00", "#E89400", "#FFCA6C", "#FDFFB8"],
    };

    const shootStars = () => {
      shoot({
        ...defaults,
        particleCount: 40,
        scalar: 1.2,
        shapes: ["star"],
      });

      shoot({
        ...defaults,
        particleCount: 10,
        scalar: 0.75,
        shapes: ["circle"],
      });
    };

    setTimeout(shootStars, 0);
    setTimeout(shootStars, 100);
    setTimeout(shootStars, 200);
  }, [shoot]);

  const customShapes = React.useCallback((duration = 3000) => {
    const scalar = 2;
    const triangle = confettiLib.shapeFromPath({
      path: "M0 10 L5 0 L10 10z",
    });
    const square = confettiLib.shapeFromPath({
      path: "M0 0 L10 0 L10 10 L0 10 Z",
    });
    const coin = confettiLib.shapeFromPath({
      path: "M5 0 A5 5 0 1 0 5 10 A5 5 0 1 0 5 0 Z",
    });
    const tree = confettiLib.shapeFromPath({
      path: "M5 0 L10 10 L0 10 Z",
    });

    const defaults = {
      spread: 360,
      ticks: 60,
      gravity: 0,
      decay: 0.96,
      startVelocity: 20,
      shapes: [triangle, square, coin, tree],
      scalar,
    };

    const shootShapes = () => {
      shoot({
        ...defaults,
        particleCount: 30,
      });

      shoot({
        ...defaults,
        particleCount: 5,
      });

      shoot({
        ...defaults,
        particleCount: 15,
        scalar: scalar / 2,
        shapes: ["circle"],
      });
    };

    setTimeout(shootShapes, 0);
    setTimeout(shootShapes, 100);
    setTimeout(shootShapes, 200);
  }, [shoot]);

  const emoji = React.useCallback((duration = 3000) => {
    const scalar = 2;
    const unicorn = confettiLib.shapeFromText({ text: "🦄", scalar });

    const defaults = {
      spread: 360,
      ticks: 60,
      gravity: 0,
      decay: 0.96,
      startVelocity: 20,
      shapes: [unicorn],
      scalar,
    };

    const shootEmoji = () => {
      shoot({
        ...defaults,
        particleCount: 30,
      });

      shoot({
        ...defaults,
        particleCount: 5,
      });

      shoot({
        ...defaults,
        particleCount: 15,
        scalar: scalar / 2,
        shapes: ["circle"],
      });
    };

    setTimeout(shootEmoji, 0);
    setTimeout(shootEmoji, 100);
    setTimeout(shootEmoji, 200);
  }, [shoot]);

  const api = React.useMemo(() => ({
    shoot,
    random,
    fireworks,
    sideCannons,
    stars,
    customShapes,
    emoji,
  }), [shoot, random, fireworks, sideCannons, stars, customShapes, emoji]);

  React.useImperativeHandle(ref, () => api, [api]);

  return (
    <ConfettiContext.Provider value={api}>
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 1000,
        }}
      />
      {props.children}
    </ConfettiContext.Provider>
  );
});

Confetti.displayName = "Confetti";

export const ConfettiButton = (
  props: React.ComponentProps<typeof Button> & { onConfetti?: (api: ConfettiRef) => void },
) => {
  const confetti = useConfetti();

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (props.onConfetti) {
      props.onConfetti(confetti);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      confetti.shoot({
        origin: {
          x: x / window.innerWidth,
          y: y / window.innerHeight,
        },
      });
    }
    props.onClick?.(event);
  };

  return <Button {...props} onClick={handleClick} />;
};

// Demo components
export const ConfettiDemo = () => {
  const confettiRef = React.useRef<ConfettiRef>(null);

  return (
    <div className="relative flex h-[500px] w-full flex-col items-center justify-center overflow-hidden rounded-lg border bg-background md:shadow-xl">
      <span className="pointer-events-none whitespace-pre-wrap bg-gradient-to-b from-black to-gray-300/80 bg-clip-text text-center text-8xl font-semibold leading-none text-transparent dark:from-white dark:to-slate-900/10">
        Confetti
      </span>

      <Confetti ref={confettiRef}>
        <div
          className="absolute left-0 top-0 z-0 size-full"
          onMouseEnter={() => {
            confettiRef.current?.shoot({});
          }}
        />
      </Confetti>
    </div>
  );
};

export const ConfettiButtonDemo = () => {
  return (
    <div className="relative">
      <ConfettiButton>Confetti 🎉</ConfettiButton>
    </div>
  );
};

export const ConfettiRandom = () => {
  return (
    <div className="relative">
      <ConfettiButton onConfetti={(api) => api.random()}>
        Random Confetti 🎉
      </ConfettiButton>
    </div>
  );
};

export const ConfettiFireworks: React.FC<{ duration?: number }> = ({ duration = 5000 }) => {
  const confettiRef = React.useRef<ConfettiRef>(null);

  return (
    <div className="relative">
      <Confetti ref={confettiRef} />
      <Button onClick={() => confettiRef.current?.fireworks(duration)}>
        Trigger Fireworks
      </Button>
    </div>
  );
};

export const ConfettiSideCannons: React.FC<{ duration?: number }> = ({ duration = 5000 }) => {
  const confettiRef = React.useRef<ConfettiRef>(null);

  return (
    <div className="relative">
      <Confetti ref={confettiRef} />
      <Button onClick={() => confettiRef.current?.sideCannons(duration)}>
        Trigger Side Cannons
      </Button>
    </div>
  );
};

export const ConfettiStars: React.FC<{ duration?: number }> = ({ duration = 3000 }) => {
  const confettiRef = React.useRef<ConfettiRef>(null);

  return (
    <div className="relative">
      <Confetti ref={confettiRef} />
      <Button onClick={() => confettiRef.current?.stars(duration)}>
        Trigger Stars
      </Button>
    </div>
  );
};

export const ConfettiCustomShapes: React.FC<{ duration?: number }> = ({ duration = 3000 }) => {
  const confettiRef = React.useRef<ConfettiRef>(null);

  return (
    <div className="relative flex items-center justify-center">
      <Confetti ref={confettiRef} />
      <Button onClick={() => confettiRef.current?.customShapes(duration)}>
        Trigger Shapes
      </Button>
    </div>
  );
};

export const ConfettiEmoji: React.FC<{ duration?: number }> = ({ duration = 3000 }) => {
  const confettiRef = React.useRef<ConfettiRef>(null);

  return (
    <div className="relative justify-center">
      <Confetti ref={confettiRef} />
      <Button onClick={() => confettiRef.current?.emoji(duration)}>
        Trigger Emoji
      </Button>
    </div>
  );
};