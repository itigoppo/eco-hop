"use client"

import type { MetroGraph } from "@/lib/metro-graph"
import type { RouteStep } from "@/types"
import { useEffect, useMemo, useRef } from "react"

interface Props {
  graph: MetroGraph
  currentStationCd: string | null
  pendingNextCd: string | null
  pendingRoute: RouteStep[] | null
  visitedGroupCds: Set<string>
  pastVisitedGroupCds?: Set<string>
}

const COL_W = 20
const DOT_Y = 41
const ROW_H = 52

/**
 * 全駅のグローバルカラム割り当て（トポロジカルソート最長パス）。
 * 各路線内の駅順序を制約としてDAGを構築し、乗換駅が同一カラムに揃うようにする。
 */
function computeColumnMap(graph: MetroGraph): {
  colOf: Map<string, number>
  total: number
} {
  const edges = new Map<string, Set<string>>()
  const inDeg = new Map<string, number>()
  const allGCds = new Set<string>()

  for (const [, stationCds] of graph.lineStations) {
    let prevGCd: string | null = null
    for (const cd of stationCds) {
      const gCd = graph.stations.get(cd)!.stationGCd
      allGCds.add(gCd)
      if (!edges.has(gCd)) edges.set(gCd, new Set())
      if (!inDeg.has(gCd)) inDeg.set(gCd, inDeg.get(gCd) ?? 0)

      if (prevGCd && prevGCd !== gCd && !edges.get(prevGCd)!.has(gCd)) {
        edges.get(prevGCd)!.add(gCd)
        inDeg.set(gCd, (inDeg.get(gCd) ?? 0) + 1)
      }
      prevGCd = gCd
    }
  }

  const col = new Map<string, number>()
  const remaining = new Map<string, number>()
  const queue: string[] = []

  for (const gCd of allGCds) {
    col.set(gCd, 0)
    remaining.set(gCd, inDeg.get(gCd) ?? 0)
    if ((inDeg.get(gCd) ?? 0) === 0) queue.push(gCd)
  }

  while (queue.length > 0) {
    const cur = queue.shift()!
    const cc = col.get(cur)!
    for (const next of edges.get(cur) ?? []) {
      if (cc + 1 > (col.get(next) ?? 0)) col.set(next, cc + 1)
      const r = (remaining.get(next) ?? 1) - 1
      remaining.set(next, r)
      if (r === 0) queue.push(next)
    }
  }

  let maxCol = 0
  for (const c of col.values()) if (c > maxCol) maxCol = c

  return { colOf: col, total: maxCol + 1 }
}

