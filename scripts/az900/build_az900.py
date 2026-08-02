#!/usr/bin/env python3
"""AZ-900：把解析出來的記錄組成題庫 JSON（中文 + 英文兩份）。

兩個來源：
  ・PDF 文字層 —— kind == 'text' 的單選／複選題，程式直接轉。
  ・az900_manual.py —— 來源沒有 AI 解析、內容只在截圖裡的 25 題，人工轉錄。
（HOTSPOT 的「完成句子」與 DRAG DROP 之後的批次再接上來。）

寫入前一定要跑驗證，任何一條不過就整批不寫檔 —— 寧可少一批題目，也不要
讓錯的解析進到使用者的錯題本：
  ・答案字母必須存在於選項，每個選項都要有解析
  ・解析的「正確／錯誤」判定必須跟答案一致
  ・配對題每一組都要有解析，且解析開頭的是／否要跟答案一致
  ・人工從截圖轉錄的是非題，要跟 PDF 文字層裡官方的「Box N: Yes/No」對得起來
"""
import json, os, re, sys, collections

SCRATCH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.build')
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.makedirs(SCRATCH, exist_ok=True)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from az900_zh import to_tw  # noqa: E402
from az900_common import unwrap, clean, verdict_of, clean_analysis, TAIL  # noqa: E402
import az900_manual as manual  # noqa: E402
import az900_yesno_auto  # noqa: E402
import az900_sentence_auto  # noqa: E402
import az900_dragdrop_auto  # noqa: E402
from az900_yesno2_zh import YESNO2  # noqa: E402
from az900_sentence2_zh import SENTENCE2  # noqa: E402
from az900_dropdown_single_zh import DROPDOWN_SINGLE  # noqa: E402
from az900_matching2_zh import MATCHING2, ORDERING2  # noqa: E402

EXAM = 'AZ-900'
BANDS = [(1, 100), (101, 200), (201, 300), (301, 400), (401, 474)]
LETTERS = 'ABCDEF'


def band_of(qid):
    for lo, hi in BANDS:
        if lo <= qid <= hi:
            return lo, hi
    raise ValueError(qid)


def split_sec2(sec2, options_en):
    """把「2. 选项分析」拆成 {字母: 該選項的分析}。

    來源格式是每個選項起一行 `A. …` 或 `A: …`，內容可能跨行到下一個字母
    出現為止。字母後面通常會重複一次選項原文，讀起來很囉唆，所以砍掉。
    """
    # 分隔符號不能是選擇性的：`A` 後面若不接 `.`／`、`／`:`，那多半是
    # 「Azure Web App 屬於…」這種以大寫字母開頭的句子，不是選項標記。
    hits = list(re.finditer(r'^[ \t]*(?:选项|選項)?\s*([A-F])[\.、\):：][ \t]*', sec2, re.M))
    hits = [h for h in hits if h.group(1) in options_en]
    out = {}
    for i, h in enumerate(hits):
        end = hits[i + 1].start() if i + 1 < len(hits) else len(sec2)
        chunk = sec2[h.end():end].strip()
        letter = h.group(1)
        # 砍掉開頭重複的選項原文（含常見的括號補充），只留分析本身。
        # options_en 的句尾句號有時候是解析階段自己補上的、chunk 裡的原文
        # 反而沒有（例如原文換行剛好斷在句號前），所以比對時兩邊都要去尾句號。
        opt = options_en.get(letter, '').rstrip('.')
        if opt and chunk.startswith(opt):
            chunk = chunk[len(opt):]
        chunk = re.sub(r'^[\s:：\.、\-—]*(\([^)]*\))?[\s:：\.、\-—]*', '', chunk)
        # 最後一個選項的分析會一路吃到官方答案／投票分布／參考資料，
        # 那些內容含有「正确答案」字樣，會把判定判反，所以先切掉。
        chunk = TAIL.split(chunk)[0]
        out.setdefault(letter, clean(chunk))
    return out


