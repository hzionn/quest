#!/usr/bin/env python3
"""HOTSPOT「完成句子」→ 單選題，72 題自動化批次的組裝與驗證。

英文選項、判定、逐選項解析從 `az900_extract.extract_items()` 抽取；
問句與選項的中文翻譯是人工寫的（`az900_sentence_zh.py`）。組裝完的格式
跟 `az900_manual.CHOICE`（117/148/157/314/438/445）完全相同，所以直接
回傳同樣形狀的 dict，`build_az900.build_choice()` 不用改。
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from az900_extract import extract_items  # noqa: E402
from az900_common import unwrap, clean, clean_analysis  # noqa: E402
from az900_zh import to_tw  # noqa: E402
import az900_sentence_zh as S  # noqa: E402

LETTERS = 'ABCDE'


def load(parsed):
    """回傳 {qid: spec}，spec 跟 az900_manual.CHOICE 的元素同一種形狀：
    {'stem_zh','stem_en','options': {字母: (英, 中)}, 'answer': [字母],
     'explanations': {字母: 中文解析}}。
    """
    out = {}
    errs = []
    for qid, stem_zh in S.STEM_ZH.items():
        rec = parsed[str(qid)]
        items = extract_items(rec['sections'].get('2', ''))
        override = S.OPTIONS_EN_OVERRIDE.get(qid)
        en_texts = override if override else [it['text'] for it in items]
        zh_texts = S.OPTIONS_ZH.get(qid)
        if zh_texts is None:
            errs.append(f'id {qid}: 缺中文選項翻譯')
            continue
        if len(en_texts) != len(zh_texts):
            errs.append(f'id {qid}: 英文選項 {len(en_texts)} 個，中文翻譯 {len(zh_texts)} 個，數量對不起來')
            continue
        trues = [i for i, it in enumerate(items) if it['verdict'] is True]
        if len(trues) != 1:
            errs.append(f'id {qid}: 判定為「正確」的選項應該剛好一個，實際 {len(trues)} 個')
            continue
        if len(items) > len(LETTERS):
            errs.append(f'id {qid}: 選項數 {len(items)} 超過可用字母數')
            continue

        letters = LETTERS[:len(items)]
        options = {L: (en, zh) for L, en, zh in zip(letters, en_texts, zh_texts)}
        answer = letters[trues[0]]
        explanations = {}
        for L, it in zip(letters, items):
            analysis = clean(to_tw(clean_analysis(unwrap(' '.join(it['analysis'])))))
            if not analysis:
                errs.append(f'id {qid}: 選項 {L} 沒有解析')
                continue
            explanations[L] = analysis

        out[qid] = {
            'stem_zh': stem_zh,
            'stem_en': S.STEM_EN[qid],
            'options': options,
            'answer': [answer],
            'explanations': explanations,
        }
    return out, errs