/** シンプル表示: 各路線を横一列に表示（乗換駅の縦位置が揃う） */
export function SimpleLineView({
  graph,
  currentStationCd,
  pendingNextCd,
  pendingRoute,
  visitedGroupCds,
  pastVisitedGroupCds,
}: Props) {
  const currentStation = currentStationCd ? graph.stations.get(currentStationCd) : undefined
  const pendingStation = pendingNextCd ? graph.stations.get(pendingNextCd) : null

  const transferGCds = useMemo(() => {
    const set = new Set<string>()
    if (!pendingRoute) return set
    for (const step of pendingRoute) {
      if (step.action === "transfer") {
        const s = graph.stations.get(step.stationCd)
        if (s) set.add(s.stationGCd)
      }
    }
    return set
  }, [pendingRoute, graph])

  const routeStationCds = useMemo(() => {
    const set = new Set<string>()
    if (!pendingRoute) return set
    if (currentStationCd) set.add(currentStationCd)
    for (const step of pendingRoute) {
      if (step.action === "ride") set.add(step.stationCd)
    }
    return set
  }, [pendingRoute, currentStationCd])

  const { colOf, total, lines } = useMemo(() => {
    const { colOf, total } = computeColumnMap(graph)

    const lines: {
      lineCd: string
      lineName: string
      lineColor: string
      stations: {
        stationCd: string
        stationGCd: string
        name: string
        col: number
      }[]
    }[] = []

    for (const [lineCd, stationCds] of graph.lineStations) {
      const first = graph.stations.get(stationCds[0])
      if (!first) continue
      lines.push({
        lineCd,
        lineName: first.lineName,
        lineColor: first.lineColor,
        stations: stationCds.map((cd) => {
          const s = graph.stations.get(cd)!
          return {
            stationCd: s.stationCd,
            stationGCd: s.stationGCd,
            name: s.name,
            col: colOf.get(s.stationGCd) ?? 0,
          }
        }),
      })
    }

    return { colOf, total, lines }
  }, [graph])

  const scrollRef = useRef<HTMLDivElement>(null)
  const currentCol = colOf.get(currentStation?.stationGCd ?? "") ?? 0

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const targetX = currentCol * COL_W - el.clientWidth / 2
    el.scrollLeft = Math.max(0, targetX)
  }, [currentCol])

  return (
    <div ref={scrollRef} className="overflow-x-auto pb-2">
      <div style={{ width: total * COL_W }}>
        {lines.map((line) => {
          const visitedCount = line.stations.filter((s) => visitedGroupCds.has(s.stationGCd)).length
          const firstCol = line.stations[0].col
          const lastCol = line.stations[line.stations.length - 1].col

          return (
            <div key={line.lineCd} className="mb-1">
              <div className="mb-0.5 flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: line.lineColor }}
                />
                <span className="text-xs font-bold" style={{ color: line.lineColor }}>
                  {line.lineName}
                </span>
                <span className="text-[10px] text-zinc-400">
                  {visitedCount}/{line.stations.length}
                </span>
              </div>
              <div className="relative" style={{ height: ROW_H }}>
                {/* 路線のライン */}
                <div
                  className="absolute"
                  style={{
                    left: firstCol * COL_W + COL_W / 2,
                    width: (lastCol - firstCol) * COL_W,
                    top: DOT_Y,
                    height: 2,
                    backgroundColor: line.lineColor,
                    opacity: 0.3,
                  }}
                />
                {/* 駅 */}
                {line.stations.map((s) => {
                  const isVisited = visitedGroupCds.has(s.stationGCd)
                  const isPastVisited =
                    !isVisited && (pastVisitedGroupCds?.has(s.stationGCd) ?? false)
                  const isCurrent = currentStation?.stationGCd === s.stationGCd
                  const isPending = pendingStation?.stationGCd === s.stationGCd
                  const isTransfer = transferGCds.has(s.stationGCd)
                  const isOnRoute = routeStationCds.has(s.stationCd)
                  const showLabel =
                    isCurrent || isPending || isVisited || isPastVisited || isTransfer
                  const dotSize = isCurrent
                    ? 10
                    : isPending || isTransfer
                      ? 9
                      : isVisited
                        ? 7
                        : isPastVisited
                          ? 6
                          : isOnRoute
                            ? 6
                            : 5

                  return (
                    <div
                      key={s.stationCd}
                      className="absolute"
                      style={{
                        left: s.col * COL_W,
                        width: COL_W,
                        height: ROW_H,
                      }}
                    >
                      {/* 駅名（縦書き） */}
                      {showLabel && (
                        <div
                          className="absolute flex justify-center"
                          style={{
                            left: 0,
                            width: COL_W,
                            top: 0,
                            height: DOT_Y - 6,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 7,
                              fontWeight: isCurrent || isPending || isTransfer ? "bold" : "normal",
                              color:
                                isTransfer && !isCurrent && !isPending ? "#f59e0b" : line.lineColor,
                              opacity: isPastVisited
                                ? 0.5
                                : isVisited && !isCurrent && !isPending && !isTransfer
                                  ? 0.6
                                  : 1,
                              writingMode: "vertical-rl",
                              lineHeight: 1,
                              overflow: "hidden",
                            }}
                          >
                            {s.name}
                          </span>
                        </div>
                      )}
                      {/* ドット */}
                      <div
                        className="absolute rounded-full"
                        style={{
                          left: COL_W / 2 - dotSize / 2,
                          top: DOT_Y - dotSize / 2,
                          width: dotSize,
                          height: dotSize,
                          backgroundColor: isCurrent
                            ? line.lineColor
                            : isTransfer
                              ? "#f59e0b"
                              : isPending || isPastVisited
                                ? "transparent"
                                : isOnRoute
                                  ? line.lineColor
                                  : isVisited
                                    ? line.lineColor
                                    : "#e4e4e7",
                          border: isPending
                            ? `2px solid ${line.lineColor}`
                            : isCurrent
                              ? "2px solid #fff"
                              : isTransfer
                                ? "2px solid #fff"
                                : isPastVisited
                                  ? `1.5px solid ${line.lineColor}`
                                  : "none",
                          boxShadow: isCurrent
                            ? `0 0 0 1px ${line.lineColor}`
                            : isTransfer
                              ? "0 0 0 1px #f59e0b"
                              : "none",
                          opacity:
                            isOnRoute && !isCurrent && !isPending && !isTransfer && !isVisited
                              ? 0.5
                              : 1,
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
