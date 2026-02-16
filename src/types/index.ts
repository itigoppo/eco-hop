// ---- osaka_metro.json のデータ構造 ----

export interface RawStation {
  station_cd: string
  station_g_cd: string
  name: string
  station_number: string | null
  name_kana: string | null
  name_en: string | null
  lon: number
  lat: number
}

export interface RawConnection {
  from: string
  to: string
}

export interface RawLine {
  line_cd: string
  name: string
  name_en: string | null
  color: string
  stations: RawStation[]
  connections: RawConnection[]
}

export interface RawTransferEntry {
  station_cd: string
  line_cd: string
  name: string
}

export interface RawTransfer {
  station_g_cd: string
  stations: RawTransferEntry[]
}

export interface RawMetroData {
  company: { company_cd: string; name: string }
  lines: RawLine[]
  transfers: RawTransfer[]
}

// ---- アプリ内部で使用する型 ----

export interface Station {
  stationCd: string
  stationGCd: string
  name: string
  stationNumber: string | null
  nameKana: string | null
  nameEn: string | null
  lineCd: string
  lineName: string
  lineNameEn: string | null
  lineColor: string
  index: number
  lon: number
  lat: number
}

export interface Candidate {
  station: Station
  weight: number
}

export interface HistoryEntry {
  stationCd: string
  stationGCd: string
  name: string
  lineName: string
  lineColor: string
  timestamp: number
}

export interface RouteStep {
  stationCd: string
  name: string
  lineCd: string
  lineName: string
  lineColor: string
  action: "ride" | "transfer"
}

export interface PersistedState {
  currentStationCd: string
  visitedGroupCds: string[]
  history: HistoryEntry[]
  pendingNextCd: string | null
  pendingRoute: RouteStep[] | null
  suspendedLineCds?: string[]
  destinationRevealed?: boolean
  diceFaces?: number[]
  sessionDate?: string // "YYYY-MM-DD" セッション開始日
  completed?: boolean // セッション終了フラグ
}
