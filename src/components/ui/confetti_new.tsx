import type { ReactNode } from "react"
import React, {
  createContext,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react"
import type {
  GlobalOptions as ConfettiGlobalOptions,
  CreateTypes as ConfettiInstance,
  Options as ConfettiOptions,
} from "canvas-confetti"
import confetti from "canvas-confetti"

import { Button, ButtonProps } from "@/components/ui/button"

type Api = {
  fire: (options?: ConfettiOptions) => void
}

type Props = React.ComponentPropsWithRef<"canvas"> & {
  options?: ConfettiOptions
  globalOptions?: ConfettiGlobalOptions
  manualstart?: boolean
  children?: ReactNode
}

export type ConfettiRef = Api | null

const ConfettiContext = createContext<Api>({} as Api)

const Confetti = forwardRef<ConfettiRef, Props>((props, ref) => {
  const {
    options,
    globalOptions = { resize: true, useWorker: true },
    manualstart = false,
    children,
    ...rest
  } = props
  const instanceRef = useRef<ConfettiInstance | null>(null)

  const canvasRef = useCallback(
    (node: HTMLCanvasElement) => {
      if (node !== null) {
        if (instanceRef.current) return
        instanceRef.current = confetti.create(node, {
          ...globalOptions,
          resize: true,
        })
      } else {
        if (instanceRef.current) {
          instanceRef.current.reset()
          instanceRef.current = null
        }
      }
    },
    [globalOptions],
  )

  const fire = useCallback(
    (opts = {}) => instanceRef.current?.({ ...options, ...opts }),
    [options],
  )

  const api = useMemo(
    () => ({
      fire,
    }),
    [fire],
  )

  useImperativeHandle(ref, () => api, [api])

  useEffect(() => {
    if (!manualstart) {
      fire()
    }
  }, [manualstart, fire])

  return (
    <ConfettiContext.Provider value={api}>
      <canvas ref={canvasRef} {...rest} />
      {children}
    </ConfettiContext.Provider>
  )
})

interface ConfettiButtonProps extends ButtonProps {
  options?: ConfettiOptions &
    ConfettiGlobalOptions & { canvas?: HTMLCanvasElement }
  children?: React.ReactNode
}

function ConfettiButton({ options, children, ...props }: ConfettiButtonProps) {
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    confetti({
      ...options,
      origin: {
        x: x / window.innerWidth,
        y: y / window.innerHeight,
      },
    })
  }

  return (
    <Button onClick={handleClick} {...props}>
      {children}
    </Button>
  )
}

Confetti.displayName = "Confetti"

export { Confetti, ConfettiButton }

// Demo components
function ConfettiDemo() {
  const confettiRef = useRef<ConfettiRef>(null)

  return (
    <div className="relative flex h-[500px] w-full flex-col items-center justify-center overflow-hidden rounded-lg border bg-background md:shadow-xl">
      <span className="pointer-events-none whitespace-pre-wrap bg-gradient-to-b from-black to-gray-300/80 bg-clip-text text-center text-8xl font-semibold leading-none text-transparent dark:from-white dark:to-slate-900/10">
        Confetti
      </span>

      <Confetti
        ref={confettiRef}
        className="absolute left-0 top-0 z-0 size-full"
        onMouseEnter={() => {
          confettiRef.current?.fire({})
        }}
      />
    </div>
  )
}

function ConfettiButtonDemo() {
  return (
    <div className="relative">
      <ConfettiButton>Confetti 🎉</ConfettiButton>
    </div>
  )
}

function ConfettiRandom() {
  return (
    <div className="relative">
      <ConfettiButton
        options={{
          get angle() {
            return Math.random() * 360
          },
        }}
      >
        Random Confetti 🎉
      </ConfettiButton>
    </div>
  )
}

function ConfettiFireworks() {
  const handleClick = () => {
    const duration = 5 * 1000
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

    const randomInRange = (min: number, max: number) =>
      Math.random() * (max - min) + min

    const interval = window.setInterval(() => {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        return clearInterval(interval)
      }

      const particleCount = 50 * (timeLeft / duration)
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      })
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      })
    }, 250)
  }

  return (
    <div className="relative">
      <Button onClick={handleClick}>Trigger Fireworks</Button>
    </div>
  )
}

