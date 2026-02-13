import type { RawMetroData, RouteStep, Station } from "@/types"

export interface MetroGraph {
  stations: Map<string, Station>
  adjacency: Map<string, string[]>
  transferMap: Map<string, string[]>
  lineStations: Map<string, string[]>
}

/** JSONデータからグラフ構造を構築する */
export function buildGraph(data: RawMetroData): MetroGraph {
  const stations = new Map<string, Station>()
  const adjacency = new Map<string, string[]>()
  const transferMap = new Map<string, string[]>()
  const lineStations = new Map<string, string[]>()

  for (const line of data.lines) {
    const orderedCds: string[] = []

    for (let i = 0; i < line.stations.length; i++) {
      const raw = line.stations[i]
      stations.set(raw.station_cd, {
        stationCd: raw.station_cd,
        stationGCd: raw.station_g_cd,
        name: raw.name,
        stationNumber: raw.station_number,
        nameKana: raw.name_kana,
        nameEn: raw.name_en,
        lineCd: line.line_cd,
        lineName: line.name,
        lineNameEn: line.name_en,
        lineColor: line.color,
        index: i,
        lon: raw.lon,
        lat: raw.lat,
      })
      orderedCds.push(raw.station_cd)
    }

    lineStations.set(line.line_cd, orderedCds)

    // 隣接駅の双方向リンクを構築
    for (const conn of line.connections) {
      const a = adjacency.get(conn.from) ?? []
      a.push(conn.to)
      adjacency.set(conn.from, a)

      const b = adjacency.get(conn.to) ?? []
      b.push(conn.from)
      adjacency.set(conn.to, b)
    }
  }

  // 乗換マップを構築（station_g_cd → 各路線のstation_cd一覧）
  for (const transfer of data.transfers) {
    const cds = transfer.stations.map((s) => s.station_cd)
    transferMap.set(transfer.station_g_cd, cds)
  }

  return { stations, adjacency, transferMap, lineStations }
}

/**
 * 未訪問の全駅を候補として返す。
 * どの駅からでも乗換を経由して全駅に到達可能なため、
 * ネットワーク全体から未訪問駅を返す。
 * 同じ物理駅（station_g_cd）が複数路線にある場合は現在路線版を優先。
 */
export function getReachableStationCds(
  graph: MetroGraph,
  currentCd: string,
  visitedGroupCds: Set<string>
): string[] {
  const current = graph.stations.get(currentCd)
  if (!current) return []

  const byGroupCd = new Map<string, string>()
  for (const station of graph.stations.values()) {
    if (station.stationCd === currentCd) continue
    if (visitedGroupCds.has(station.stationGCd)) continue

    const existing = byGroupCd.get(station.stationGCd)
    if (!existing) {
      byGroupCd.set(station.stationGCd, station.stationCd)
    } else {
      // 同一路線版があればそちらを優先
      if (station.lineCd === current.lineCd) {
        byGroupCd.set(station.stationGCd, station.stationCd)
      }
    }
  }

  return Array.from(byGroupCd.values())
}

/**
 * 同一路線上の2駅間のホップ数（駅数）を返す。
 * 異なる路線の場合はnullを返す。
 */
export function getHopCount(graph: MetroGraph, fromCd: string, toCd: string): number | null {
  const from = graph.stations.get(fromCd)
  const to = graph.stations.get(toCd)
  if (!from || !to || from.lineCd !== to.lineCd) return null
  return Math.abs(to.index - from.index)
}

/**
 * 指定駅から全駅への最短経路の駅数（BFS）を返す。
 * 乗換は最大1回まで。状態 (stationCd, transfersUsed) で探索し、
 * 2回以上乗換が必要な駅は到達不能（結果に含まれない or 非常に遠い）となる。
 */
