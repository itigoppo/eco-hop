"use client"

import { DiceRollOverlay } from "@/components/dice-roll-overlay"
import { Card, CardContent } from "@/components/ui/card"
import type { MetroGraph } from "@/lib/metro-graph"
import { cn } from "@/lib/utils/common"
import type { RouteStep, Station } from "@/types"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

interface Props {
  station: Station
  graph: MetroGraph
  pendingRoute: RouteStep[] | null
  visitedCount: number
  totalStations: number
  isHidden: boolean
  onReveal: () => void
}

function getAdjacentStations(
  graph: MetroGraph,
  station: Station
): { prev: Station | null; next: Station | null } {
  const lineCds = graph.lineStations.get(station.lineCd)
  if (!lineCds) return { prev: null, next: null }

  const idx = station.index
  const prevCd = idx > 0 ? lineCds[idx - 1] : null
  const nextCd = idx < lineCds.length - 1 ? lineCds[idx + 1] : null

  return {
    prev: prevCd ? (graph.stations.get(prevCd) ?? null) : null,
    next: nextCd ? (graph.stations.get(nextCd) ?? null) : null,
  }
}

/** スタート駅名に対応するサイコロの出目を返す（1/2:梅田、3/4:東梅田、5/6:西梅田） */
function getStartDiceFace(name: string): number {
  if (name === "東梅田") return Math.random() < 0.5 ? 3 : 4
  if (name === "西梅田") return Math.random() < 0.5 ? 5 : 6
  return Math.random() < 0.5 ? 1 : 2
}

/** ルートの最初のride先が前駅/次駅のどちらかを判定 */
function getRouteDirection(
  pendingRoute: RouteStep[] | null,
  prev: Station | null,
  next: Station | null
): "prev" | "next" | null {
  if (!pendingRoute || pendingRoute.length === 0) return null
  const firstRide = pendingRoute.find((s) => s.action === "ride")
  if (!firstRide) return null
  if (prev && firstRide.stationCd === prev.stationCd) return "prev"
  if (next && firstRide.stationCd === next.stationCd) return "next"
  return null
}

