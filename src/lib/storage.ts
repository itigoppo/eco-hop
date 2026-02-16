"use client"

import type { HistoryEntry, PersistedState } from "@/types"

const STORAGE_PREFIX = "eco-hop-state-"

export function getTodayDateString(): string {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, "0")
  const dd = String(today.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function getTodayKey(): string {
  return `${STORAGE_PREFIX}${getTodayDateString()}`
}

export function loadState(): PersistedState | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(getTodayKey())
  if (!raw) return null
  try {
    return JSON.parse(raw) as PersistedState
  } catch {
    return null
  }
}

export function saveState(state: PersistedState): void {
  if (typeof window === "undefined") return
  const key = state.sessionDate ? `${STORAGE_PREFIX}${state.sessionDate}` : getTodayKey()
  localStorage.setItem(key, JSON.stringify(state))
}

export function clearState(sessionDate?: string): void {
  if (typeof window === "undefined") return
  const key = sessionDate ? `${STORAGE_PREFIX}${sessionDate}` : getTodayKey()
  localStorage.removeItem(key)
}

export interface PastDay {
  date: string
  history: HistoryEntry[]
}

export function loadPastDays(activeSessionDate?: string): PastDay[] {
  if (typeof window === "undefined") return []
  const todayKey = getTodayKey()
  const activeKey = activeSessionDate ? `${STORAGE_PREFIX}${activeSessionDate}` : todayKey
  const results: PastDay[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue
    if (key === todayKey || key === activeKey) continue
    const date = key.slice(STORAGE_PREFIX.length)
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const state = JSON.parse(raw) as PersistedState
      if (state.history && state.history.length > 0) {
        results.push({ date, history: state.history })
      }
    } catch {
      // skip corrupt entries
    }
  }

  results.sort((a, b) => b.date.localeCompare(a.date))
  return results
}

export function deletePastDay(date: string): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(`${STORAGE_PREFIX}${date}`)
}

/** 過去日の訪問済み stationGCd をすべて収集して返す */
export function loadPastVisitedGroupCds(activeSessionDate?: string): Set<string> {
  const gcds = new Set<string>()
  for (const day of loadPastDays(activeSessionDate)) {
    for (const entry of day.history) {
      gcds.add(entry.stationGCd)
    }
  }
  return gcds
}

const EXCLUDE_PAST_KEY = "eco-hop-exclude-past"

export function loadExcludePastVisited(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(EXCLUDE_PAST_KEY) === "true"
}

export function saveExcludePastVisited(v: boolean): void {
  if (typeof window === "undefined") return
  localStorage.setItem(EXCLUDE_PAST_KEY, v ? "true" : "false")
}