# 來源的 AI 解析跟官方答案打架的少數題目。這裡不是「把判定改成跟答案一樣」
# 就算了 —— 每一條都要寫清楚為什麼官方答案才是對的，否則使用者看到的會是
# 一段自相矛盾的解析。
OVERRIDES = {
    (443, 'D'): (
        'Azure Cloud Shell 是跑在 Azure 端、從瀏覽器操作的殼層，本身就內建 PowerShell 模式與 '
        'Az 模組，腳本是在雲端執行，不是在你本機執行。所以本機是不是 Chrome OS 根本不影響——'
        '只要有瀏覽器就能跑。\n'
        '【答案校正】來源的 AI 解析以「Chrome OS 本身不支援 PowerShell」判這個選項錯誤，'
        '但它誤解了 Cloud Shell 的執行位置；官方答案 A、D、E 才是對的。'
    ),
}


def build_text(rec):
    qid = rec['id']
    ans = rec['answer']
    opts_zh = {k: to_tw(v) for k, v in rec['options_zh'].items()}
    opts_en = dict(rec['options_en'])
    sec = rec['sections']
    per = split_sec2(sec.get('2', ''), opts_en)

    expl = {}
    for L in sorted(opts_zh):
        raw = per.get(L, '')
        if not raw:
            continue
        want = L in ans
        # 判定先驗證再正規化：來源自己的判定跟官方答案不一致時要炸出來
        # （代表解析被切錯了），不能默默用答案覆蓋掉。
        override = OVERRIDES.get((qid, L))
        rec.setdefault('_verdicts', {})[L] = want if override else verdict_of(raw)
        # clean_analysis() 吃簡體原文，把「分析：」開頭、「此选项正确/错误」
        # 「结论：…」這些骨架字樣清掉，避免跟下面自己加的「正確。/錯誤。」
        # 前綴疊成「正確。正確。」。_LEAD 只砍最前面一個判定詞，不夠。
        txt = override if override else to_tw(clean_analysis(raw))
        expl[L] = clean(('正確。' if want else '錯誤。') + txt)
    # 少數題目（見 README 已知問題）§1 知識點段落後面，PDF 版面把重複的
    # 「Correct Answer: .../Community vote .../References: ...」整段黏在
    # 同一段落裡（沒有被下一個「2.」標頭斷開），一路吃進 sec['1']。用 TAIL
    # 砍到第一個這類標記為止，不然 _full 會顯示一整段英文原文＋參考連結。
    s1 = TAIL.split(sec.get('1') or '')[0].strip()
    if s1:
        expl['_full'] = clean(to_tw(s1))

    q = {
        'exam': EXAM, 'id': qid,
        'type': 'single' if len(ans) == 1 else 'multiple',
        'question': clean(to_tw(rec['stem_zh'])),
        'options': opts_zh,
        'answer': ans[0] if len(ans) == 1 else ans,
        'explanations': expl,
    }
    en = {
        'exam': EXAM, 'id': qid,
        'type': q['type'],
        'question': clean(rec['stem_en']),
        'options': opts_en,
        'answer': q['answer'],
        # 來源沒有逐選項的英文解析，只有官方那段英文說明；沒有的話就留空，
        # 由中文版負責解釋，不要自己編一段英文出來。
        'explanations': {},
    }
    return q, en


def validate(zh_all, en_all, parsed):
    errs = []
    for q in zh_all:
        if q['type'] in ('matching', 'ordering'):
            continue  # 交給 validate_manual／validate_ordering
        rec = parsed[str(q['id'])]
        # 用題目自己的答案，不是來源的 —— 人工改判過的題目（見 CHOICE）
        # 兩者本來就會不一樣，那是刻意的。
        ans = q['answer'] if isinstance(q['answer'], list) else [q['answer']]
        letters = set(q['options'])
        if not letters:
            errs.append(f"id {q['id']}: 沒有選項")
        for a in ans:
            if a not in letters:
                errs.append(f"id {q['id']}: 答案 {a} 不在選項中")
        if not q['question']:
            errs.append(f"id {q['id']}: 題幹是空的")
        if re.search(r'[一-鿿]', q['question']) is None:
            errs.append(f"id {q['id']}: 中文題幹沒有中文字，簡繁轉換或切分出錯")
        # 每個選項都要有解析，而且判定要跟答案一致
        for L in letters:
            if L not in q['explanations']:
                errs.append(f"id {q['id']}: 選項 {L} 沒有解析")
                continue
            got = rec.get('_verdicts', {}).get(L)
            want = L in ans
            if got is not None and got != want:
                errs.append(f"id {q['id']}: 選項 {L} 的解析判定（{'正確' if got else '錯誤'}）"
                            f"跟答案不一致（答案{'含' if want else '不含'} {L}）")
    en_ids = {q['id'] for q in en_all}
    zh_ids = {q['id'] for q in zh_all}
    if en_ids != zh_ids:
        errs.append(f'中英題號對不起來：只有中文 {sorted(zh_ids - en_ids)[:5]}，只有英文 {sorted(en_ids - zh_ids)[:5]}')
    return errs


