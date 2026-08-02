#!/usr/bin/env python3
"""是非型 HOTSPOT → 配對題，55 題自動化批次。

跟 `az900_manual.YESNO`（19 題純手動讀圖）不同，這 55 題的英文陳述、
判定、中文解析全部從 PDF 文字層抽出來（`az900_extract.py`），只有陳述的
中文翻譯是人工補上的（`az900_yesno_zh.YESNO_ZH`）。

`load()` 回傳的格式跟 `az900_manual.YESNO` 完全一樣（`{id: {'items': [...]}}`），
所以 `build_az900.build_yesno()` 不用改一行就能重用。
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from az900_extract import extract_items, official_verdicts  # noqa: E402
from az900_common import clean_analysis  # noqa: E402
from az900_yesno_zh import YESNO_ZH  # noqa: E402


def load(parsed, to_tw, unwrap, clean):
    """回傳 {qid: {'items': [(en, zh, verdict, zh_analysis), ...]}}。

    對每一題重新跑一次 extract_items()（不吃快取的 .build/yesno_dump.json），
    這樣 az900_extract.py 之後如果再修正，這裡永遠是跟最新版本一致的。
    """
    out = {}
    errs = []
    for qid, zh_list in YESNO_ZH.items():
        rec = parsed[str(qid)]
        items = extract_items(rec['sections'].get('2', ''))
        if len(items) != len(zh_list):
            errs.append(f'id {qid}: 抽出 {len(items)} 個陳述，但翻譯只有 {len(zh_list)} 句，數量對不起來')
            continue
        off = official_verdicts(rec['sections'].get('3', ''))
        mine = [it['verdict'] for it in items]
        if off and len(off) == len(items) and off != mine:
            errs.append(f'id {qid}: 抽取的判定 {mine} 跟 PDF 文字層裡官方的 {off} 不一致')
            continue
        if any(v is None for v in mine):
            errs.append(f'id {qid}: 有陳述抽不出判定')
            continue
        built = []
        for it, zh in zip(items, zh_list):
            analysis = clean(to_tw(clean_analysis(unwrap(' '.join(it['analysis'])))).strip())
            built.append((it['text'], zh, it['verdict'], analysis))
        out[qid] = {'items': built}
    return out, errs
