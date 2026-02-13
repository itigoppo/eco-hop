"use client"

import { cn } from "@/lib/utils/common"
import Image from "next/image"
import { useEffect, useState } from "react"

interface Props {
  active: boolean
  faces: number[]
}

export function DiceRollOverlay({ active, faces }: Props) {
  const [phase, setPhase] = useState<"hidden" | "active" | "fading">(active ? "active" : "hidden")
  const [prevActive, setPrevActive] = useState(active)

  if (active !== prevActive) {
    setPrevActive(active)
    setPhase(active ? "active" : "fading")
  }

  useEffect(() => {
    if (phase !== "fading") return
    const timer = setTimeout(() => setPhase("hidden"), 600)
    return () => clearTimeout(timer)
  }, [phase])

  if (phase === "hidden") return null

  const isFading = phase === "fading"

  const diceImg = (face: number, i: number) => (
    <Image
      key={i}
      src={`/dice/dice${face}.svg`}
      alt=""
      width={80}
      height={80}
      className={cn(
        "h-20 w-20 drop-shadow-lg",
        isFading
          ? "animate-dice-burst"
          : i === 0
            ? "animate-dice-roll-across"
            : i === 1
              ? "animate-dice-roll-across-2"
              : "animate-dice-roll-across-3"
      )}
    />
  )

  if (faces.length === 3) {
    return (
      <div className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center">
        <div>{diceImg(faces[0], 0)}</div>
        <div className="flex gap-4">
          {diceImg(faces[1], 1)}
          {diceImg(faces[2], 2)}
        </div>
      </div>
    )
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center gap-4">
      {faces.map((face, i) => diceImg(face, i))}
    </div>
  )
}