def write_bank(zh_all, en_all):
    zh_by = collections.defaultdict(list)
    en_by = collections.defaultdict(list)
    for q in zh_all:
        zh_by[band_of(q['id'])].append(q)
    for q in en_all:
        en_by[band_of(q['id'])].append(q)
    written = []
    for lo, hi in BANDS:
        for by, tag in ((zh_by, ''), (en_by, 'en_')):
            qs = sorted(by.get((lo, hi), []), key=lambda x: x['id'])
            if not qs:
                continue
            path = os.path.join(REPO, 'public', 'data', f'az_900_{tag}{lo}_{hi}.json')
            with open(path, 'w') as f:
                json.dump(qs, f, ensure_ascii=False, indent=1)
            written.append((os.path.basename(path), len(qs)))
    return written


def build_yesno(qid, spec):
    """是非型 HOTSPOT → 配對題（陳述 → 是／否）。"""
    items = spec['items']
    zh = {
        'exam': EXAM, 'id': qid, 'type': 'matching',
        'question': spec.get('stem_zh', manual.YESNO_STEM_ZH),
        'available_options': ['是', '否'],
        'matches': [{'use_case': z, 'correct_answer': '是' if ok else '否'} for _, z, ok, _ in items],
        'explanations': {str(i + 1): ('是。' if ok else '否。') + ex
                         for i, (_, _, ok, ex) in enumerate(items)},
    }
    if spec.get('full'):
        zh['explanations']['_full'] = spec['full']
    en = {
        'exam': EXAM, 'id': qid, 'type': 'matching',
        'question': spec.get('stem_en', manual.YESNO_STEM_EN),
        'available_options': ['Yes', 'No'],
        'matches': [{'use_case': e, 'correct_answer': 'Yes' if ok else 'No'} for e, _, ok, _ in items],
        'explanations': {},
    }
    return zh, en


def build_matching_generic(qid, spec):
    """DRAG DROP → 配對題，池子是任意詞彙（不像 build_yesno() 固定是是／否）。"""
    matches = spec['matches']
    zh = {
        'exam': EXAM, 'id': qid, 'type': 'matching',
        'question': spec['stem_zh'],
        'available_options': spec['pool_zh'],
        'matches': [{'use_case': m['use_case_zh'], 'correct_answer': m['answer_zh']} for m in matches],
        'explanations': {str(i + 1): m['explain_zh'] for i, m in enumerate(matches)},
    }
    en = {
        'exam': EXAM, 'id': qid, 'type': 'matching',
        'question': spec['stem_en'],
        'available_options': spec['pool_en'],
        'matches': [{'use_case': m['use_case_en'], 'correct_answer': m['answer_en']} for m in matches],
        'explanations': {},
    }
    return zh, en


def build_ordering(qid, spec):
    """DRAG DROP → 排序題。

    這批沒有干擾項——池子裡的項目跟正確答案是同一組，只是順序不同。
    池子（available_steps）如果直接照正確順序給，題目等於沒有排序可做，
    所以用倒序當作起始排列；`ordered_steps` 才是正確順序。
    """
    steps = spec['steps']
    zh_steps = [z for _, z in steps]
    en_steps = [e for e, _ in steps]
    zh = {
        'exam': EXAM, 'id': qid, 'type': 'ordering',
        'question': spec['stem_zh'],
        'available_steps': list(reversed(zh_steps)),
        'ordered_steps': zh_steps,
        'explanations': {f'步驟 {i + 1}': ex for i, ex in enumerate(spec['step_explanations'])} | {'_full': spec['explanation_zh']},
    }
    en = {
        'exam': EXAM, 'id': qid, 'type': 'ordering',
        'question': spec['stem_en'],
        'available_steps': list(reversed(en_steps)),
        'ordered_steps': en_steps,
        'explanations': {},
    }
    return zh, en