export function computeStationDistances(
  graph: MetroGraph,
  fromCd: string,
  suspendedLineCds?: Set<string>
): Map<string, number> {
  // 乗換0回/1回 それぞれの最短距離を管理
  const dist0 = new Map<string, number>() // 乗換0回で到達
  const dist1 = new Map<string, number>() // 乗換1回で到達

  const queue: [string, number][] = [[fromCd, 0]]
  dist0.set(fromCd, 0)

  while (queue.length > 0) {
    const [current, transfers] = queue.shift()!
    const distMap = transfers === 0 ? dist0 : dist1
    const currentDist = distMap.get(current)!
    const station = graph.stations.get(current)
    if (!station) continue

    // 見合わせ路線の隣接駅はスキップ（電車に乗れない）
    if (!suspendedLineCds?.has(station.lineCd)) {
      for (const adj of graph.adjacency.get(current) ?? []) {
        if (!distMap.has(adj)) {
          distMap.set(adj, currentDist + 1)
          queue.push([adj, transfers])
        }
      }
    }

    // 乗換（0回→1回のみ許可、物理的移動なので見合わせに関係なく可能）
    if (transfers === 0) {
      for (const tCd of graph.transferMap.get(station.stationGCd) ?? []) {
        if (tCd !== current && !dist1.has(tCd)) {
          dist1.set(tCd, currentDist + 1)
          queue.push([tCd, 1])
        }
      }
    }
  }

  // 乗換0回と1回の最小距離をマージ
  const result = new Map<string, number>()
  for (const [cd, d] of dist0) {
    result.set(cd, d)
  }
  for (const [cd, d] of dist1) {
    const existing = result.get(cd)
    if (existing === undefined || d < existing) {
      result.set(cd, d)
    }
  }

  return result
}

/**
 * 乗換回数を最小化し、同一乗換回数なら移動距離を最小化する経路探索。
 * 乗換=コスト100、同一路線の移動=コスト1 の Dijkstra で実現。
 * 出発駅を除き、目的地を含むステップのリストを返す。
 */
export function findRoute(
  graph: MetroGraph,
  fromCd: string,
  toCd: string,
  suspendedLineCds?: Set<string>
): RouteStep[] {
  if (fromCd === toCd) return []

  const TRANSFER_COST = 100

  // Dijkstra: 隣接駅=コスト1、乗換=コスト3
  const dist = new Map<string, number>()
  const prev = new Map<string, string>()
  const pq: [number, string][] = [[0, fromCd]]
  dist.set(fromCd, 0)
  prev.set(fromCd, "")

  while (pq.length > 0) {
    // 最小コストのノードを取得
    let minIdx = 0
    for (let i = 1; i < pq.length; i++) {
      if (pq[i][0] < pq[minIdx][0]) minIdx = i
    }
    const [currentDist, current] = pq[minIdx]
    pq.splice(minIdx, 1)

    if (current === toCd) break
    if (currentDist > (dist.get(current) ?? Infinity)) continue

    const station = graph.stations.get(current)
    if (!station) continue

    // 同一路線の隣接駅（コスト1、見合わせ路線はスキップ）
    if (!suspendedLineCds?.has(station.lineCd)) {
      for (const adj of graph.adjacency.get(current) ?? []) {
        const newDist = currentDist + 1
        if (newDist < (dist.get(adj) ?? Infinity)) {
          dist.set(adj, newDist)
          prev.set(adj, current)
          pq.push([newDist, adj])
        }
      }
    }

    // 乗換エッジ（コスト TRANSFER_COST、物理移動なので見合わせに関係なく可能）
    for (const tCd of graph.transferMap.get(station.stationGCd) ?? []) {
      if (tCd === current) continue
      const newDist = currentDist + TRANSFER_COST
      if (newDist < (dist.get(tCd) ?? Infinity)) {
        dist.set(tCd, newDist)
        prev.set(tCd, current)
        pq.push([newDist, tCd])
      }
    }
  }

  if (!prev.has(toCd)) return []

  // 経路を復元（出発駅を除く）
  const path: string[] = []
  let node = toCd
  while (node !== fromCd) {
    path.push(node)
    node = prev.get(node)!
  }
  path.reverse()

  // RouteStep に変換
  const steps: RouteStep[] = []
  let prevCd = fromCd
  for (const cd of path) {
    const s = graph.stations.get(cd)!
    const p = graph.stations.get(prevCd)!
    const isTransfer = s.stationGCd === p.stationGCd && s.lineCd !== p.lineCd

    steps.push({
      stationCd: s.stationCd,
      name: s.name,
      lineCd: s.lineCd,
      lineName: s.lineName,
      lineColor: s.lineColor,
      action: isTransfer ? "transfer" : "ride",
    })
    prevCd = cd
  }

  // 末尾が乗換の場合は除去（目的地と同じ物理駅での乗換は不要）
  while (steps.length > 0 && steps[steps.length - 1].action === "transfer") {
    steps.pop()
  }

  return steps
}
