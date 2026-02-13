import type { HistoryEntry } from "@/types"

interface Props {
  history: HistoryEntry[]
}

export function StationList({ history }: Props) {
  return (
    <ol className="space-y-2">
      {history.map((entry, i) => (
        <li key={entry.timestamp} className="flex items-center gap-3">
          <span className="w-6 text-right text-xs text-zinc-400">{i + 1}</span>
          <span
            className="inline-block h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: entry.lineColor }}
          />
          <span className="text-sm">
            {entry.name}
            <span className="ml-1 text-xs text-zinc-400">{entry.lineName}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}
