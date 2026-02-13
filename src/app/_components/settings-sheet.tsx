"use client"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { MetroGraph } from "@/lib/metro-graph"
import { cn } from "@/lib/utils/common"
import { useMemo } from "react"

interface Props {
  graph: MetroGraph
  suspendedLineCds: Set<string>
  onSuspensionToggle: (lineCd: string) => void
  excludePastVisited: boolean
  onExcludePastVisitedChange: (v: boolean) => void
}

export function SettingsSheet({
  graph,
  suspendedLineCds,
  onSuspensionToggle,
  excludePastVisited,
  onExcludePastVisitedChange,
}: Props) {
  const lines = useMemo(() => {
    const result: { lineCd: string; lineName: string; lineColor: string }[] = []
    const seen = new Set<string>()
    for (const [lineCd] of graph.lineStations) {
      if (seen.has(lineCd)) continue
      seen.add(lineCd)
      const cds = graph.lineStations.get(lineCd)
      if (!cds || cds.length === 0) continue
      const s = graph.stations.get(cds[0])
      if (!s) continue
      result.push({ lineCd, lineName: s.lineName, lineColor: s.lineColor })
    }
    return result
  }, [graph])

  return (
    <Sheet>
      <SheetTrigger className="cursor-pointer rounded-md p-1 text-zinc-400 transition-colors hover:text-zinc-600">
        <span className="material-symbols-outlined text-xl">settings</span>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>設定</SheetTitle>
          <SheetDescription className="sr-only">設定を変更します</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-4">
          {/* 運転見合わせ */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-zinc-500">
              運転見合わせ
              {suspendedLineCds.size > 0 && (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
                  {suspendedLineCds.size}路線
                </span>
              )}
            </h3>
            <div className="space-y-1">
              {lines.map((line) => {
                const isSuspended = suspendedLineCds.has(line.lineCd)
                return (
                  <Button
                    key={line.lineCd}
                    variant="ghost"
                    onClick={() => onSuspensionToggle(line.lineCd)}
                    className="flex h-auto w-full items-center gap-3 rounded-lg px-3 py-2 text-left"
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 shrink-0 rounded-full",
                        isSuspended && "bg-zinc-300"
                      )}
                      style={isSuspended ? undefined : { backgroundColor: line.lineColor }}
                    />
                    <span
                      className={cn(
                        "flex-1 text-sm font-medium",
                        isSuspended && "text-zinc-400 line-through"
                      )}
                    >
                      {line.lineName}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-bold",
                        isSuspended ? "bg-red-200 text-red-600" : "bg-green-100 text-green-600"
                      )}
                    >
                      {isSuspended ? "見合わせ" : "運行中"}
                    </span>
                  </Button>
                )
              })}
            </div>
            <div className="mt-3 flex items-center gap-3 px-3 text-xs text-zinc-400">
              <span>運行情報:</span>
              <a
                href="https://subway.osakametro.co.jp/guide/subway_information.php"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-zinc-600"
              >
                公式サイト
              </a>
              <a
                href="https://x.com/osakatransport"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-zinc-600"
              >
                @osakatransport
              </a>
            </div>
          </div>

          {/* 過去訪問済み駅の除外 */}
          <div>
            <Button
              variant="ghost"
              onClick={() => onExcludePastVisitedChange(!excludePastVisited)}
              className="flex h-auto w-full items-center gap-3 rounded-lg px-3 py-2 text-left"
            >
              <span className="flex-1 text-sm font-medium">過去訪問済み駅を除外</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-bold",
                  excludePastVisited ? "bg-accent-light text-accent" : "bg-zinc-100 text-zinc-400"
                )}
              >
                {excludePastVisited ? "ON" : "OFF"}
              </span>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
