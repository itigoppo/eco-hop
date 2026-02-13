"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useState } from "react"

export function AboutDialog() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="h-8 w-8 text-zinc-400 hover:text-zinc-600"
      >
        <span className="material-symbols-outlined text-xl">help</span>
      </Button>

      <Dialog isOpen={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader onOpenChange={setOpen}>
            <DialogTitle>えんじょる、大トロ。とは？</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4 text-sm leading-relaxed text-zinc-600">
              <p>
                Osaka
                Metroの駅をランダムに選び、次の目的地を決めてくれるWebサイトです。普段は降りない駅との出会いを気軽に楽しめます。
                <br />
                何度も乗り降りするので、エンジョイエコカード（1日乗車券）があると安心です。
                <span className="text-xs text-zinc-400">
                  （※土日祝なら3回以上の乗降でお得になります）
                </span>
                <br />
                もちろん、実際に移動せず“エア地下鉄旅”として遊ぶこともできます。
                <br />
              </p>

              <p className="rounded-lg bg-zinc-50 px-3 py-3 text-zinc-500">
                ボタンを押したら、次の行き先は完全ランダム。
                <br />
                「え、ここ？」って駅が出るのも込みでおもしろい。
                <br />
                <br />
                知らん駅で降りてみたら、意外とええ店あったりするかも。
                <br />
                とりあえず一回、回してみよか 🎲
              </p>

              <div>
                <h3 className="mb-1 font-bold text-zinc-800">遊び方</h3>
                <ol className="list-inside list-decimal space-y-1">
                  <li>まずはスタート地点をタップ！梅田3駅のどこかから始まります。</li>
                  <li>次の目的地もタップで決定。どこが出るかはお楽しみ。</li>
                  <li>着いたら改札を出て、気の向くままにぶらぶら。</li>
                  <li>満足したら「次行こ」で次の駅へ。</li>
                  <li>カード裏の入出記録が埋まっていくの、地味にテンション上がるな。</li>
                  <li>最後にお得額を計算して「元取ったな」ってニヤけよ。</li>
                  <li>れっつ、えんじょい！</li>
                </ol>
              </div>

              <div>
                <h3 className="mb-1 font-bold text-zinc-800">機能</h3>
                <ul className="list-inside list-disc space-y-1">
                  <li>目的地までの乗換経路を表示</li>
                  <li>路線図で訪問済み駅を確認</li>
                  <li>運転見合わせ路線の除外設定</li>
                  <li>過去訪問済み駅の除外設定</li>
                </ul>
              </div>

              <p className="rounded-lg bg-zinc-50 px-3 py-3 text-center text-zinc-500">
                遊んだあとは履歴をポストしてくれてもええで！
                <br />
                <a
                  href="https://x.com/search?q=%23%E3%81%88%E3%82%93%E3%81%98%E3%82%87%E3%82%8B%E5%A4%A7%E3%83%88%E3%83%AD"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent font-bold underline"
                >
                  #えんじょる大トロ
                </a>
              </p>

              <hr className="border-zinc-200" />

              <div>
                <h3 className="mb-1 font-bold text-zinc-800">免責事項</h3>
                <ul className="list-inside list-disc space-y-1 text-xs text-zinc-400">
                  <li>本サイトはOsakaMetroの公式サービスではありません。</li>
                  <li>
                    掲載情報（路線・駅・経路等）の正確性は保証しません。実際の運行情報・運賃・時刻等は各自でご確認ください。
                  </li>
                  <li>本サイトの利用により生じた損害について、制作者は一切の責任を負いません。</li>
                </ul>
              </div>

              <div>
                <h3 className="mb-1 font-bold text-zinc-800">データの取り扱い</h3>
                <ul className="list-inside list-disc space-y-1 text-xs text-zinc-400">
                  <li>
                    本サイトはCookieを使用しません。訪問履歴や設定はブラウザのローカルストレージに保存され、外部に送信されることはありません。
                  </li>
                  <li>
                    データはお使いのブラウザにのみ保存されます。ブラウザのデータを消去すると履歴・設定もすべて削除されます。
                  </li>
                  <li>アクセス解析等の外部サービスは利用していません。</li>
                </ul>
              </div>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  )
}
