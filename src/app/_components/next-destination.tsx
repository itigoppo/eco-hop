"use client"

import { DiceRollOverlay } from "@/components/dice-roll-overlay"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { type MetroGraph, computeStationDistances } from "@/lib/metro-graph"
import { cn } from "@/lib/utils/common"
import type { RouteStep, Station } from "@/types"
import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"
import { RouteDisplay } from "./route-display"

type RevealMode = "hidden" | "rolling" | "bursting" | "roulette" | "revealed"

/** サイコロの個数を決める。13以上は必ず3個、それ以外は30%の確率で3個 */
function decideDiceCount(total: number): number {
  if (total > 12) return 3
  return Math.random() < 0.15 ? 3 : 2
}

/** 合計値をサイコロ(各1-6)にランダム分配する */
function splitIntoDice(total: number, count: number): number[] {
  if (count === 3) {
    const clamped = Math.max(3, Math.min(18, total))
    const minA = Math.max(1, clamped - 12)
    const maxA = Math.min(6, clamped - 2)
    const a = minA + Math.floor(Math.random() * (maxA - minA + 1))
    const rest = clamped - a
    const minB = Math.max(1, rest - 6)
    const maxB = Math.min(6, rest - 1)
    const b = minB + Math.floor(Math.random() * (maxB - minB + 1))
    return [a, b, rest - b]
  }
  const clamped = Math.max(2, Math.min(12, total))
  const minA = Math.max(1, clamped - 6)
  const maxA = Math.min(6, clamped - 1)
  const a = minA + Math.floor(Math.random() * (maxA - minA + 1))
  return [a, clamped - a]
}

interface Props {
  currentStation: Station
  station: Station | null
  graph: MetroGraph
  route: RouteStep[] | null
  isFirstDestination: boolean
  startRevealed: boolean
  destinationRevealed: boolean
  onGo: () => void
  onReroll: () => void
  onFinish: () => void
  canFinish: boolean
  savedDiceFaces?: number[]
  onRevealed: (diceFaces: number[]) => void
}

function initialMode(isFirst: boolean, alreadyRevealed: boolean): RevealMode {
  if (alreadyRevealed) return "revealed"
  return isFirst ? "hidden" : "rolling"
}

