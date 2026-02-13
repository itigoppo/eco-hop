"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { MetroGraph } from "@/lib/metro-graph"
import { cn } from "@/lib/utils/common"
import { useCallback, useMemo, useRef, useState } from "react"

import type { RouteStep } from "@/types"
import { SimpleLineView } from "./simple-line-view"

interface Props {
  graph: MetroGraph
  currentStationCd: string | null
  pendingNextCd: string | null
  pendingRoute: RouteStep[] | null
  visitedGroupCds: Set<string>
  pastVisitedGroupCds?: Set<string>
}

// 座標の範囲（大阪メトロ全駅 + 余白）
const LON_MIN = 135.405
const LON_MAX = 135.6
const LAT_MIN = 34.55
const LAT_MAX = 34.77

// SVG内部の論理サイズ
const SVG_W = 400
const SVG_H = 450
const PAD = 20

const INITIAL_SCALE = 3
const MIN_SCALE = 1
const MAX_SCALE = 5

/** 経度・緯度 → SVG座標に変換 */
function project(lon: number, lat: number): { x: number; y: number } {
  return {
    x: PAD + ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * (SVG_W - PAD * 2),
    // 緯度は上が北なのでY軸を反転
    y: PAD + ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * (SVG_H - PAD * 2),
  }
}

/** 2点間の距離 */
function pinchDist(
  t1: { clientX: number; clientY: number },
  t2: { clientX: number; clientY: number }
): number {
  const dx = t1.clientX - t2.clientX
  const dy = t1.clientY - t2.clientY
  return Math.sqrt(dx * dx + dy * dy)
}

interface ViewState {
  scale: number
  tx: number // SVG座標系でのオフセット
  ty: number
}

