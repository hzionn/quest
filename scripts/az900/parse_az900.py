#!/usr/bin/env python3
"""AZ-900 來源 PDF → 結構化記錄。

來源是「中文AI解析版」，跟 AZ-104 的純英文 PDF 完全不同：英文題幹、簡體
中文翻譯、選項（英/中各一行）、官方答案、社群投票、以及一整段 AI 解析
（1 考點 / 2 選項分析 / 3 我的答案 / 4 官方答案 / 5 比較）都是「可選取的文字」。
所以這裡盡量用純文字解析，不靠影像。
"""
import fitz, re, json, glob, sys, os

SCRATCH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.build')
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.makedirs(SCRATCH, exist_ok=True)
FOOTER = re.compile(r'淘宝/闲鱼[^\n]*\n?')
# 解析段落的起始標記；不同題目用字略有出入（見 az900_raw 掃描結果）。
ANALYSIS = re.compile(r'题目分析与解答|AZ-900\s*考试辅导[：:]')
# 「1. 考察的知识点」這類編號小標，標題文字有十幾種寫法，所以只認編號。
NUMHEAD = re.compile(r'^[ \t]*([1-9])[\.、][ \t]*(.{0,24}?)[ \t]*$', re.M)
OPT = re.compile(r'^([A-F])\.[ \t]+(\S.*)$')
MOSTVOTED = re.compile(r'\s*Most Voted\s*$')


def read_pdfs():
    txt = []
    for f in sorted(glob.glob(os.path.join(REPO, 'AZ900', '*.pdf'))):
        d = fitz.open(f)
        txt.append("\n".join(p.get_text() for p in d))
    if not txt:
        sys.exit('找不到 AZ900/*.pdf')
    return "\n".join(txt)


def split_questions(all_text):
    parts = re.split(r'^Topic \d+\s*\nQuestion #(\d+)\s*$', all_text, flags=re.M)
    return {int(parts[i]): parts[i + 1] for i in range(1, len(parts), 2)}


def sections(body):
    """把 AI 解析段落切成 {1:…, 2:…, 3:…, 4:…, 5:…}。"""
    m = ANALYSIS.search(body)
    if not m:
        return {}
    tail = FOOTER.sub('', body[m.end():])
    hits = list(NUMHEAD.finditer(tail))
    out = {}
    for i, h in enumerate(hits):
        end = hits[i + 1].start() if i + 1 < len(hits) else len(tail)
        # 同一個編號只取第一次出現（少數題目解析後面還會再列一次）。
        out.setdefault(int(h.group(1)), tail[h.end():end].strip())
    return out


def kind_of(body):
    head = body[:400]
    if 'HOTSPOT' in head:
        return 'hotspot'
    if 'DRAG DROP' in head:
        return 'dragdrop'
    return 'text'


def parse_options(head):
    """選項區塊：`A. <英文>` 之後緊跟著同一選項的中文翻譯行。

    專有名詞（Standard、Azure Policy…）翻譯後與英文相同，看起來像重複行，
    但格式一致，所以一律「前半英文、後半中文」切。
    """
    lines = [l.rstrip() for l in head.split('\n')]
    idx = [i for i, l in enumerate(lines) if OPT.match(l)]
    if not idx:
        return {}, {}
    en, zh = {}, {}
    for j, i in enumerate(idx):
        end = idx[j + 1] if j + 1 < len(idx) else len(lines)
        blk = [l.strip() for l in lines[i:end] if l.strip()]
        letter, first = OPT.match(blk[0]).groups()
        blk[0] = first
        blk = [MOSTVOTED.sub('', b) for b in blk]
        half = len(blk) // 2 or 1
        en[letter] = ' '.join(blk[:half]).strip()
        zh[letter] = ' '.join(blk[half:]).strip() or en[letter]
    return en, zh


CJK = re.compile(r'[一-鿿]')


