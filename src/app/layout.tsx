import { cn } from "@/lib/utils/common"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Yusei_Magic } from "next/font/google"
import type { ReactNode } from "react"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const yuseiMagic = Yusei_Magic({
  variable: "--font-yusei-magic",
  weight: "400",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  description: "エンジョイエコカードで行くOsakaMetro駅巡り！",
  title: "えんじょる、大トロ。 - OsakaMetro駅巡り",
}

export const viewport: Viewport = {
  initialScale: 1,
  viewportFit: "cover",
  width: "device-width",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body
        suppressHydrationWarning
        className={cn(
          geistSans.variable,
          geistMono.variable,
          yuseiMagic.variable,
          "min-h-screen bg-stone-100 font-sans antialiased"
        )}
      >
        <main className="mx-auto w-full max-w-md px-4 py-8">{children}</main>
        <footer className="pb-8 text-center text-xs text-zinc-400">
          <span>&copy; 2026 HisatoS.</span>
          <span className="mx-1">/</span>
          <a
            href="https://x.com/itigoppo"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-zinc-600"
          >
            @itigoppo
          </a>
        </footer>
      </body>
    </html>
  )
}
