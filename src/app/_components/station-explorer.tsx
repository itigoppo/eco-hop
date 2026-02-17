"use client"

import { AppHeader } from "@/components/layouts/app-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { buildGraph, findRoute, type MetroGraph } from "@/lib/metro-graph"
import { pickNextStation, pickStartStation } from "@/lib/station-picker"
import {
  clearState,
  getTodayDateString,
  loadExcludePastVisited,
  loadPastVisitedGroupCds,
  loadState,
  saveExcludePastVisited,
  saveState,
} from "@/lib/storage"
import type { HistoryEntry, PersistedState, RawMetroData, RouteStep } from "@/types"
import { useCallback, useEffect, useRef, useState } from "react"
import { AboutDialog } from "./about-dialog"
import { CurrentStation } from "./current-station"
import { NextDestination } from "./next-destination"
import { RouteMap } from "./route-map"
import { SettingsSheet } from "./settings-sheet"
import { VisitHistory } from "./visit-history"

function countUniqueStations(graph: MetroGraph): number {
  const groupCds = new Set<string>()
  for (const station of graph.stations.values()) {
    groupCds.add(station.stationGCd)
  }
  return groupCds.size
}

function makeHistoryEntry(graph: MetroGraph, stationCd: string): HistoryEntry {
  const s = graph.stations.get(stationCd)!
  return {
    stationCd: s.stationCd,
    stationGCd: s.stationGCd,
    name: s.name,
    lineName: s.lineName,
    lineColor: s.lineColor,
    timestamp: Date.now(),
  }
}

function computeRoute(
  graph: MetroGraph,
  fromCd: string,
  toCd: string | null,
  suspendedLineCds?: Set<string>
): RouteStep[] | null {
  if (!toCd) return null
  return findRoute(graph, fromCd, toCd, suspendedLineCds)
}

function initializeState(graph: MetroGraph): PersistedState {
  const startCd = pickStartStation(graph)
  const startStation = graph.stations.get(startCd)!
  const history: HistoryEntry[] = [makeHistoryEntry(graph, startCd)]
  const visitedGroupCds = [startStation.stationGCd]
  const pendingNextCd = pickNextStation(graph, startCd, new Set(visitedGroupCds), history)

  return {
    currentStationCd: startCd,
    visitedGroupCds,
    history,
    pendingNextCd,
    pendingRoute: computeRoute(graph, startCd, pendingNextCd),
    sessionDate: getTodayDateString(),
  }
}

