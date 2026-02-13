"""大阪メトロの路線図用JSONデータを生成するスクリプト

駅データ.jpのCSVファイルから大阪メトロ(company_cd=249)のデータを抽出し、
路線図描画に必要な情報をJSONファイルとして出力する。

Usage:
    python scripts/generate_osaka_metro_json.py
"""

import csv
import json
from collections import defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
OUTPUT_DIR = PROJECT_ROOT / "public/data"
COMPANY_CD = "249"
OUTPUT_FILE = OUTPUT_DIR / "osaka_metro.json"
STATION_INFO_FILE = DATA_DIR / "station_info.csv"
EXCLUDE_STATIONS = {"9962115"}  # 夢洲

# 駅番号プレフィックス → line_cd のマッピング
LINE_PREFIX_TO_CD = {
    "M": "99618",  # 御堂筋線
    "T": "99619",  # 谷町線
    "Y": "99620",  # 四つ橋線
    "C": "99621",  # 中央線
    "S": "99622",  # 千日前線
    "K": "99623",  # 堺筋線
    "N": "99624",  # 長堀鶴見緑地線
    "P": "99625",  # 南港ポートタウン線
    "I": "99652",  # 今里筋線
}
LINE_CD_TO_PREFIX = {v: k for k, v in LINE_PREFIX_TO_CD.items()}

LINE_NAME_EN = {
    "99618": "Midosuji Line",
    "99619": "Tanimachi Line",
    "99620": "Yotsubashi Line",
    "99621": "Chuo Line",
    "99622": "Sennichimae Line",
    "99623": "Sakaisuji Line",
    "99624": "Nagahori Tsurumi-ryokuchi Line",
    "99625": "New Tram",
    "99652": "Imazatosuji Line",
}


def load_station_info():
    """station_info.csv から駅番号・かな・英語名を読み込む

    Returns:
        dict: (line_cd, station_name) → {"station_number", "name_kana", "name_en"}
    """
    lookup = {}
    with open(STATION_INFO_FILE, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            prefix = row["station_number"][0]
            line_cd = LINE_PREFIX_TO_CD.get(prefix)
            if line_cd:
                lookup[(line_cd, row["name"])] = {
                    "station_number": row["station_number"],
                    "name_kana": row["name_kana"],
                    "name_en": row["name_en"],
                }
    return lookup


def load_lines():
    """大阪メトロの現役路線を読み込む"""
    with open(DATA_DIR / "line20250604free.csv") as f:
        return [l for l in csv.DictReader(f) if l["company_cd"] == COMPANY_CD and l["e_status"] == "0"]


def load_stations(line_cds):
    """大阪メトロの現役駅を読み込む(除外駅を除く)"""
    with open(DATA_DIR / "station20260206free.csv") as f:
        return [
            s for s in csv.DictReader(f)
            if s["line_cd"] in line_cds and s["e_status"] == "0" and s["station_cd"] not in EXCLUDE_STATIONS
        ]


def load_joins(line_cds):
    """大阪メトロの隣接駅データを読み込む(除外駅を含む接続を除く)"""
    with open(DATA_DIR / "join20250916.csv") as f:
        return [
            j for j in csv.DictReader(f)
            if j["line_cd"] in line_cds
            and j["station_cd1"] not in EXCLUDE_STATIONS
            and j["station_cd2"] not in EXCLUDE_STATIONS
        ]


def order_stations_along_line(joins):
    """接続データから駅を路線順に並べる"""
    adj = defaultdict(set)
    for j in joins:
        s1, s2 = j["station_cd1"], j["station_cd2"]
        adj[s1].add(s2)
        adj[s2].add(s1)

    # 端点（次数1）を探す。環状線の場合は先頭の駅から開始
    endpoints = [s for s in adj if len(adj[s]) == 1]
    start = endpoints[0] if endpoints else joins[0]["station_cd1"]

    ordered = [start]
    visited = {start}
    current = start
    while True:
        nexts = [n for n in adj[current] if n not in visited]
        if not nexts:
            break
        current = nexts[0]
        ordered.append(current)
        visited.add(current)

    return ordered


def build_transfers(stations):
    """station_g_cdが複数路線にまたがる駅を乗り換え駅として抽出"""
    g_cd_map = defaultdict(list)
    for s in stations:
        g_cd_map[s["station_g_cd"]].append({
            "station_cd": s["station_cd"],
            "line_cd": s["line_cd"],
            "name": s["station_name"],
        })
    return [
        {"station_g_cd": g_cd, "stations": stns}
        for g_cd, stns in sorted(g_cd_map.items())
        if len(stns) > 1
    ]


def main():
    # データ読み込み
    metro_lines = load_lines()
    line_cds = set(l["line_cd"] for l in metro_lines)
    metro_stations = load_stations(line_cds)
    metro_joins = load_joins(line_cds)
    station_info = load_station_info()

    station_by_cd = {s["station_cd"]: s for s in metro_stations}

    # 接続データを路線ごとにグループ化
    joins_by_line = defaultdict(list)
    for j in metro_joins:
        joins_by_line[j["line_cd"]].append(j)

    # 路線データ構築
    lines_json = []
    for line in sorted(metro_lines, key=lambda l: l["line_cd"]):
        lcd = line["line_cd"]
        joins = joins_by_line.get(lcd, [])

        ordered_cds = order_stations_along_line(joins)

        stations = []
        for scd in ordered_cds:
            s = station_by_cd.get(scd)
            if s:
                info = station_info.get((lcd, s["station_name"]))
                if not info:
                    print(f"  警告: station_info に未登録 line_cd={lcd} name={s['station_name']}")
                entry = {
                    "station_cd": s["station_cd"],
                    "station_g_cd": s["station_g_cd"],
                    "name": s["station_name"],
                    "station_number": info["station_number"] if info else None,
                    "name_kana": info["name_kana"] if info else None,
                    "name_en": info["name_en"] if info else None,
                    "lon": float(s["lon"]),
                    "lat": float(s["lat"]),
                }
                stations.append(entry)

        connections = [{"from": j["station_cd1"], "to": j["station_cd2"]} for j in joins]

        name = line["line_name"].replace("大阪メトロ", "")

        lines_json.append({
            "line_cd": lcd,
            "name": name,
            "name_en": LINE_NAME_EN.get(lcd),
            "color": "#" + line["line_color_c"] if line["line_color_c"] else None,
            "stations": stations,
            "connections": connections,
        })

    # 乗り換え駅データ構築
    transfers = build_transfers(metro_stations)

    # JSON出力
    result = {
        "company": {"company_cd": COMPANY_CD, "name": "Osaka Metro"},
        "lines": lines_json,
        "transfers": transfers,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    # サマリ出力
    print(f"出力: {OUTPUT_FILE}")
    print(f"路線数: {len(lines_json)}")
    for l in lines_json:
        print(f"  {l['name']}: {len(l['stations'])}駅, {len(l['connections'])}接続, color={l['color']}")
    print(f"乗り換え駅グループ: {len(transfers)}")


if __name__ == "__main__":
    main()
