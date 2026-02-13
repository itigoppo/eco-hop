# えんじょる、大トロ。

## Overview

エンジョイエコカードで行くOsakaMetro駅巡り

## Local Setup

### Prerequisites

- Node.js（推奨バージョン: 20以上 / dev: v20.19.4）
- pnpm
- Python 3（駅データ生成用）

### Start Development Server

```bash
pnpm install
pnpm dev
```

Open [http://localhost:30001](http://localhost:30001) with your browser to see the result.

### Generate Station Data

駅データは [駅データ.jp](https://ekidata.jp/) のCSVファイルから生成しています。

以下のCSVファイルを `data/` ディレクトリに配置してください。

- `station{YYYYMMDD}free.csv` — 駅データ
- `line{YYYYMMDD}free.csv` — 路線データ
- `join{YYYYMMDD}.csv` — 接続データ
- `pref.csv` — 都道府県データ

```bash
python scripts/generate_osaka_metro_json.py
```

`public/data/osaka_metro.json` が生成されます。

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- Python（駅データ生成）
