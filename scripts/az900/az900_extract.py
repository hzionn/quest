#!/usr/bin/env python3
"""從「§2 選項分析」段落抽取逐項的 (英文陳述, 判定, 中文分析)。

跟 build_text() 處理的 203 題不同，這裡的來源沒有 `A.`/`B.` 字母前綴——
陳述本身就是一句英文，判定用詞（正确／错误／Yes／No）散落在陳述本身、
緊接的「分析：」段落、或最後的「结论：」段落，三種都可能出現，順序也不固定。

策略不是窮舉格式規則，而是找「段落邊界」：一個新陳述開始於一行不是
「分析：」「结论：」開頭、也不是漏進 §2 的下個段落內容（Correct Answer／
Reference 這類）的文字。邊界抓對之後，每個陳述自己的判定就重用
`build_az900.verdict_of()`——同一份「找段落裡最後一個正確／錯誤」的邏輯，
不用為這裡再造一次輪子。

抽出來的判定不可盡信，一定要在 build 階段跟一份獨立來源交叉比對
（`official_verdicts()`），兩邊對不起來就要讓 build 失敗，而不是接受。
"""
import re
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from az900_common import unwrap, verdict_of  # noqa: E402

_CONT = re.compile(r'^(分析|结论)[：:]|^(正确|错误)[。\.]')
_STOP = re.compile(r'^(Correct Answer:|正确答案[：:]|Reference:?|参考资料[：:]|https?://)')
_LABEL_HEAD = re.compile(r'^(?:选项\s*(\d+)|Statement\s*(\d+))[:：]\s*(.+)$')
_INLINE_ANALYSIS = re.compile(r'\s*(分析[：:].*)$')
_LABEL_COLON = re.compile(r'^([^:：]{2,90}?)[:：]\s*(\S.*)$')


def extract_items(sec2_raw):
    """回傳 items：[{'text','verdict','analysis'}, …]。"""
    text = unwrap(sec2_raw or '').strip()
    if not text:
        return []
    lines = [l for l in text.split('\n') if l.strip()]

    items = []
    cur = None
    skipping = False
    for line in lines:
        # 「Correct Answer:／正确答案：」這類本來屬於下一段（§3）的內容，
        # 常常因為版面斷頁被夾在 §2 的陳述清單中間（不是只出現在頭尾），
        # 之後還會接一段重複的官方答案說明。這段雜訊要整段跳過，直到
        # 下一行看起來像是一個新陳述的開頭（有標籤、或「选项N:」／
        # 「Statement N:」前綴）才恢復抓取——恢復前跳過的內容不需要，
        # 其他陳述的分析裡已經有等價的說明。
        if _STOP.match(line):
            skipping = True
            continue
        if skipping:
            if _LABEL_HEAD.match(line) or (_LABEL_COLON.match(line) and len(line.split(':')[0].split('：')[0]) <= 90
                                            and not re.search(r'[.!?。！？]', line.split(':')[0].split('：')[0])):
                skipping = False
            else:
                continue

        # 「分析：」／「结论：」永遠併進目前這個陳述，不算新陳述的開始。
        if _CONT.match(line):
            if cur is not None:
                cur['analysis'].append(line)
            continue

        # 陳述本文跟「分析：」黏在同一個實體行（PDF 沒斷行）的情況：
        # 「…Azure AD). 分析：此选项是正确的。」要把兩段拆開處理。
        m = _INLINE_ANALYSIS.search(line)
        stem_part = line[:m.start()].strip() if m else line

        hm = _LABEL_HEAD.match(stem_part)
        if hm:
            stem_part = hm.group(3).strip()

        if cur:
            items.append(cur)
        cur = {'text': stem_part, 'verdict': None, 'analysis': []}
        if m:
            cur['analysis'].append(m.group(1))
    if cur:
        items.append(cur)

    for it in items:
        # 陳述本身可能就是「<標籤>: <分析>」一行完（Q1/Q28/Q88 那種），
        # 這時要把標籤跟分析拆開——標籤才是要顯示的選項文字。
        lm = _LABEL_COLON.match(it['text'])
        analysis_text = ' '.join(it['analysis'])
        if lm and not re.search(r'[.!?。！？]', lm.group(1)):
            it['text'] = lm.group(1).strip()
            # 標籤與分析黏在同一行時（「configuring high availability: 错误。…」），
            # 拆出來的分析文字要存回 analysis，不然只用來判定 verdict 就丟掉，
            # 呼叫端（例如建構單選題解析）會拿到空的分析。
            analysis_text = lm.group(2) + ' ' + analysis_text
            it['analysis'] = [lm.group(2)] + it['analysis']
        it['verdict'] = verdict_of(analysis_text or it['text'])
    return items


def official_verdicts(sec3_raw):
    """從「§3 我的答案」抽官方逐項判定，當作交叉比對的獨立來源。

    支援 `Box N:`、`Statement N:`、`选项N:`、純 `Yes/No`／`是/否` 逐行、
    以及 `<陳述>: Yes/No` 這幾種格式。回傳依原文順序排列的 bool 列表；
    抽不到就是空列表——不是每題都有這份獨立來源可對。
    """
    text = (sec3_raw or '').strip()
    text = re.sub(r'^Correct Answer:\s*\n?正确答案[：:]\s*\n?', '', text).strip()
    if not text:
        return []
    out = []
    for l in text.split('\n'):
        l = l.strip()
        if not l:
            continue
        m = re.search(r'(Yes|No|是|否)\s*[\.。]?\s*-?\s*$', l)
        if m:
            out.append(m.group(1) in ('Yes', '是'))
        elif re.fullmatch(r'(Yes|No|是|否)', l):
            out.append(l in ('Yes', '是'))
    return out