def build_choice(qid, spec):
    """人工撰寫的單選／複選題。"""
    ans = spec['answer']
    zh = {
        'exam': EXAM, 'id': qid,
        'type': 'single' if len(ans) == 1 else 'multiple',
        'question': spec['stem_zh'],
        'options': {k: v[1] for k, v in spec['options'].items()},
        'answer': ans[0] if len(ans) == 1 else ans,
        'explanations': {k: (('正確。' if k in ans else '錯誤。') + v) if k != '_full' else v
                         for k, v in spec['explanations'].items()},
    }
    en = {
        'exam': EXAM, 'id': qid,
        'type': zh['type'],
        'question': spec['stem_en'],
        'options': {k: v[0] for k, v in spec['options'].items()},
        'answer': zh['answer'],
        'explanations': {},
    }
    return zh, en


BOX = re.compile(r'Box\s*(\d)\s*[:：]\s*(Yes|No)\b', re.I)


def validate_transcription(parsed):
    """人工從截圖轉錄的是非題，拿來源自己的文字再對一次。

    這 19 題沒有 AI 解析段，所以陳述與答案是我從 Answer Area 截圖讀出來的。
    但其中 10 題的官方英文說明仍以「Box 1: No -」的形式留在 PDF 文字層裡，
    那是一份跟截圖各自獨立的答案來源 —— 兩邊對得起來，才代表圖沒看錯。
    沒有 Box 標記的題目跳過（不是錯誤，只是無從比對）。
    """
    errs = []
    checked = 0
    for qid, spec in manual.YESNO.items():
        boxes = dict((int(i), v.lower() == 'yes')
                     for i, v in BOX.findall(parsed[str(qid)]['rationale']))
        if not boxes:
            continue
        checked += 1
        for i, (_, _, ok, _) in enumerate(spec['items'], 1):
            if i in boxes and boxes[i] != ok:
                errs.append(f'id {qid}: 第 {i} 個陳述，我從截圖讀到的是'
                            f'「{"是" if ok else "否"}」，但來源文字寫的是'
                            f'「{"是" if boxes[i] else "否"}」')
    return errs, checked


def validate_manual(zh_all):
    """人工題的檢查：配對題的答案必須在選項池裡，而且每一組配對都要有解析。

    是非型配對（池子剛好是 {是,否}）額外要求解析開頭要跟答案一致——貼上去的
    解析跟陳述錯位，是這種題目最容易犯的錯，而且錯位後兩邊都還是合法的
    是／否文字，其他檢查抓不到。一般配對（池子是任意詞彙）沒有這個問題，
    答案本身就是文字，錯位會直接被「答案是否在池子裡」那條擋下來。"""
    errs = []
    for q in zh_all:
        if q['type'] != 'matching':
            continue
        pool = set(q['available_options'])
        is_yesno = pool == {'是', '否'}
        for i, m in enumerate(q['matches'], 1):
            if m['correct_answer'] not in pool:
                errs.append(f"id {q['id']}: 第 {i} 組的答案「{m['correct_answer']}」不在選項池裡")
            key = str(i)
            if key not in q['explanations']:
                errs.append(f"id {q['id']}: 第 {i} 組沒有解析")
                continue
            if is_yesno:
                lead = q['explanations'][key][:1]
                if lead != m['correct_answer']:
                    errs.append(f"id {q['id']}: 第 {i} 組的解析開頭是「{lead}」，答案卻是「{m['correct_answer']}」")
        extra = [k for k in q['explanations'] if k != '_full' and not k.isdigit()]
        if extra:
            errs.append(f"id {q['id']}: 解析有多餘的鍵 {extra}")
        if len(q['matches']) < 2:
            errs.append(f"id {q['id']}: 配對題至少要有兩組")
    return errs


