#!/usr/bin/env python3
"""DRAG DROP 的三種子類型（matching／ordering／multiple）組裝與驗證。

資料本身在 az900_dragdrop_zh.py（人工撰寫，見該檔案開頭的說明）。這裡只
負責把資料組裝成跟其他題型一致的 JSON 形狀，並驗證資料本身沒有矛盾——
配對用的池子裡有沒有真的包含每組答案、排序步驟是否重複、多選題正解
是否至少一個。
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import az900_dragdrop_zh as D  # noqa: E402


def load():
    matching = {}
    ordering = {}
    multiple = {}
    errs = []

    for qid, spec in D.MATCHING.items():
        pairs = spec['pairs']
        if len(pairs) < 2:
            errs.append(f'id {qid}: 配對數要至少兩組')
            continue
        pool_en = [p[0] for p in pairs]
        pool_zh = [p[1] for p in pairs]
        # 允許同一個詞被拖到多個描述上（如 137 的 Azure Logic Apps），
        # 所以池子用「保序去重」而不是 set()，順序穩定也方便除錯。
        seen = set()
        uniq_en, uniq_zh = [], []
        for e, z in zip(pool_en, pool_zh):
            if e in seen:
                continue
            seen.add(e)
            uniq_en.append(e)
            uniq_zh.append(z)
        matching[qid] = {
            'stem_zh': spec['stem_zh'], 'stem_en': spec['stem_en'],
            'pool_en': uniq_en, 'pool_zh': uniq_zh,
            # 每一組配對：陳述用描述（use_case），答案用池子裡的詞（correct_answer）。
            'matches': [
                {'use_case_en': desc_en, 'use_case_zh': desc_zh,
                 'answer_en': term_en, 'answer_zh': term_zh, 'explain_zh': explain}
                for term_en, term_zh, desc_en, desc_zh, explain in pairs
            ],
        }

    for qid, spec in D.ORDERING.items():
        steps = spec['steps']
        if len(steps) < 2:
            errs.append(f'id {qid}: 排序步驟要至少兩個')
            continue
        if len(set(s[1] for s in steps)) != len(steps):
            errs.append(f'id {qid}: 排序步驟的中文有重複，UI 用字串當 key 會選不到重複項')
            continue
        if len(spec.get('step_explanations', [])) != len(steps):
            errs.append(f'id {qid}: 逐步解析數量跟步驟數量對不上')
            continue
        ordering[qid] = spec

    LETTERS = 'ABCDEF'
    for qid, spec in D.MULTIPLE.items():
        opts = spec['options']
        trues = [o for o in opts if o[2]]
        if not trues:
            errs.append(f'id {qid}: 至少要有一個正確選項')
            continue
        if len(opts) > len(LETTERS):
            errs.append(f'id {qid}: 選項數 {len(opts)} 超過可用字母數（A-F）')
            continue
        letters = LETTERS[:len(opts)]
        # 轉成跟 az900_manual.CHOICE 一樣的形狀，build_choice() 不用改就能吃。
        multiple[qid] = {
            'stem_zh': spec['stem_zh'], 'stem_en': spec['stem_en'],
            'options': {L: (en, zh) for L, (en, zh, _, _) in zip(letters, opts)},
            'answer': [L for L, (_, _, ok, _) in zip(letters, opts) if ok],
            'explanations': {L: ex for L, (_, _, _, ex) in zip(letters, opts)},
        }

    return matching, ordering, multiple, errs
