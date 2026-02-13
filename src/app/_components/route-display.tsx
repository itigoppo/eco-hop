import type { RouteStep, Station } from "@/types"

interface Props {
  currentStation: Station
  steps: RouteStep[]
}

export function RouteDisplay({ currentStation, steps }: Props) {
  return (
    <div className="mt-4 rounded-xl bg-zinc-50 p-3">
      <p className="mb-2 text-xs font-medium text-zinc-500">経路</p>
      <ol className="space-y-1">
        <li className="flex items-center gap-2 text-sm">
          <span className="w-5 text-center text-xs text-zinc-400">●</span>
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: currentStation.lineColor }}
          />
          <span className="font-medium">{currentStation.name}</span>
        </li>
        {steps.map((step, i) => (
          <li key={`${step.stationCd}-${i}`} className="flex items-center gap-2 text-sm">
            {step.action === "transfer" ? (
              <>
                <span className="w-5 text-center text-xs text-zinc-400">↓</span>
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: step.lineColor }}
                />
                <span className="text-zinc-500">{step.lineName}に乗換</span>
              </>
            ) : (
              <>
                <span className="w-5 text-center text-xs text-zinc-400">→</span>
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: step.lineColor }}
                />
                <span>{step.name}</span>
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