export function CurrentStation({
  station,
  graph,
  pendingRoute,
  visitedCount,
  totalStations,
  isHidden,
  onReveal,
}: Props) {
  const [phase, setPhase] = useState<"waiting" | "spinning" | "bursting" | "done">(
    isHidden ? "waiting" : "done"
  )
  const [prevIsHidden, setPrevIsHidden] = useState(isHidden)
  const [diceFace, setDiceFace] = useState(1)

  if (isHidden !== prevIsHidden) {
    setPrevIsHidden(isHidden)
    setPhase(isHidden ? "waiting" : "done")
  }
  const onRevealRef = useRef(onReveal)
  onRevealRef.current = onReveal

  // サイコロ回転 → 出目確定 → バーストへ
  useEffect(() => {
    if (phase !== "spinning") return

    let count = 0
    const totalCycles = 10
    let timer: ReturnType<typeof setTimeout>

    function tick() {
      if (count >= totalCycles) {
        setDiceFace(getStartDiceFace(station.name))
        // 出目を見せてからバーストへ
        timer = setTimeout(() => setPhase("bursting"), 800)
        return
      }
      setDiceFace(Math.floor(Math.random() * 6) + 1)
      count++
      timer = setTimeout(tick, 80 + count * 30)
    }

    tick()
    return () => clearTimeout(timer)
  }, [phase, station])

  // バースト完了後に駅を表示
  useEffect(() => {
    if (phase !== "bursting") return
    const timer = setTimeout(() => {
      setPhase("done")
      onRevealRef.current()
    }, 600) // バーストアニメーションと同じ長さ
    return () => clearTimeout(timer)
  }, [phase])

  const { prev, next } = getAdjacentStations(graph, station)
  const direction = phase === "done" ? getRouteDirection(pendingRoute, prev, next) : null

  // 待機中: タップで開始する「?」カード
  if (phase === "waiting") {
    return (
      <Card className="cursor-pointer" onClick={() => setPhase("spinning")}>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <p className="text-sm text-zinc-500">スタート地点決めよか</p>
          <Image
            src="/dice/dice1.svg"
            alt=""
            width={80}
            height={80}
            className="animate-dice-tumble mt-4 h-20 w-20 drop-shadow-md"
          />
          <p className="mt-3 text-sm text-zinc-400">タップしてサイコロを振る</p>
        </CardContent>
      </Card>
    )
  }

  // サイコロ演出中（回転 or バースト）: 駅名は非表示
  if (phase === "spinning" || phase === "bursting") {
    return (
      <>
        <DiceRollOverlay active={phase === "spinning"} faces={[diceFace]} />
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-zinc-400">スタート地点を決定中...</p>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <Card className="overflow-hidden pb-0">
      <CardContent>
        <p className="text-sm text-zinc-400">
          {visitedCount} / {totalStations} 駅訪問済み
        </p>
      </CardContent>

      <CardContent className="relative">
        {/* 右上: 路線頭文字 + 路線名 */}
        {station.stationNumber && (
          <div className="absolute top-0 right-2 flex flex-col items-end md:right-6">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: station.lineColor }}
            >
              {station.stationNumber.replace(/\d+/, "")}
            </div>
            <p className="mt-0.5 text-[10px] leading-tight font-medium">{station.lineName}</p>
            {station.lineNameEn && (
              <p className="text-[8px] leading-tight text-zinc-400">{station.lineNameEn}</p>
            )}
          </div>
        )}

        {/* 駅名 */}
        <div className="pt-7 text-center">
          {station.nameKana && <p className="text-xs text-zinc-400">{station.nameKana}</p>}
          <h2 className="text-3xl leading-tight font-bold">{station.name}</h2>
          {station.nameEn && (
            <p className="text-xs tracking-wide text-zinc-400">{station.nameEn}</p>
          )}
        </div>
      </CardContent>

      {/* 路線カラーバー（駅番号を内包） */}
      <div className="flex h-6 items-center" style={{ backgroundColor: station.lineColor }}>
        <span className="flex w-14 items-center justify-center self-stretch border-r border-white/40 text-[10px] font-bold text-white/70">
          {prev?.stationNumber ?? ""}
        </span>
        <span className="relative flex flex-1 items-center justify-center text-sm font-bold text-white">
          {direction === "prev" && (
            <span className="material-symbols-outlined absolute left-1 text-base">
              keyboard_double_arrow_left
            </span>
          )}
          {station.stationNumber ?? ""}
          {direction === "next" && (
            <span className="material-symbols-outlined absolute right-1 text-base">
              keyboard_double_arrow_right
            </span>
          )}
        </span>
        <span className="flex w-14 items-center justify-center self-stretch border-l border-white/40 text-[10px] font-bold text-white/70">
          {next?.stationNumber ?? ""}
        </span>
      </div>

      {/* 前駅・次駅 */}
      <CardContent className="pt-2 pb-3 md:pt-2">
        <div className="flex items-start justify-between">
          <div className={cn(direction === "prev" ? "text-zinc-600" : "text-zinc-300")}>
            {prev && (
              <>
                {prev.nameKana && <p className="text-[8px] leading-tight">{prev.nameKana}</p>}
                <p className="text-xs leading-tight font-medium">{prev.name}</p>
                {prev.nameEn && <p className="text-[8px] leading-tight">{prev.nameEn}</p>}
              </>
            )}
          </div>
          <div
            className={cn("text-right", direction === "next" ? "text-zinc-600" : "text-zinc-300")}
          >
            {next && (
              <>
                {next.nameKana && <p className="text-[8px] leading-tight">{next.nameKana}</p>}
                <p className="text-xs leading-tight font-medium">{next.name}</p>
                {next.nameEn && <p className="text-[8px] leading-tight">{next.nameEn}</p>}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
