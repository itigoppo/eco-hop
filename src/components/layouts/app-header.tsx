import type { ReactNode } from "react"

interface Props {
  left?: ReactNode
  right?: ReactNode
}

export function AppHeader({ left, right }: Props) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1">{left}</div>
      <div className="space-y-2 text-center">
        <div className="text-accent flex items-center justify-center gap-3">
          <span className="relative translate-y-1">
            <span className="material-symbols-outlined leading-none" style={{ fontSize: "20px" }}>
              subway
            </span>
            <span
              className="material-symbols-outlined absolute -top-1 -right-2 rotate-12 leading-none"
              style={{ fontSize: "12px" }}
            >
              payment_card
            </span>
          </span>
          <h1
            className="text-xl leading-none font-bold"
            style={{ fontFamily: "var(--font-yusei-magic)" }}
          >
            えんじょる、大トロ。
          </h1>
        </div>
        <p className="text-xs text-zinc-500">エンジョイエコカードで行くOsakaMetro駅巡り！</p>
      </div>
      <div className="flex flex-1 justify-end">{right}</div>
    </div>
  )
}