export function StationExplorer() {
  const [graph, setGraph] = useState<MetroGraph | null>(null)
  const [state, setState] = useState<PersistedState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [excludePastVisited, setExcludePastVisited] = useState(false)
  const [startRevealed, setStartRevealed] = useState(false)
  const [destinationRevealed, setDestinationRevealed] = useState(false)
  const processing = useRef(false)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    fetch("/data/osaka_metro.json")
      .then((res) => res.json() as Promise<RawMetroData>)
      .then((data) => {
        const g = buildGraph(data)
        setGraph(g)
        setExcludePastVisited(loadExcludePastVisited())

        const saved = loadState()
        if (saved) {
          // 後方互換: sessionDate がない古いセーブに今日の日付を補完
          if (!saved.sessionDate) {
            saved.sessionDate = getTodayDateString()
          }
        }

        if (saved && saved.completed) {
          // 完了済みセッション: 完了画面を復元
          setState(saved)
          setStartRevealed(true)
          setDestinationRevealed(false)
        } else if (saved && saved.history.length > 1) {
          // 2駅目以降: 既存セーブを復元（ルーレット不要で表示済み）
          setState(saved)
          setStartRevealed(true)
          setDestinationRevealed(true)
        } else if (saved && saved.destinationRevealed) {
          // 目的地確定済み: セーブを復元
          setState(saved)
          setStartRevealed(true)
          setDestinationRevealed(true)
        } else {
          // スタート前 or 初回: アクセスのたびにランダムで再決定
          const initial = initializeState(g)
          setState(initial)
          saveState(initial)
        }
        setIsLoading(false)
      })
  }, [])

  const suspended = new Set(state?.suspendedLineCds ?? [])
  const pastGCds = excludePastVisited ? loadPastVisitedGroupCds(state?.sessionDate) : undefined

  const handleGo = useCallback(() => {
    if (!graph || !state || !state.pendingNextCd || processing.current) return
    processing.current = true
    setDestinationRevealed(false)

    const nextCd = state.pendingNextCd
    const nextStation = graph.stations.get(nextCd)!
    const newHistory = [...state.history, makeHistoryEntry(graph, nextCd)]
    const newVisited = [...state.visitedGroupCds, nextStation.stationGCd]
    const sus = new Set(state.suspendedLineCds ?? [])
    const newPending = pickNextStation(
      graph,
      nextCd,
      new Set(newVisited),
      newHistory,
      sus.size > 0 ? sus : undefined,
      pastGCds
    )

    const newState: PersistedState = {
      currentStationCd: nextCd,
      visitedGroupCds: newVisited,
      history: newHistory,
      pendingNextCd: newPending,
      pendingRoute: computeRoute(graph, nextCd, newPending, sus.size > 0 ? sus : undefined),
      suspendedLineCds: state.suspendedLineCds,
      sessionDate: state.sessionDate,
    }

    setState(newState)
    saveState(newState)
    processing.current = false
  }, [graph, state, pastGCds])

  const handleReroll = useCallback(() => {
    if (!graph || !state || processing.current) return
    processing.current = true
    setDestinationRevealed(false)
    const sus = new Set(state.suspendedLineCds ?? [])
    const newPending = pickNextStation(
      graph,
      state.currentStationCd,
      new Set(state.visitedGroupCds),
      state.history,
      sus.size > 0 ? sus : undefined,
      pastGCds
    )
    const newState: PersistedState = {
      ...state,
      pendingNextCd: newPending,
      pendingRoute: computeRoute(
        graph,
        state.currentStationCd,
        newPending,
        sus.size > 0 ? sus : undefined
      ),
      destinationRevealed: false,
    }
    setState(newState)
    saveState(newState)
    processing.current = false
  }, [graph, state, pastGCds])

  const handleSuspensionToggle = useCallback(
    (lineCd: string) => {
      if (!graph || !state) return
      const current = new Set(state.suspendedLineCds ?? [])
      if (current.has(lineCd)) current.delete(lineCd)
      else current.add(lineCd)

      const sus = current.size > 0 ? current : undefined
      const newPending = pickNextStation(
        graph,
        state.currentStationCd,
        new Set(state.visitedGroupCds),
        state.history,
        sus,
        pastGCds
      )
      const newState: PersistedState = {
        ...state,
        suspendedLineCds: [...current],
        pendingNextCd: newPending,
        pendingRoute: computeRoute(graph, state.currentStationCd, newPending, sus),
      }
      setState(newState)
      saveState(newState)
    },
    [graph, state, pastGCds]
  )

  const handleExcludePastVisitedChange = useCallback(
    (v: boolean) => {
      if (!graph || !state) return
      saveExcludePastVisited(v)
      setExcludePastVisited(v)

      const newPastGCds = v ? loadPastVisitedGroupCds(state.sessionDate) : undefined
      const sus = new Set(state.suspendedLineCds ?? [])
      const newPending = pickNextStation(
        graph,
        state.currentStationCd,
        new Set(state.visitedGroupCds),
        state.history,
        sus.size > 0 ? sus : undefined,
        newPastGCds
      )
      const newState: PersistedState = {
        ...state,
        pendingNextCd: newPending,
        pendingRoute: computeRoute(
          graph,
          state.currentStationCd,
          newPending,
          sus.size > 0 ? sus : undefined
        ),
      }
      setState(newState)
      saveState(newState)
    },
    [graph, state]
  )

  const handleFinish = useCallback(() => {
    if (!graph || !state || processing.current) return
    processing.current = true

    const newState: PersistedState = {
      ...state,
      pendingNextCd: null,
      pendingRoute: null,
      completed: true,
      destinationRevealed: false,
      diceFaces: undefined,
    }

    setState(newState)
    saveState(newState)
    setDestinationRevealed(false)
    processing.current = false
  }, [graph, state])

  const handleNewSession = useCallback(() => {
    if (!graph || processing.current) return
    processing.current = true
    const initial = initializeState(graph)
    setState(initial)
    saveState(initial)
    setStartRevealed(false)
    setDestinationRevealed(false)
    processing.current = false
  }, [graph])

  const handleReset = useCallback(() => {
    if (!graph || processing.current) return
    processing.current = true
    clearState(state?.sessionDate)
    const initial = initializeState(graph)
    setState(initial)
    saveState(initial)
    setStartRevealed(false)
    setDestinationRevealed(false)
    processing.current = false
  }, [graph, state?.sessionDate])

  if (isLoading || !graph || !state) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-zinc-400">読み込み中...</p>
      </div>
    )
  }

  const currentStation = graph.stations.get(state.currentStationCd)!
  const pendingStation = state.pendingNextCd
    ? (graph.stations.get(state.pendingNextCd) ?? null)
    : null
  const totalStations = countUniqueStations(graph)
  const uniqueVisited = new Set(state.history.map((h) => h.stationGCd)).size

  return (
    <div className="space-y-4">
      <AppHeader right={<AboutDialog />} />

      <CurrentStation
        station={currentStation}
        graph={graph}
        pendingRoute={state.pendingRoute}
        visitedCount={state.visitedGroupCds.length}
        totalStations={totalStations}
        isHidden={state.history.length <= 1 && !startRevealed}
        onReveal={() => setStartRevealed(true)}
      />

      {state.completed ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-2xl font-bold">お疲れさまでした！</p>
            <p className="mt-2 text-lg text-zinc-600">{uniqueVisited} 駅巡りました</p>
            <Button
              onClick={handleNewSession}
              className="mt-6 rounded-full px-8 py-4 text-base font-bold"
            >
              新しく始める
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          <div className="absolute top-2 right-2 z-10">
            <SettingsSheet
              graph={graph}
              suspendedLineCds={suspended}
              onSuspensionToggle={handleSuspensionToggle}
              excludePastVisited={excludePastVisited}
              onExcludePastVisitedChange={handleExcludePastVisitedChange}
            />
          </div>
          <NextDestination
            currentStation={currentStation}
            station={pendingStation}
            graph={graph}
            route={state.pendingRoute}
            isFirstDestination={state.history.length <= 1}
            startRevealed={startRevealed || state.history.length > 1}
            destinationRevealed={destinationRevealed}
            savedDiceFaces={state.diceFaces}
            onGo={handleGo}
            onReroll={handleReroll}
            onFinish={handleFinish}
            canFinish={state.history.length > 1}
            onRevealed={(faces) => {
              setDestinationRevealed(true)
              if (state) {
                const updated = { ...state, destinationRevealed: true, diceFaces: faces }
                setState(updated)
                saveState(updated)
              }
            }}
          />
        </div>
      )}

      <RouteMap
        graph={graph}
        currentStationCd={startRevealed || state.history.length > 1 ? state.currentStationCd : null}
        pendingNextCd={destinationRevealed ? state.pendingNextCd : null}
        pendingRoute={destinationRevealed ? state.pendingRoute : null}
        visitedGroupCds={new Set(state.visitedGroupCds)}
        pastVisitedGroupCds={pastGCds}
      />

      <VisitHistory
        history={startRevealed || state.history.length > 1 ? state.history : []}
        onReset={handleReset}
        sessionDate={state.sessionDate}
      />
    </div>
  )
}