export function NextDestination({
  currentStation,
  station,
  graph,
  route,
  isFirstDestination,
  startRevealed,
  destinationRevealed,
  savedDiceFaces,
  onGo,
  onReroll,
  onFinish,
  canFinish,
  onRevealed,
}: Props) {
  const [mode, setMode] = useState<RevealMode>(initialMode(isFirstDestination, destinationRevealed))
  const [rouletteName, setRouletteName] = useState("")
  const [diceFaces, setDiceFaces] = useState(() => savedDiceFaces ?? [1, 4])
  const [prevStationCd, setPrevStationCd] = useState(station?.stationCd)

  const onRevealedRef = useRef(onRevealed)
  onRevealedRef.current = onRevealed

  const rideCount = useMemo(() => route?.filter((s) => s.action === "ride").length ?? 2, [route])

  if (station?.stationCd !== prevStationCd) {
    setPrevStationCd(station?.stationCd)
    if (isFirstDestination && !startRevealed) {
      setMode("hidden")
    } else {
      setMode("rolling")
    }
  }

  // Rolling phase: dice animation only
  useEffect(() => {
    if (mode !== "rolling" || !station) return
    let count = 0
    const totalCycles = 10
    let timer: ReturnType<typeof setTimeout>

    const diceCount = decideDiceCount(rideCount)
    const randomFaces = () =>
      Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1)

    function tick() {
      if (count >= totalCycles) {
        setDiceFaces(splitIntoDice(rideCount, diceCount))
        timer = setTimeout(() => setMode("bursting"), 800)
        return
      }
      setDiceFaces(randomFaces())
      count++
      timer = setTimeout(tick, 80 + count * 30)
    }

    tick()
    return () => clearTimeout(timer)
  }, [mode, station, rideCount])

  // Bursting phase: wait for burst animation to finish
  useEffect(() => {
    if (mode !== "bursting") return
    const timer = setTimeout(() => setMode("roulette"), 600)
    return () => clearTimeout(timer)
  }, [mode])

  // Roulette phase: cycle through candidate station names
  useEffect(() => {
    if (mode !== "roulette" || !station) return
    const finalName = station.name

    // 出目の合計で到達可能な駅名を候補にする
    const diceSum = diceFaces.reduce((a, b) => a + b, 0)
    const distances = computeStationDistances(graph, currentStation.stationCd)
    const candidateNames = new Set<string>()
    for (const [cd, dist] of distances) {
      if (dist > 0 && dist <= diceSum) {
        const s = graph.stations.get(cd)
        if (s) candidateNames.add(s.name)
      }
    }
    candidateNames.add(finalName)

    // 少なすぎる場合はランダムに追加
    const allNames: string[] = []
    for (const s of graph.stations.values()) {
      if (!candidateNames.has(s.name)) allNames.push(s.name)
    }
    const names = [...new Set(candidateNames)]
    while (names.length < 5 && allNames.length > 0) {
      const idx = Math.floor(Math.random() * allNames.length)
      const [picked] = allNames.splice(idx, 1)
      if (!names.includes(picked)) names.push(picked)
    }

    let count = 0
    const totalCycles = 10
    let timer: ReturnType<typeof setTimeout>

    function tick() {
      if (count >= totalCycles) {
        setRouletteName(finalName)
        timer = setTimeout(() => {
          setMode("revealed")
          onRevealedRef.current(diceFaces)
        }, 300)
        return
      }
      setRouletteName(names[Math.floor(Math.random() * names.length)])
      count++
      timer = setTimeout(tick, 60 + count * 30)
    }

    tick()
    return () => clearTimeout(timer)
  }, [mode, station, graph, currentStation, diceFaces])

  if (!station) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-zinc-500">目的地</p>
          <p className="mt-4 text-center text-lg font-medium text-zinc-400">
            到達可能な駅がありません
          </p>
        </CardContent>
      </Card>
    )
  }

  // Hidden mode: tap to start rolling
  if (mode === "hidden") {
    return (
      <Card
        className={startRevealed ? "cursor-pointer" : "opacity-60"}
        onClick={() => startRevealed && setMode("rolling")}
      >
        <CardContent className="flex flex-col items-center justify-center py-8">
          <p className="text-sm text-zinc-500">目的地決めよか</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Image
              src="/dice/dice3.svg"
              alt=""
              width={64}
              height={64}
              className={cn(
                "h-16 w-16 drop-shadow-md",
                startRevealed ? "animate-dice-tumble" : "opacity-40"
              )}
            />
            <Image
              src="/dice/dice5.svg"
              alt=""
              width={64}
              height={64}
              className={cn(
                "h-16 w-16 drop-shadow-md",
                startRevealed ? "animate-dice-tumble" : "opacity-40"
              )}
              style={startRevealed ? { animationDelay: "0.15s" } : undefined}
            />
          </div>
          <p className="mt-3 text-sm text-zinc-400">タップしてサイコロを振る</p>
        </CardContent>
      </Card>
    )
  }

  // Rolling mode: dice animation, no station name
  if (mode === "rolling") {
    return (
      <>
        <DiceRollOverlay active faces={diceFaces} />
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-zinc-500">目的地を決定中...</p>
            <h2 className="mt-4 text-3xl font-bold text-zinc-300">...</h2>
          </CardContent>
        </Card>
      </>
    )
  }

  // Bursting mode: dice burst animation, still no station name
  if (mode === "bursting") {
    return (
      <>
        <DiceRollOverlay active={false} faces={diceFaces} />
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-zinc-500">目的地を決定中...</p>
            <h2 className="mt-4 text-3xl font-bold text-zinc-300">...</h2>
          </CardContent>
        </Card>
      </>
    )
  }

  // Roulette mode: cycling station names with dice result
  if (mode === "roulette") {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-zinc-500">目的地を決定中...</p>
          <div className="mt-3 flex items-center justify-center gap-2">
            {diceFaces.map((face, i) => (
              <Image
                key={i}
                src={`/dice/dice${face}.svg`}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 drop-shadow-sm"
              />
            ))}
          </div>
          <h2 className="mt-3 text-3xl font-bold">{rouletteName}</h2>
        </CardContent>
      </Card>
    )
  }

  // Revealed mode
  return (
    <Card>
      <CardContent>
        <p className="flex items-center gap-2 text-sm text-zinc-500">
          <span className="material-symbols-outlined">map_pin_heart</span>
          目的地
        </p>
        <div className="mt-2 flex items-center justify-center gap-2">
          {diceFaces.map((face, i) => (
            <Image
              key={i}
              src={`/dice/dice${face}.svg`}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 drop-shadow-sm"
            />
          ))}
        </div>
        <h2 className="mt-2 text-3xl font-bold">{station.name}</h2>
        <div className="mt-3 flex items-center gap-2">
          <span
            className="inline-block h-4 w-4 rounded-full"
            style={{ backgroundColor: station.lineColor }}
          />
          <span className="text-sm font-medium">{station.lineName}</span>
        </div>

        <div className="mt-6 flex gap-3">
          <Button
            variant="ghost"
            onClick={onReroll}
            className="rounded-full border-2 px-5 py-4 text-sm font-bold transition-opacity hover:bg-transparent hover:opacity-90 active:opacity-80"
            style={{ borderColor: station.lineColor, color: station.lineColor }}
          >
            他にしよ
          </Button>
          <Button
            variant="ghost"
            onClick={onGo}
            className="flex-1 rounded-full py-4 text-lg font-bold text-white transition-opacity hover:bg-transparent hover:opacity-90 active:opacity-80"
            style={{ backgroundColor: station.lineColor }}
          >
            次行こ
          </Button>
        </div>

        {canFinish && (
          <Button
            variant="ghost"
            onClick={onFinish}
            className="mt-3 w-full text-sm text-zinc-400 hover:text-zinc-600"
          >
            今日はここまで
          </Button>
        )}

        {route && route.length > 0 && (
          <RouteDisplay currentStation={currentStation} steps={route} />
        )}
      </CardContent>
    </Card>
  )
}
