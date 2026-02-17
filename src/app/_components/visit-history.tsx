"use client"

import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { StationList } from "@/components/station-list"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { PastDay } from "@/lib/storage"
import { deletePastDay, loadPastDays } from "@/lib/storage"
import { cn } from "@/lib/utils/common"
import type { HistoryEntry } from "@/types"
import { useCallback, useState } from "react"

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  const y = String(d.getFullYear()).slice(-2)
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const wd = WEEKDAYS[d.getDay()]
  return `'${y}/${m}/${day} (${wd})`
}

interface Props {
  history: HistoryEntry[]
  onReset: () => void
  sessionDate?: string
}

export function VisitHistory({ history, onReset, sessionDate }: Props) {
  const [open, setOpen] = useState(false)
  const [pastDays, setPastDays] = useState<PastDay[]>([])
  const hasPast = loadPastDays(sessionDate).length > 0

  // 確認ダイアログの状態
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

  const handleOpen = useCallback(() => {
    setPastDays(loadPastDays(sessionDate))
    setOpen(true)
  }, [sessionDate])

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return
    deletePastDay(deleteTarget)
    setPastDays(loadPastDays(sessionDate))
    setDeleteTarget(null)
  }, [deleteTarget, sessionDate])

  const handleResetConfirm = useCallback(() => {
    setResetConfirmOpen(false)
    onReset()
  }, [onReset])

  const handlePost = useCallback(() => {
    const stationNames = history.map((h) => h.name)
    // 重複を除いた駅数（スタート含む）
    const uniqueCount = new Set(history.map((h) => h.stationGCd)).size
    const route = stationNames.join(" → ")
    const text = `${route}\n${uniqueCount}駅巡りました！\n\n#えんじょる大トロ https://eco-hop.vercel.app/`
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`
    window.open(url, "_blank", "noopener,noreferrer")
  }, [history])

  if (history.length === 0 && !hasPast) return null

  return (
    <>
      <Card>
        <CardContent>
          {history.length > 0 && (
            <>
              <p className="mb-3 text-sm text-zinc-500">訪問履歴</p>
              <StationList history={history} />
            </>
          )}
          {history.length > 1 && (
            <>
              <Button
                variant="ghost"
                onClick={handlePost}
                className="mt-4 w-full text-zinc-400 hover:text-zinc-600"
              >
                <span className="material-symbols-outlined text-base">share</span>
                履歴をポスト
              </Button>
              <Button
                variant="ghost"
                onClick={() => setResetConfirmOpen(true)}
                className="mt-1 w-full text-zinc-400 hover:text-red-500"
              >
                <span className="material-symbols-outlined text-base">restart_alt</span>
                リセット
              </Button>
            </>
          )}
          {hasPast && (
            <Button
              variant="ghost"
              onClick={handleOpen}
              className={cn(
                "w-full text-zinc-400 hover:text-zinc-600",
                history.length > 1 ? "mt-1" : history.length > 0 ? "mt-4" : ""
              )}
            >
              <span className="material-symbols-outlined text-base">history</span>
              過去の履歴を見る
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog isOpen={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader onOpenChange={setOpen}>
            <DialogTitle>過去の履歴</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {pastDays.length === 0 ? (
              <p className="py-12 text-center text-sm text-zinc-400">過去の履歴はありません</p>
            ) : (
              <div className="space-y-4">
                {pastDays.map((day: PastDay) => (
                  <Card key={day.date} className="pt-0">
                    <Collapsible>
                      <CardContent className="pb-0">
                        <div className="flex items-center">
                          <CollapsibleTrigger className="flex-1 py-1 text-sm">
                            <span className="flex items-center gap-2">
                              <span className="font-medium">{formatDate(day.date)}</span>
                              <span className="text-xs text-zinc-400">{day.history.length}駅</span>
                            </span>
                          </CollapsibleTrigger>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(day.date)}
                            className="h-8 w-8 shrink-0 text-zinc-300 hover:text-red-500"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </Button>
                        </div>
                      </CardContent>
                      <CollapsibleContent>
                        <CardContent>
                          <StationList history={day.history} />
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                ))}
              </div>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="履歴を削除"
        description={deleteTarget ? `${formatDate(deleteTarget)} の履歴を削除しますか？` : ""}
        confirmLabel="削除"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        isOpen={resetConfirmOpen}
        title="リセット"
        description="訪問履歴がすべて消去されます。"
        confirmLabel="リセット"
        danger
        onConfirm={handleResetConfirm}
        onCancel={() => setResetConfirmOpen(false)}
      />
    </>
  )
}
