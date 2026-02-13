import type { Candidate, HistoryEntry } from "@/types"
import type { MetroGraph } from "./metro-graph"
import { computeStationDistances, getReachableStationCds } from "./metro-graph"

const UMEDA_GROUP_CD = "1160214"

/** 梅田/東梅田/西梅田からランダムにスタート駅を選ぶ */
export function pickStartStation(graph: MetroGraph): string {
  const umedaCds = graph.transferMap.get(UMEDA_GROUP_CD)
  if (!umedaCds || umedaCds.length === 0) {
    throw new Error("梅田駅群が乗換マップに見つかりません")
  }
  return umedaCds[Math.floor(Math.random() * umedaCds.length)]
}

/** 経路の駅数に応じた重み（BFS距離）。3〜6駅を最適とし、近すぎ・遠すぎを抑制する */
function routeDistWeight(dist: number): number {
  if (dist <= 1) return 0.02
  if (dist <= 2) return 0.5
  if (dist <= 6) return 1.5
  if (dist <= 9) return 0.8
  return 0.02
}

/** 直近の履歴から同一路線の連続回数を算出する（スタート駅は除外） */
function countSameLineStreak(
  graph: MetroGraph,
  currentLineCd: string,
  history: HistoryEntry[]
): number {
  let streak = 0
  for (let i = history.length - 1; i >= 1; i--) {
    const s = graph.stations.get(history[i].stationCd)
    if (!s || s.lineCd !== currentLineCd) break
    streak++
  }
  return streak
}

/**
 * 重み付きランダムで次の目的駅を選択する。
 *
 * 設計方針:
 * - 全未訪問駅が候補（どこからでも乗換経由で到達可能）
 * - 同路線3駅連続したら次は別路線を強制
 * - 路線多様性・地理的散布で15駅を広く散らす
 */