function ConfettiSideCannons() {
  const handleClick = () => {
    const end = Date.now() + 3 * 1000
    const colors = ["#a786ff", "#fd8bbc", "#eca184", "#f8deb1"]

    const frame = () => {
      if (Date.now() > end) return

      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        startVelocity: 60,
        origin: { x: 0, y: 0.5 },
        colors: colors,
      })
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        startVelocity: 60,
        origin: { x: 1, y: 0.5 },
        colors: colors,
      })

      requestAnimationFrame(frame)
    }

    frame()
  }

  return (
    <div className="relative">
      <Button onClick={handleClick}>Trigger Side Cannons</Button>
    </div>
  )
}

function ConfettiStars() {
  const handleClick = () => {
    const defaults = {
      spread: 360,
      ticks: 50,
      gravity: 0,
      decay: 0.94,
      startVelocity: 30,
      colors: ["#FFE400", "#FFBD00", "#E89400", "#FFCA6C", "#FDFFB8"],
    }

    const shoot = () => {
      confetti({
        ...defaults,
        particleCount: 40,
        scalar: 1.2,
        shapes: ["star"],
      })

      confetti({
        ...defaults,
        particleCount: 10,
        scalar: 0.75,
        shapes: ["circle"],
      })
    }

    setTimeout(shoot, 0)
    setTimeout(shoot, 100)
    setTimeout(shoot, 200)
  }

  return (
    <div className="relative">
      <Button onClick={handleClick}>Trigger Stars</Button>
    </div>
  )
}

function ConfettiCustomShapes() {
  const handleClick = () => {
    const scalar = 2
    const triangle = confetti.shapeFromPath({
      path: "M0 10 L5 0 L10 10z",
    })
    const square = confetti.shapeFromPath({
      path: "M0 0 L10 0 L10 10 L0 10 Z",
    })
    const coin = confetti.shapeFromPath({
      path: "M5 0 A5 5 0 1 0 5 10 A5 5 0 1 0 5 0 Z",
    })
    const tree = confetti.shapeFromPath({
      path: "M5 0 L10 10 L0 10 Z",
    })

    const defaults = {
      spread: 360,
      ticks: 60,
      gravity: 0,
      decay: 0.96,
      startVelocity: 20,
      shapes: [triangle, square, coin, tree],
      scalar,
    }

    const shoot = () => {
      confetti({
        ...defaults,
        particleCount: 30,
      })

      confetti({
        ...defaults,
        particleCount: 5,
      })

      confetti({
        ...defaults,
        particleCount: 15,
        scalar: scalar / 2,
        shapes: ["circle"],
      })
    }

    setTimeout(shoot, 0)
    setTimeout(shoot, 100)
    setTimeout(shoot, 200)
  }

  return (
    <div className="relative flex items-center justify-center">
      <Button onClick={handleClick}>Trigger Shapes</Button>
    </div>
  )
}

function ConfettiEmoji() {
  const handleClick = () => {
    const scalar = 2
    const unicorn = confetti.shapeFromText({ text: "🦄", scalar })

    const defaults = {
      spread: 360,
      ticks: 60,
      gravity: 0,
      decay: 0.96,
      startVelocity: 20,
      shapes: [unicorn],
      scalar,
    }

    const shoot = () => {
      confetti({
        ...defaults,
        particleCount: 30,
      })

      confetti({
        ...defaults,
        particleCount: 5,
      })

      confetti({
        ...defaults,
        particleCount: 15,
        scalar: scalar / 2,
        shapes: ["circle"],
      })
    }

    setTimeout(shoot, 0)
    setTimeout(shoot, 100)
    setTimeout(shoot, 200)
  }

  return (
    <div className="relative justify-center">
      <Button onClick={handleClick}>Trigger Emoji</Button>
    </div>
  )
}

export {
  ConfettiDemo,
  ConfettiButtonDemo,
  ConfettiRandom,
  ConfettiFireworks,
  ConfettiSideCannons,
  ConfettiStars,
  ConfettiCustomShapes,
  ConfettiEmoji,
}