def validate_ordering(zh_all):
    errs = []
    for q in zh_all:
        if q['type'] != 'ordering':
            continue
        pool = set(q['available_steps'])
        if set(q['ordered_steps']) - pool:
            errs.append(f"id {q['id']}: ordered_steps 有不在 available_steps 池子裡的項目")
        if len(q['ordered_steps']) != len(set(q['ordered_steps'])):
            errs.append(f"id {q['id']}: ordered_steps 裡有重複的步驟文字，UI 用字串當 key 會分不出來")
        for i in range(1, len(q['ordered_steps']) + 1):
            key = f'步驟 {i}'
            if key not in q['explanations']:
                errs.append(f"id {q['id']}: 缺少「{key}」的解析")
    return errs


def main():
    parsed = json.load(open(os.path.join(SCRATCH, 'az900_parsed.json')))
    auto_yesno, auto_errs = az900_yesno_auto.load(parsed, to_tw, unwrap, clean)
    auto_sentence, sentence_errs = az900_sentence_auto.load(parsed)
    auto_matching, auto_ordering, auto_multiple, dragdrop_errs = az900_dragdrop_auto.load()
    auto_errs = auto_errs + sentence_errs + dragdrop_errs
    if auto_errs:
        print(f'自動抽取批次驗證失敗：{len(auto_errs)} 項，沒有寫入任何檔案')
        for e in auto_errs[:40]:
            print('  -', e)
        sys.exit(1)

    zh_all, en_all, skipped = [], [], collections.Counter()
    for n in sorted(parsed, key=int):
        rec = parsed[n]
        qid = rec['id']
        if qid in manual.YESNO:
            zh, en = build_yesno(qid, manual.YESNO[qid])
        elif qid in auto_yesno:
            zh, en = build_yesno(qid, auto_yesno[qid])
        elif qid in YESNO2:
            zh, en = build_yesno(qid, YESNO2[qid])
        elif qid in manual.CHOICE:
            zh, en = build_choice(qid, manual.CHOICE[qid])
        elif qid in SENTENCE2:
            zh, en = build_choice(qid, SENTENCE2[qid])
        elif qid in DROPDOWN_SINGLE:
            zh, en = build_choice(qid, DROPDOWN_SINGLE[qid])
        elif qid in auto_sentence:
            zh, en = build_choice(qid, auto_sentence[qid])
        elif qid in MATCHING2:
            zh, en = build_matching_generic(qid, MATCHING2[qid])
        elif qid in ORDERING2:
            zh, en = build_ordering(qid, ORDERING2[qid])
        elif qid in auto_matching:
            zh, en = build_matching_generic(qid, auto_matching[qid])
        elif qid in auto_ordering:
            zh, en = build_ordering(qid, auto_ordering[qid])
        elif qid in auto_multiple:
            zh, en = build_choice(qid, auto_multiple[qid])
        elif rec['kind'] != 'text':
            skipped[rec['kind']] += 1
            continue
        elif not rec['sections'].get('2'):
            skipped['text-無選項分析'] += 1
            continue
        else:
            zh, en = build_text(rec)
        zh_all.append(zh)
        en_all.append(en)

    trans_errs, trans_checked = validate_transcription(parsed)
    errs = validate(zh_all, en_all, parsed) + validate_manual(zh_all) + validate_ordering(zh_all) + trans_errs
    if errs:
        print(f'驗證失敗：{len(errs)} 項，沒有寫入任何檔案')
        for e in errs[:40]:
            print('  -', e)
        if len(errs) > 40:
            print(f'  … 還有 {len(errs) - 40} 項')
        sys.exit(1)

    for name, n in write_bank(zh_all, en_all):
        print(f'  {name}: {n}')
    print(f'寫入 {len(zh_all)} 題（中文）／{len(en_all)} 題（英文）')
    print(f'截圖轉錄交叉比對：{trans_checked}/{len(manual.YESNO)} 題有官方 Box 文字可對，全數一致')
    print('略過:', dict(skipped))


if __name__ == '__main__':
    main()