export function pickNextStation(
  graph: MetroGraph,
  currentCd: string,
  visitedGroupCds: Set<string>,
  history: HistoryEntry[],
  suspendedLineCds?: Set<string>,
  pastVisitedGroupCds?: Set<string>
): string | null {
  // 候補除外用: 当日＋過去の訪問済み駅を合算
  const allVisitedGroupCds =
    pastVisitedGroupCds && pastVisitedGroupCds.size > 0
      ? new Set([...visitedGroupCds, ...pastVisitedGroupCds])
      : visitedGroupCds
  let reachableCds = getReachableStationCds(graph, currentCd, allVisitedGroupCds)
  if (reachableCds.length === 0) return null

  // 見合わせ路線の駅を候補から除外
  if (suspendedLineCds && suspendedLineCds.size > 0) {
    const notSuspended = reachableCds.filter((cd) => {
      const s = graph.stations.get(cd)
      return s && !suspendedLineCds.has(s.lineCd)
    })
    if (notSuspended.length > 0) reachableCds = notSuspended
  }

  const current = graph.stations.get(currentCd)!
  const prevEntry = history.length >= 2 ? history[history.length - 2] : null

  // ---- フィルタ ----

  // 乗換1回以内で到達可能な路線に限定（見合わせ路線は除外）
  const oneTransferLines = new Set<string>()
  if (!suspendedLineCds?.has(current.lineCd)) {
    oneTransferLines.add(current.lineCd)
  }
  for (const cd of graph.lineStations.get(current.lineCd) ?? []) {
    const s = graph.stations.get(cd)
    if (!s) continue
    for (const tCd of graph.transferMap.get(s.stationGCd) ?? []) {
      const tStation = graph.stations.get(tCd)
      if (tStation && !suspendedLineCds?.has(tStation.lineCd)) {
        oneTransferLines.add(tStation.lineCd)
      }
    }
  }
  const withinOneTransfer = reachableCds.filter((cd) => {
    const s = graph.stations.get(cd)
    return s && oneTransferLines.has(s.lineCd)
  })
  if (withinOneTransfer.length > 0) reachableCds = withinOneTransfer

  // 初手: スタート駅と同じ路線の、乗換駅が多い方向に限定
  // （路線の端から行き止まり方向に行くのを防ぐ）
  if (history.length <= 1) {
    const sameLine = reachableCds.filter((cd) => graph.stations.get(cd)?.lineCd === current.lineCd)
    if (sameLine.length > 0) {
      // 各方向の乗換駅数を数えて、多い方向に限定
      let transfersBelow = 0
      let transfersAbove = 0
      for (const cd of graph.lineStations.get(current.lineCd) ?? []) {
        const s = graph.stations.get(cd)
        if (!s || s.stationCd === currentCd || !graph.transferMap.has(s.stationGCd)) continue
        if (s.index < current.index) transfersBelow++
        else if (s.index > current.index) transfersAbove++
      }

      const preferredDir =
        transfersAbove > transfersBelow ? 1 : transfersBelow > transfersAbove ? -1 : 0
      if (preferredDir !== 0) {
        const directed = sameLine.filter((cd) => {
          const s = graph.stations.get(cd)
          return s && (preferredDir === 1 ? s.index > current.index : s.index < current.index)
        })
        reachableCds = directed.length > 0 ? directed : sameLine
      } else {
        reachableCds = sameLine
      }
    }
  }

  // 同路線の連続上限（路線の乗換駅数に応じて制限を変える）
  // 乗換駅が少ない路線ほどBFS距離で同路線が有利になるため、制限を厳しくする
  let transferStationCount = 0
  for (const cd of graph.lineStations.get(current.lineCd) ?? []) {
    const s = graph.stations.get(cd)
    if (s && graph.transferMap.has(s.stationGCd)) transferStationCount++
  }
  const streakLimit = transferStationCount <= 1 ? 1 : transferStationCount <= 3 ? 2 : 3
  const sameLineStreak = countSameLineStreak(graph, current.lineCd, history)
  if (sameLineStreak >= streakLimit) {
    // 上限到達: 別路線を強制
    const otherLine = reachableCds.filter((cd) => graph.stations.get(cd)?.lineCd !== current.lineCd)
    if (otherLine.length > 0) reachableCds = otherLine
  } else if (sameLineStreak > 0 && sameLineStreak < 2 && streakLimit >= 2) {
    // 下限未達: 同路線を強制（2駅は乗ってから乗換）
    const sameLine = reachableCds.filter((cd) => graph.stations.get(cd)?.lineCd === current.lineCd)
    if (sameLine.length > 0) reachableCds = sameLine
  }

  // ---- 事前計算 ----

  // 訪問済み路線を収集
  const visitedLineCds = new Set<string>()
  for (const entry of history) {
    const s = graph.stations.get(entry.stationCd)
    if (s) visitedLineCds.add(s.lineCd)
  }

  // 現在駅から全駅へのBFS距離を算出
  const stationDists = computeStationDistances(graph, currentCd, suspendedLineCds)

  // BFS距離10駅超の候補を除外（遠すぎる目的地を根本的に防ぐ）
  const nearEnough = reachableCds.filter((cd) => {
    const d = stationDists.get(cd)
    return d !== undefined && d <= 10
  })
  if (nearEnough.length > 0) reachableCds = nearEnough

  // 各路線の訪問済み駅数を算出
  const visitedPerLine = new Map<string, number>()
  for (const [lineCd, stationCds] of graph.lineStations) {
    let count = 0
    for (const cd of stationCds) {
      const s = graph.stations.get(cd)
      if (s && visitedGroupCds.has(s.stationGCd)) count++
    }
    if (count > 0) visitedPerLine.set(lineCd, count)
  }

  // 訪問済み駅の座標を収集
  const visitedCoords: { lon: number; lat: number }[] = []
  const addedGCds = new Set<string>()
  for (const station of graph.stations.values()) {
    if (visitedGroupCds.has(station.stationGCd) && !addedGCds.has(station.stationGCd)) {
      addedGCds.add(station.stationGCd)
      visitedCoords.push({ lon: station.lon, lat: station.lat })
    }
  }

  // ---- 重み付け ----

  const candidates: Candidate[] = reachableCds.map((cd) => {
    const station = graph.stations.get(cd)!
    let weight = 1.0

    // 1. 直前の駅への折返し禁止
    if (prevEntry && station.stationGCd === prevEntry.stationGCd) {
      return { station, weight: 0.0 }
    }

    // 2. 経路の駅数（BFS距離）で距離を評価
    const routeDist = stationDists.get(cd) ?? 999
    weight *= routeDistWeight(routeDist)

    // 3. 路線多様性
    // 未乗路線を優遇
    if (!visitedLineCds.has(station.lineCd)) {
      weight *= 2.5
    }
    // 訪問済み駅数に応じて段階的に抑制（1駅ごとに約半減）
    const lineVisitCount = visitedPerLine.get(station.lineCd) ?? 0
    if (lineVisitCount > 0) {
      weight *= Math.pow(0.55, lineVisitCount)
    }

    // 4. 訪問済み駅との地理的距離（遠いほど優遇して散らす）
    if (visitedCoords.length > 0) {
      let minDist = Infinity
      for (const vc of visitedCoords) {
        const d = Math.sqrt((station.lon - vc.lon) ** 2 + (station.lat - vc.lat) ** 2)
        if (d < minDist) minDist = d
      }
      weight *= Math.min(0.7 + minDist * 20, 1.8)
    }

    // 6. 訪問済み隣接駅を抑制（隣接する訪問済み駅1つにつき重み半減）
    const adjCds = graph.adjacency.get(cd) ?? []
    let visitedNeighborCount = 0
    for (const adjCd of adjCds) {
      const adj = graph.stations.get(adjCd)
      if (adj && visitedGroupCds.has(adj.stationGCd)) visitedNeighborCount++
    }
    if (visitedNeighborCount > 0) {
      weight *= Math.pow(0.5, visitedNeighborCount)
    }

    return { station, weight }
  })

  return weightedRandom(candidates)
}

/** 重み付きランダム選択。全候補の重みが0以下の場合は均等ランダムにフォールバック */
function weightedRandom(candidates: Candidate[]): string | null {
  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0)
  if (totalWeight <= 0) {
    if (candidates.length === 0) return null
    return candidates[Math.floor(Math.random() * candidates.length)].station.stationCd
  }

  let random = Math.random() * totalWeight
  for (const candidate of candidates) {
    random -= candidate.weight
    if (random <= 0) return candidate.station.stationCd
  }
  return candidates[candidates.length - 1].station.stationCd
}
