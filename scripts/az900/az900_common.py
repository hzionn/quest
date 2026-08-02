#!/usr/bin/env python3
"""`build_az900.py` 和 `az900_extract.py` 共用的文字正規化函式。

獨立成這個檔案只是為了打破循環匯入——`az900_extract` 需要 `unwrap()`／
`verdict_of()`，而 `build_az900` 又要匯入 `az900_extract` 裡的
`extract_items()`；兩邊互相 import 對方會炸掉，所以共用的部分搬來這裡，
兩邊都只單向依賴它。
"""
import re

CJK = re.compile(r'[一-鿿]')
# 句末標點含 ASCII 的 . ? ! —— 英文題幹在來源裡本來就是一句一行，
# 只有超過版面寬度時才硬斷，所以「上一行以句號結尾」就代表那是真的換行。
_TERMINAL = re.compile(r'[。！？!?：:；;」）\)]$|(?<![A-Z])\.$')
_LIST_START = re.compile(r'^\s*(✑|[A-F][\.、]|\d+[\.、\)]|・|-|\*|https?://)')


def unwrap(text):
    """把 PDF 硬斷的行接回去。

    來源是排版後的 PDF，一句話常常被切成兩行（「無需依賴雲服務提供商的人工幹\n預」）。
    只有在「前一行沒有句末標點」而且「下一行不是清單項目」時才接，這樣題目裡
    刻意分行的需求清單（✑ 開頭）跟段落結構都保得住。
    """
    lines = (text or '').split('\n')
    out = []
    for cur in lines:
        prev = out[-1] if out else None
        if prev and cur.strip() and not _TERMINAL.search(prev.rstrip()) and not _LIST_START.match(cur):
            a, b_ = prev.rstrip(), cur.lstrip()
            # 中文之間直接黏，英文之間要留一個空格
            joiner = '' if (a and b_ and (CJK.search(a[-1]) or CJK.search(b_[0]))) else ' '
            out[-1] = a + joiner + b_
        else:
            out.append(cur)
    return '\n'.join(out)


def clean(text):
    text = re.sub(r'[ \t]+\n', '\n', text or '')
    text = re.sub(r'\n{3,}', '\n\n', text)
    return unwrap(text.strip()).strip()


TAIL = re.compile(r'Correct Answer:|正确答案|正確答案|Community vote|社区投票|参考资料|參考資料|References?:')

# 判定的寫法有兩種：開頭直接下判斷（「否: 正确。…」「错误。…」），或是先
# 分析、最後才下結論（「…因此此选项错误。」）。開頭那種優先——這類句子的
# 後半段常出現「不符合题目要求」在講題目裡的解決方案，不是在講這個選項，
# 用最後一個判定詞會判反。
# 「正確性分析：」是段落標題不是判定，先拿掉。
_NOISE = re.compile(r'正確性分析|正确性分析')
# 開頭判定：允許「是/否/此選項」這種前綴，但判定詞必須緊接著出現。
# 不能只是「前 15 個字裡有正確兩個字」—— 例如「此选项认为原句正确，
# 这是错误的」開頭就有「正确」，但那是在轉述選項的主張，不是判定。
_LEADV = re.compile(r'^(?:\s*(?:[是否]|Yes|No|此[选選]項|此[选選]项|該[选選]項|该[选選]项)'
                    r'\s*[:：、，,]?\s*){0,3}(不正確|不正确|錯誤|错误|正確|正确)')
_VERDICT = re.compile(r'[不未][^，。；\s]{0,3}符合|不正確|不正确|錯誤|错误|符合|正確|正确')
_NEG_RE = re.compile(r'^[不未]|^錯誤$|^错误$|^不正確$|^不正确$')


def verdict_of(text):
    body = _NOISE.sub('', TAIL.split(text or '')[0])
    lead = _LEADV.search(body)
    if lead:
        return not _NEG_RE.search(lead.group(1))
    hits = _VERDICT.findall(body)
    if not hits:
        return None
    return not _NEG_RE.search(hits[-1])


# ── 給抽出來的 analysis 原始文字用的收尾清理 ──
# 這裡吃的是 to_tw() 轉換「之前」的原始（簡體）文字，跟 verdict_of() 一樣的
# 理由：先正規化掉骨架字樣，轉繁體與套術語表交給呼叫端統一處理一次就好。
# split_sec2() 把「A. Yes 是」這種雙語選項的英文部分砍掉之後，殘留的單獨
# 一個「是」／「否」字元（後面接換行）是被砍剩的中文重複，不是句子的一部分——
# 要求後面緊接空白＋換行，才不會誤吃「是否」「否則」這類正常詞開頭的句子。
_ANALYSIS_LEAD_NOISE = re.compile(
    r'^(分析|结论|正确性分析|正確性分析)[：:]\s*'
    # 「A. Yes 是」這種雙語選項砍掉英文部分後，殘留的單獨一個「是」／「否」
    # 字元不是句子的一部分——分隔符可能是冒號、換行，或者被 unwrap() 併行後
    # 完全消失、直接黏著下一句的「此选项／此選項」，三種都要認得出來。
    r'|^\s*[是否]([：:]\s*|\s*\n\s*|(?=此[选選][项項]))'
)
# 判定詞可能以「此选项(是)?正确/错误(的)?。」「错误选项。」「正确：」…
# 各種寫法重複一次——這句話本身是純贅字（判定已經由呼叫端加的「正確。」
# 「錯誤。」前綴表達），不管出現在句首、句中還是句尾都整段砍掉。分隔符可以
# 是句號或冒號（全形/半形皆可），也可能什麼都沒有直接接下一句。
_ANALYSIS_VERDICT_NOISE = re.compile(
    r'(此选项(是)?)?(正确|错误)(選項|选项)?(的)?[。\.：:]\s*'
)
_ANALYSIS_TAIL_CONCLUSION = re.compile(r'\s*结论[：:].*$', re.S)


def clean_analysis(raw_zh):
    """把 extract_items() 抽出來的 analysis 原始文字，整理成一段可以直接
    接在「正確。」／「錯誤。」後面的解析——去掉「分析：」開頭、「此选项
    正确/错误」「结论：…」這些抽取時留下的骨架字樣。"""
    text = (raw_zh or '').strip()
    text = _ANALYSIS_LEAD_NOISE.sub('', text)
    text = _ANALYSIS_TAIL_CONCLUSION.sub('', text)
    # 判定詞贅句只可能出現在「一句話的開頭」，不能整段字串亂砍——
    # 「否则视为错误。」这种嵌在分析中间、属于正常句意的片段不该被吃掉。
    # 用「句首（含換行後）」為錨點，逐句掃描比一次性 sub 全域安全。
    lines = re.split(r'(?<=[。\.\n])', text)
    out = []
    for line in lines:
        stripped = _ANALYSIS_VERDICT_NOISE.sub('', line, count=1) if _ANALYSIS_VERDICT_NOISE.match(line) else line
        out.append(stripped)
    return ''.join(out).strip()