export function RouteMap({
  graph,
  currentStationCd,
  pendingNextCd,
  pendingRoute,
  visitedGroupCds,
  pastVisitedGroupCds,
}: Props) {
  const [mode, setMode] = useState<"map" | "simple">("map")

  const [tooltip, setTooltip] = useState<{
    name: string
    lineName: string
    lineColor: string
    x: number
    y: number
  } | null>(null)

  // 現在駅・目的地から中心座標を算出
  const autoCenter = useMemo(() => {
    if (!currentStationCd) return { tx: 0, ty: 0 }
    const cur = graph.stations.get(currentStationCd)
    if (!cur) return { tx: 0, ty: 0 }
    const pend = pendingNextCd ? graph.stations.get(pendingNextCd) : null
    const p1 = project(cur.lon, cur.lat)
    if (pend) {
      const p2 = project(pend.lon, pend.lat)
      return {
        tx: SVG_W / 2 - (p1.x + p2.x) / 2,
        ty: SVG_H / 2 - (p1.y + p2.y) / 2,
      }
    }
    return { tx: SVG_W / 2 - p1.x, ty: SVG_H / 2 - p1.y }
  }, [currentStationCd, pendingNextCd, graph])

  // ズーム・パン状態（autoCenter が変わるたびにリセット）
  const [view, setView] = useState<ViewState>({
    scale: INITIAL_SCALE,
    ...autoCenter,
  })
  const [prevCenter, setPrevCenter] = useState(autoCenter)
  if (prevCenter !== autoCenter) {
    setPrevCenter(autoCenter)
    setView((v) => ({ ...v, tx: autoCenter.tx, ty: autoCenter.ty }))
  }
  const svgRef = useRef<SVGSVGElement>(null)

  // ドラッグ用
  const dragRef = useRef<{
    startX: number
    startY: number
    startTx: number
    startTy: number
  } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // ピンチ用
  const pinchRef = useRef<{
    startDist: number
    startScale: number
    midX: number
    midY: number
  } | null>(null)

  const currentStation = currentStationCd ? graph.stations.get(currentStationCd) : undefined
  const pendingStation = pendingNextCd ? graph.stations.get(pendingNextCd) : null

  // viewBox を計算
  const viewBox = useMemo(() => {
    const w = SVG_W / view.scale
    const h = SVG_H / view.scale
    // 中心をオフセット
    const cx = SVG_W / 2 - view.tx
    const cy = SVG_H / 2 - view.ty
    return `${cx - w / 2} ${cy - h / 2} ${w} ${h}`
  }, [view])

  // --- マウスホイールでズーム ---
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setView((v) => ({
      ...v,
      scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * delta)),
    }))
  }, [])

  // --- マウスドラッグ ---
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // 駅をクリックした場合はドラッグしない
      if ((e.target as Element).tagName === "circle") return
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startTx: view.tx,
        startTy: view.ty,
      }
      setIsDragging(true)
    },
    [view.tx, view.ty]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragRef.current || !svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      // マウス移動量をSVG座標系に変換
      const dx = ((e.clientX - dragRef.current.startX) / rect.width) * (SVG_W / view.scale)
      const dy = ((e.clientY - dragRef.current.startY) / rect.height) * (SVG_H / view.scale)
      setView((v) => ({
        ...v,
        tx: dragRef.current!.startTx + dx,
        ty: dragRef.current!.startTy + dy,
      }))
    },
    [view.scale]
  )

  const handleMouseUp = useCallback(() => {
    dragRef.current = null
    setIsDragging(false)
  }, [])

  // --- タッチ操作（ドラッグ + ピンチズーム） ---
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        // ピンチ開始
        const dist = pinchDist(e.touches[0], e.touches[1])
        pinchRef.current = {
          startDist: dist,
          startScale: view.scale,
          midX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          midY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        }
        dragRef.current = null
        setIsDragging(false)
      } else if (e.touches.length === 1) {
        // 駅をタップした場合はドラッグしない
        if ((e.target as Element).tagName === "circle") return
        dragRef.current = {
          startX: e.touches[0].clientX,
          startY: e.touches[0].clientY,
          startTx: view.tx,
          startTy: view.ty,
        }
        setIsDragging(true)
      }
    },
    [view.scale, view.tx, view.ty]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        // ピンチズーム
        const dist = pinchDist(e.touches[0], e.touches[1])
        const newScale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, pinchRef.current.startScale * (dist / pinchRef.current.startDist))
        )
        setView((v) => ({ ...v, scale: newScale }))
      } else if (e.touches.length === 1 && dragRef.current && svgRef.current) {
        // ドラッグ
        const rect = svgRef.current.getBoundingClientRect()
        const dx =
          ((e.touches[0].clientX - dragRef.current.startX) / rect.width) * (SVG_W / view.scale)
        const dy =
          ((e.touches[0].clientY - dragRef.current.startY) / rect.height) * (SVG_H / view.scale)
        setView((v) => ({
          ...v,
          tx: dragRef.current!.startTx + dx,
          ty: dragRef.current!.startTy + dy,
        }))
      }
    },
    [view.scale]
  )

  const handleTouchEnd = useCallback(() => {
    dragRef.current = null
    pinchRef.current = null
    setIsDragging(false)
  }, [])

  // --- 駅タップ/クリック ---
  const handleStationClick = useCallback(
    (dot: {
      name: string
      lineName: string
      lineColor: string
      x: number
      y: number
      stationGCd: string
    }) => {
      setTooltip((prev) =>
        prev?.x === dot.x && prev?.y === dot.y
          ? null
          : {
              name: dot.name,
              lineName: dot.lineName,
              lineColor: dot.lineColor,
              x: dot.x,
              y: dot.y,
            }
      )
    },
    []
  )

  // SVG背景タップでツールチップを閉じる
  const handleBgClick = useCallback(() => {
    setTooltip(null)
  }, [])

  // リセットズーム
  const handleResetZoom = useCallback(() => {
    setView({ scale: 1, tx: 0, ty: 0 })
    setTooltip(null)
  }, [])

  // --- データ構築 ---
  const lineSegments = useMemo(() => {
    const segments: {
      lineCd: string
      color: string
      points: { x1: number; y1: number; x2: number; y2: number }[]
    }[] = []

    for (const [lineCd, stationCds] of graph.lineStations) {
      const firstStation = graph.stations.get(stationCds[0])
      if (!firstStation) continue

      const points: { x1: number; y1: number; x2: number; y2: number }[] = []
      for (let i = 0; i < stationCds.length - 1; i++) {
        const s1 = graph.stations.get(stationCds[i])
        const s2 = graph.stations.get(stationCds[i + 1])
        if (!s1 || !s2) continue
        const p1 = project(s1.lon, s1.lat)
        const p2 = project(s2.lon, s2.lat)
        points.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y })
      }

      segments.push({ lineCd, color: firstStation.lineColor, points })
    }
    return segments
  }, [graph])

  const stationDots = useMemo(() => {
    const seen = new Set<string>()
    const dots: {
      stationCd: string
      stationGCd: string
      name: string
      lineName: string
      lineColor: string
      x: number
      y: number
    }[] = []

    for (const station of graph.stations.values()) {
      if (seen.has(station.stationGCd)) continue
      seen.add(station.stationGCd)
      const p = project(station.lon, station.lat)
      dots.push({
        stationCd: station.stationCd,
        stationGCd: station.stationGCd,
        name: station.name,
        lineName: station.lineName,
        lineColor: station.lineColor,
        x: p.x,
        y: p.y,
      })
    }
    return dots
  }, [graph])

  // ズーム率に応じた要素サイズの調整（拡大時に巨大にならないよう）
  const adj = 1 / view.scale

  return (
    <Card>
      <CardContent>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm text-zinc-500">路線図</p>
          <div className="flex gap-1">
            {mode === "map" && view.scale > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetZoom}
                className="h-auto rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500"
              >
                全体表示
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode(mode === "map" ? "simple" : "map")}
              className="h-auto rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500"
            >
              {mode === "map" ? "シンプル" : "マップ"}
            </Button>
          </div>
        </div>
        {mode === "simple" ? (
          <SimpleLineView
            graph={graph}
            currentStationCd={currentStationCd}
            pendingNextCd={pendingNextCd}
            pendingRoute={pendingRoute}
            visitedGroupCds={visitedGroupCds}
            pastVisitedGroupCds={pastVisitedGroupCds}
          />
        ) : (
          <>
            <svg
              ref={svgRef}
              viewBox={viewBox}
              className={cn(
                "max-h-[500px] w-full touch-none select-none",
                isDragging ? "cursor-grabbing" : "cursor-grab"
              )}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onClick={handleBgClick}
            >
              {/* 路線の線分（白縁で重なりを分離） */}
              {lineSegments.map((line) =>
                line.points.map((p, i) => (
                  <line
                    key={`bg-${line.lineCd}-${i}`}
                    x1={p.x1}
                    y1={p.y1}
                    x2={p.x2}
                    y2={p.y2}
                    stroke="#fff"
                    strokeWidth={Math.max(3, 5 * adj)}
                    strokeLinecap="round"
                    className=""
                  />
                ))
              )}
              {lineSegments.map((line) =>
                line.points.map((p, i) => (
                  <line
                    key={`${line.lineCd}-${i}`}
                    x1={p.x1}
                    y1={p.y1}
                    x2={p.x2}
                    y2={p.y2}
                    stroke={line.color}
                    strokeWidth={Math.max(2, 3.5 * adj)}
                    strokeLinecap="round"
                    strokeOpacity={0.8}
                  />
                ))
              )}

              {/* 乗換接続（点線） */}
              {Array.from(graph.transferMap.values()).map((cds) => {
                if (cds.length < 2) return null
                const positions = cds
                  .map((cd) => graph.stations.get(cd))
                  .filter(Boolean)
                  .map((s) => project(s!.lon, s!.lat))
                if (positions.length < 2) return null
                return (
                  <line
                    key={cds.join("-")}
                    x1={positions[0].x}
                    y1={positions[0].y}
                    x2={positions[positions.length - 1].x}
                    y2={positions[positions.length - 1].y}
                    stroke="#999"
                    strokeWidth={0.5 * adj}
                    strokeDasharray={`${2 * adj},${2 * adj}`}
                  />
                )
              })}

              {/* 駅の丸 */}
              {stationDots.map((dot) => {
                const isVisited = visitedGroupCds.has(dot.stationGCd)
                const isPastVisited =
                  !isVisited && (pastVisitedGroupCds?.has(dot.stationGCd) ?? false)
                const isCurrent = currentStation?.stationGCd === dot.stationGCd
                const isPending = pendingStation?.stationGCd === dot.stationGCd

                const isTransfer = graph.transferMap.has(dot.stationGCd)
                let fill = "#fff"
                let stroke = "#ccc"
                let r = isTransfer ? 4.5 * adj : 3.5 * adj
                let sw = 1.2 * adj
                let opacity = 1

                if (isPastVisited) {
                  fill = "transparent"
                  stroke = dot.lineColor
                  r = isTransfer ? 4.5 * adj : 3.5 * adj
                  sw = 1.5 * adj
                  opacity = 0.6
                }
                if (isVisited) {
                  fill = dot.lineColor
                  stroke = "#fff"
                  r = isTransfer ? 5 * adj : 4 * adj
                  sw = 1.5 * adj
                }
                if (isPending) {
                  fill = "#fff"
                  stroke = pendingStation!.lineColor
                  r = 7 * adj
                  sw = 3 * adj
                  opacity = 1
                }
                if (isCurrent) {
                  fill = currentStation!.lineColor
                  stroke = "#fff"
                  r = 8 * adj
                  sw = 3 * adj
                  opacity = 1
                }

                return (
                  <circle
                    key={dot.stationGCd}
                    cx={dot.x}
                    cy={dot.y}
                    r={r}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={sw}
                    opacity={opacity}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStationClick(dot)
                    }}
                    className="cursor-pointer"
                  />
                )
              })}

              {/* 訪問済み駅のラベル */}
              {stationDots.map((dot) => {
                const isVisited = visitedGroupCds.has(dot.stationGCd)
                const isPastVisited =
                  !isVisited && (pastVisitedGroupCds?.has(dot.stationGCd) ?? false)
                const isCurrent = currentStation?.stationGCd === dot.stationGCd
                const isPending = pendingStation?.stationGCd === dot.stationGCd
                if ((!isVisited && !isPastVisited) || isCurrent || isPending) return null
                return (
                  <text
                    key={`vlabel-${dot.stationGCd}`}
                    x={dot.x}
                    y={dot.y - 6 * adj}
                    textAnchor="middle"
                    fontSize={7 * adj}
                    fontWeight="bold"
                    fill={dot.lineColor}
                    fillOpacity={isPastVisited ? 0.5 : 0.7}
                    className="pointer-events-none"
                  >
                    {dot.name}
                  </text>
                )
              })}

              {/* 現在駅のラベル */}
              {currentStation &&
                (() => {
                  const p = project(currentStation.lon, currentStation.lat)
                  return (
                    <text
                      x={p.x}
                      y={p.y - 10 * adj}
                      textAnchor="middle"
                      fontSize={10 * adj}
                      fontWeight="bold"
                      fill={currentStation.lineColor}
                      className="pointer-events-none"
                    >
                      {currentStation.name}
                    </text>
                  )
                })()}

              {/* 次の目的地のラベル */}
              {pendingStation &&
                (() => {
                  const p = project(pendingStation.lon, pendingStation.lat)
                  return (
                    <text
                      x={p.x}
                      y={p.y - 9 * adj}
                      textAnchor="middle"
                      fontSize={9 * adj}
                      fontWeight="bold"
                      fill={pendingStation.lineColor}
                      className="pointer-events-none"
                    >
                      {pendingStation.name}
                    </text>
                  )
                })()}

              {/* ズームしたとき全駅名を表示 */}
              {view.scale >= 2 &&
                stationDots.map((dot) => {
                  const isCurrent = currentStation?.stationGCd === dot.stationGCd
                  const isPending = pendingStation?.stationGCd === dot.stationGCd
                  const isVisited = visitedGroupCds.has(dot.stationGCd)
                  const isPastVisited = pastVisitedGroupCds?.has(dot.stationGCd) ?? false
                  if (isCurrent || isPending || isVisited || isPastVisited) return null
                  return (
                    <text
                      key={`label-${dot.stationGCd}`}
                      x={dot.x}
                      y={dot.y - 5 * adj}
                      textAnchor="middle"
                      fontSize={6.5 * adj}
                      fill="#999"
                      className="pointer-events-none"
                    >
                      {dot.name}
                    </text>
                  )
                })}

              {/* タップで表示するツールチップ */}
              {tooltip && (
                <g className="pointer-events-none">
                  <rect
                    x={tooltip.x + 6 * adj}
                    y={tooltip.y - 22 * adj}
                    width={(tooltip.name.length + tooltip.lineName.length + 1) * 7 * adj + 12 * adj}
                    height={18 * adj}
                    rx={4 * adj}
                    fill="rgba(0,0,0,0.85)"
                  />
                  <text
                    x={tooltip.x + 12 * adj}
                    y={tooltip.y - 9 * adj}
                    fontSize={10 * adj}
                    fill="#fff"
                  >
                    {tooltip.name}
                  </text>
                  <text
                    x={tooltip.x + 12 * adj + (tooltip.name.length * 7 + 4) * adj}
                    y={tooltip.y - 9 * adj}
                    fontSize={8 * adj}
                    fill={tooltip.lineColor}
                  >
                    {tooltip.lineName}
                  </text>
                </g>
              )}
            </svg>

            {/* 凡例 */}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-500">
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-full border-2 border-zinc-800 bg-zinc-800" />
                現在地
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-full border-2 border-zinc-500 bg-white" />
                次の目的地
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-zinc-400" />
                訪問済み
              </span>
              {pastVisitedGroupCds && pastVisitedGroupCds.size > 0 && (
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full border-[1.5px] border-zinc-400 bg-transparent" />
                  過去訪問済み
                </span>
              )}
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full border border-zinc-300 bg-white" />
                未訪問
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