def split_stem(block):
    """題幹是「整段英文」後面接「整段簡體中文」，中間沒有分隔標記。

    以第一行含中日韓字元的行當切點：英文題幹不會出現漢字，而中文題幹即使
    夾雜 Azure 專有名詞，第一行也幾乎一定有漢字（唯一的例外是中文段落被
    排版切到下一頁，這種情況下 zh 會落空，交給呼叫端報錯。）
    """
    lines = block.split('\n')
    cut = next((i for i, l in enumerate(lines) if CJK.search(l)), None)
    if cut is None:
        return block.strip(), ''
    return '\n'.join(lines[:cut]).strip(), '\n'.join(lines[cut:]).strip()


def parse(body):
    body = body.replace(' ', ' ')
    kind = kind_of(body)
    m = ANALYSIS.search(body)
    pre = body[:m.start()] if m else body
    pre = FOOTER.sub('', pre)

    # 「Correct Answer:」在 PDF 裡的位置不固定 —— 選擇題大多在選項之後，
    # 但 HOTSPOT／DRAG DROP 常被排版擠到 AI 解析段中間，所以整份 body 都要找。
    ca_all = re.search(r'^Correct Answer:[ \t]*(.*)$', body, re.M)
    answer_letters = []
    if ca_all:
        answer_letters = re.findall(r'[A-F]', ca_all.group(1).strip()[:6])
    ca = re.search(r'^Correct Answer:[ \t]*(.*)$', pre, re.M)
    head = pre[:ca.start()] if ca else pre
    rationale = pre[ca.end():] if ca else ''

    # 少數幾題（92、117、314…）的 AI 解析沒有用標準的「题目分析与解答」開頭，
    # 於是解析文字直接黏在最後一個選項後面。這裡再攔一次，避免整段解析被
    # 當成選項內容。
    leak = re.search(r'^[ \t]*(知识点|题目解析|原因分析|选项分析|AZ-900\s*考试辅导)', head, re.M)
    if leak:
        head = head[:leak.start()]
    opts_en, opts_zh = parse_options(head)
    # 題幹：選項之前的所有文字
    if opts_en:
        first_opt = re.search(r'^[A-F]\.[ \t]+\S', head, re.M)
        stem_block = head[:first_opt.start()]
    else:
        stem_block = head
    stem_block = re.sub(r'^(HOTSPOT|DRAG DROP)\s*-\s*$', '', stem_block, flags=re.M)

    votes = dict((l, int(p)) for l, p in re.findall(r'^([A-F]{1,3})\s*\((\d+)%\)\s*$', body, re.M))

    en_stem, zh_stem = split_stem(stem_block)
    return {
        'kind': kind,
        'stem_en': en_stem,
        'stem_zh': zh_stem,
        'stem_block': stem_block.strip(),
        'options_en': opts_en,
        'options_zh': opts_zh,
        'answer': answer_letters,
        'rationale': FOOTER.sub('', rationale).strip(),
        'votes': votes,
        'sections': sections(body),
    }


def main():
    recs = split_questions(read_pdfs())
    out = {}
    for n, body in sorted(recs.items()):
        r = parse(body)
        r['id'] = n
        out[n] = r
    with open(os.path.join(SCRATCH, 'az900_parsed.json'), 'w') as f:
        json.dump(out, f, ensure_ascii=False)
    print('parsed', len(out))
    import collections
    k = collections.Counter(r['kind'] for r in out.values())
    print(k)
    print('無選項且非 hotspot/dragdrop:',
          [n for n, r in out.items() if not r['options_en'] and r['kind'] == 'text'])
    print('text 題缺答案字母:',
          [n for n, r in out.items() if r['kind'] == 'text' and not r['answer']])
    print('缺解析段:', sum(1 for r in out.values() if not r['sections']))
    print('缺英文題幹:', [n for n, r in out.items() if not r['stem_en']])
    print('缺中文題幹:', [n for n, r in out.items() if not r['stem_zh']])


if __name__ == '__main__':
    main()
