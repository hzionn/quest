"""
OCR-based parser for the GCP Professional Cloud Architect (PCA) PDFs.

The source PDFs have a corrupted text layer (wrong ToUnicode mapping), so the
embedded text extracts as garbled CJK. The *rendered* glyphs are correct,
so we render each page to an image and OCR it with tesseract (chi_sim+eng).

OCR output is cached per-PDF to <pdf>.ocr.txt so the parsing logic can be
iterated without re-running the (slow) OCR pass. Delete the cache to force a
re-OCR.

Output matches the JSON schema used by the app (same as parse_gcp_pca.mjs).
"""
import fitz
import subprocess
import tempfile
import os
import json
import re
import sys
from multiprocessing import Pool

EXAM_CODE = 'PCA'
DPI = 200
WORKERS = 4
# One thread per tesseract; parallelism comes from the worker pool.
os.environ.setdefault('OMP_THREAD_LIMIT', '1')

# (pdf path, output zh json, output en json, id_mode, id_base)
#   id_mode 'marker'     -> use the "Question #N" number as the id (continuous,
#                           unique numbering across the Topic 1 dump)
#   id_mode 'seq'        -> assign sequential ids from id_base in document order
#                           (used for the case-study PDF where each Topic
#                           restarts its question numbering at #1)
JOBS = [
    ('GCP/Professional Cloud Architect_with_aizh-1-200.pdf',
     'public/data/pca_1_98.json', 'public/data/pca_en_1_98.json', 'marker', 0),
    ('GCP/Professional Cloud Architect_with_aizh-201-400.pdf',
     'public/data/pca_99_191.json', 'public/data/pca_en_99_191.json', 'marker', 0),
    ('GCP/Professional Cloud Architect_with_aizh-401-600.pdf',
     'public/data/pca_192_267.json', 'public/data/pca_en_192_267.json', 'marker', 0),
    ('GCP/Professional Cloud Architect_with_aizh-601-768.pdf',
     'public/data/pca_268_345.json', 'public/data/pca_en_268_345.json', 'seq', 268),
]


def _ocr_one(args):
    """Worker: render one page of a PDF to PNG and OCR it. Returns (idx, text)."""
    pdf_path, page_num = args
    doc = fitz.open(pdf_path)
    try:
        pix = doc[page_num].get_pixmap(dpi=DPI)
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
            pix.save(f.name)
            tmp = f.name
    finally:
        doc.close()
    try:
        res = subprocess.run(
            ['tesseract', tmp, 'stdout', '-l', 'chi_sim+eng', '--psm', '6'],
            capture_output=True, text=True, timeout=180
        )
        return page_num, res.stdout
    except subprocess.TimeoutExpired:
        return page_num, ''
    finally:
        os.unlink(tmp)


def ocr_pdf_cached(pdf_path):
    cache = pdf_path + '.ocr.txt'
    if os.path.exists(cache):
        with open(cache, encoding='utf-8') as f:
            return f.read()
    doc = fitz.open(pdf_path)
    n = len(doc)
    doc.close()
    print(f'  OCR {n} pages with {WORKERS} workers (dpi={DPI})...', flush=True)
    results = [''] * n
    done = 0
    with Pool(WORKERS) as pool:
        for idx, text in pool.imap_unordered(_ocr_one, [(pdf_path, i) for i in range(n)]):
            results[idx] = text
            done += 1
            if done % 20 == 0 or done == n:
                print(f'    {done}/{n} pages done', flush=True)
    full = '\n\f\n'.join(results)
    with open(cache, 'w', encoding='utf-8') as f:
        f.write(full)
    return full


# ── Text helpers ──
CJK_RE = re.compile(r'[一-鿿]')

# Footer / noise lines to drop entirely
NOISE_PATTERNS = [
    re.compile(r'IT\s*认证轻松过'),
    re.compile(r'taobao\.com'),
    re.compile(r'goofish\.com'),
    re.compile(r'[Ee][Xx]?[Aa][Mm][Tt][Oo][Pp][Ii][Cc][Ss]'),
    re.compile(r'Professional\s+Cloud\s+Architect\s*[\(（]\s*\d{4}'),
    re.compile(r'^\s*微信\s*[:：]'),
    re.compile(r'^\s*淘宝\s*[:：]'),
    re.compile(r'^\s*[闲咸]鱼\s*[:：]'),
    re.compile(r'shop\d+'),
    re.compile(r'userld|userId'),
    re.compile(r'Community\s+vote\s+distribution'),
    re.compile(r'^\s*社区投票分布'),
    re.compile(r'wechat'),
]


def strip_noise_lines(text):
    out = []
    for line in text.split('\n'):
        s = line.strip()
        if not s:
            out.append('')
            continue
        if any(p.search(s) for p in NOISE_PATTERNS):
            continue
        # Drop lines that are mostly OCR garbage (few CJK, lots of symbols)
        out.append(line)
    return '\n'.join(out)


def clean_inline(text):
    """Collapse whitespace within a single logical string."""
    # Remove spaces between CJK chars (OCR sometimes inserts them)
    text = re.sub(r'\s+', ' ', text).strip()
    text = re.sub(r'(?<=[一-鿿])\s+(?=[一-鿿])', '', text)
    # Normalize spaces around common CJK punctuation
    text = re.sub(r'\s*([，。、；：！？（）「」『』【】《》])\s*', r'\1', text)
    return text.strip()


def first_cjk_idx(s):
    m = CJK_RE.search(s)
    return m.start() if m else -1


def split_en_zh(text):
    """Split a chunk that has English first then Chinese into (en, zh)."""
    t = text.strip()
    ci = first_cjk_idx(t)
    if ci < 0:
        return clean_inline(t), ''
    en = clean_inline(t[:ci])
    zh = clean_inline(t[ci:])
    return en, zh


# ── Block parsing ──
def split_blocks(full_text):
    """Return list of (qid, block_text) split on 'Question #N'."""
    marks = list(re.finditer(r'Question\s*#\s*(\d+)', full_text))
    blocks = []
    for i, m in enumerate(marks):
        qid = int(m.group(1))
        start = m.start()
        end = marks[i + 1].start() if i + 1 < len(marks) else len(full_text)
        blocks.append((qid, full_text[start:end]))
    return blocks


def find_option_positions(block):
    """Find A./B./.../F. option markers (line-start preferred)."""
    # Tier 1: line-start marker with punctuation ("A.", "A)", "A、"). Allow zero
    # spaces after the dot to catch numbered-substep options like "A.1.Define".
    positions = []
    for m in re.finditer(r'(?:^|\n)[ \t]*([A-F])[.\．、)]\s*(?=\S)', block):
        positions.append((m.group(1), m.start(1), m.end()))
    chain = _best_chain(positions)
    if len(chain) >= 3:
        return chain
    # Tier 2: line-start marker where OCR dropped the punctuation ("A App Engine").
    # Letter followed by whitespace then content; the consecutive A..F chain
    # requirement keeps stray sentence lines from matching.
    positions = []
    for m in re.finditer(r'(?:^|\n)[ \t]*([A-F])(?:[.\．、)]|[ \t])[ \t]*(?=\S)', block):
        positions.append((m.group(1), m.start(1), m.end()))
    chain = _best_chain(positions)
    if len(chain) >= 3:
        return chain
    # Tier 3: inline with punctuation.
    positions = []
    for m in re.finditer(r'(?<![A-Za-z0-9])([A-F])[.\．)]\s+', block):
        positions.append((m.group(1), m.start(1), m.end()))
    return _best_chain(positions)


def _best_chain(positions):
    best = []
    for i, (letter, idx, _end) in enumerate(positions):
        if letter != 'A':
            continue
        chain = [positions[i]]
        expected = 'B'
        for j in range(i + 1, len(positions)):
            if positions[j][0] == expected and positions[j][1] > chain[-1][1]:
                chain.append(positions[j])
                expected = chr(ord(expected) + 1)
                if expected > 'F':
                    break
        if len(chain) > len(best):
            best = chain
    return best


ANALYSIS_HEADERS = re.compile(
    r'(?:题目分析与解答|题目分析|题目解析|选项分析|逐个分析|独立分析每个选项|独立思考)')
# Capture the answer letters that may be contiguous ("CDE"), space- or
# comma-separated ("A C", "A, C"); stop at end of line (no newline in class).
ANSWER_PATTERNS = [
    re.compile(r'Correct\s+Answer\s*[:：]\s*([A-F][ \tA-F,、&]{0,14})', re.I),
    re.compile(r'正确答案\s*[:：]?\s*([A-F][ \tA-F,、&]{0,14})'),
    re.compile(r'官方答案\s*[:：]?\s*([A-F][ \tA-F,、&]{0,14})'),
]


def extract_answer(block):
    for pat in ANSWER_PATTERNS:
        m = pat.search(block)
        if m:
            letters = re.findall(r'[A-F]', m.group(1).upper())
            if letters:
                # de-dup preserve order
                seen = []
                for l in letters:
                    if l not in seen:
                        seen.append(l)
                return seen
    # Fallback: Most Voted
    mv = re.search(r'([A-F])[.\．]\s+[^\n]*Most\s+Voted', block, re.I)
    if mv:
        return [mv.group(1).upper()]
    return None


def extract_explanations(block, letters, opts_end):
    """Pull per-option analysis text from the analysis section."""
    out = {}
    hm = ANALYSIS_HEADERS.search(block, opts_end)
    if not hm:
        return out
    analysis = block[hm.start():]
    # Truncate at the self-reflection / official-answer recap sections
    cut = re.search(r'\n\s*[3-6]\s*[.\．]\s*(?:我[的选選]|官方答案|与官方|比较)', analysis)
    if cut:
        analysis = analysis[:cut.start()]

    # An option heading is the letter followed by punctuation ("A.", "A)") or a
    # Chinese label ("A选项分析:", "A 选项:"), or the reversed Chinese form
    # ("选项A", "选项 C").
    def heading(letter):
        return (rf'(?:^|\n)\s*(?:{letter}(?:[.\．、)]|\s*选项\s*分析|\s*选项)'
                rf'|选项\s*{letter})\s*[:：]?\s*')

    for i, letter in enumerate(letters):
        nxt = letters[i + 1] if i + 1 < len(letters) else None
        # Find an option-letter heading inside the analysis that is followed by CJK soon after
        starts = list(re.finditer(heading(letter), analysis))
        chosen = None
        for s in starts:
            after = analysis[s.end():s.end() + 200]
            if CJK_RE.search(after):
                chosen = s
                break
        if not chosen and starts:
            chosen = starts[-1]
        if not chosen:
            continue
        start = chosen.end()
        if nxt:
            tail = re.search(heading(nxt), analysis[start:])
            end = start + tail.start() if tail else len(analysis)
        else:
            tail = re.search(r'\n\s*[3-6]\s*[.\．]\s*(?:我[的选選]|官方|与官方|比较|总结)', analysis[start:])
            end = start + tail.start() if tail else len(analysis)
        expl = clean_inline(analysis[start:end])
        # Drop a leading English restatement of the option if both en+zh present:
        # keep full text (it's informative). Require some Chinese.
        if len(expl) >= 5:
            out[letter] = expl
    return out


def parse_block(qid, raw):
    block = strip_noise_lines(raw)
    # Drop the leading "Question #N ... Topic X" header line remnants
    block = re.sub(r'^\s*Question\s*#\s*\d+\s*', '', block, count=1)
    block = re.sub(r'(?:^|\n)\s*Topic\s+\d+\s*', '\n', block, count=1)

    # The question+options live before the first answer / analysis marker. Detect
    # options only in that region so we never latch onto the A./B./C./D. option
    # restatements inside the analysis section ("3. 选项分析").
    boundary = len(block)
    for pat in (ANSWER_PATTERNS[0], ANSWER_PATTERNS[1], ANSWER_PATTERNS[2], ANALYSIS_HEADERS):
        m = pat.search(block)
        if m:
            boundary = min(boundary, m.start())
    head_region = block[:boundary]

    opts = find_option_positions(head_region)
    if len(opts) < 3:
        return None

    first_opt_idx = opts[0][1]
    q_en, q_zh = split_en_zh(head_region[:first_opt_idx])
    if not q_en and not q_zh:
        return None

    # Options end at the region boundary.
    opts_end = boundary

    en_options, zh_options = {}, {}
    for i, (letter, idx, end_of_marker) in enumerate(opts):
        start = end_of_marker
        end = opts[i + 1][1] if i + 1 < len(opts) else opts_end
        chunk = block[start:end]
        chunk = re.sub(r'\s*Most\s+Voted\s*', ' ', chunk, flags=re.I)
        en, zh = split_en_zh(chunk)
        en_options[letter] = en
        zh_options[letter] = zh or en

    if sum(1 for v in en_options.values() if v) < 3 and \
       sum(1 for v in zh_options.values() if v) < 3:
        return None

    answer = extract_answer(block)
    if not answer:
        return None
    answer = [l for l in answer if l in en_options]
    if not answer:
        return None
    is_multi = len(answer) > 1
    qtype = 'multiple' if is_multi else 'single'

    expl = extract_explanations(block, list(en_options.keys()), opts_end)

    zh_obj = {
        'exam': EXAM_CODE, 'id': qid, 'type': qtype,
        'question': q_zh or q_en,
        'options': zh_options,
        'answer': answer if is_multi else answer[0],
        'explanations': expl,
    }
    en_obj = {
        'exam': EXAM_CODE, 'id': qid, 'type': qtype,
        'question': q_en or q_zh,
        'options': en_options,
        'answer': answer if is_multi else answer[0],
        'explanations': expl,
    }
    return zh_obj, en_obj


def process(pdf_path, zh_out, en_out, id_mode='marker', id_base=0):
    print(f'Processing {pdf_path} (id_mode={id_mode})')
    full = ocr_pdf_cached(pdf_path)
    full = full.replace('\f', '\n')
    blocks = split_blocks(full)

    if id_mode == 'seq':
        # Per-topic numbering repeats, so assign sequential ids in document
        # order. Parse first, then number only the questions that parsed, so a
        # dropped block does not shift everything after it confusingly — gaps
        # are acceptable and the running counter stays tied to good questions.
        zh_list, en_list = [], []
        next_id = id_base
        skipped = 0
        for marker_qid, raw in blocks:
            parsed = parse_block(marker_qid, raw)
            if not parsed:
                skipped += 1
                continue
            zh, en = parsed
            zh['id'] = next_id
            en['id'] = next_id
            zh_list.append(zh)
            en_list.append(en)
            next_id += 1
        ids = [q['id'] for q in zh_list]
        print(f'  parsed {len(ids)} questions, ids '
              f'{ids[0] if ids else "-"}..{ids[-1] if ids else "-"} '
              f'(skipped {skipped} blocks)')
    else:
        # de-dup qid keep first complete
        by_id = {}
        for qid, raw in blocks:
            parsed = parse_block(qid, raw)
            if not parsed:
                continue
            zh, en = parsed
            prev = by_id.get(qid)
            if prev is None or len(zh['explanations']) > len(prev[0]['explanations']):
                by_id[qid] = (zh, en)
        ids = sorted(by_id)
        print(f'  parsed {len(ids)} questions, ids '
              f'{ids[0] if ids else "-"}..{ids[-1] if ids else "-"}')
        missing = [i for i in range(ids[0], ids[-1] + 1) if i not in by_id] if ids else []
        if missing:
            print(f'  MISSING ids: {missing}')
        zh_list = [by_id[i][0] for i in ids]
        en_list = [by_id[i][1] for i in ids]

    with open(zh_out, 'w', encoding='utf-8') as f:
        json.dump(zh_list, f, ensure_ascii=False, indent=2)
    with open(en_out, 'w', encoding='utf-8') as f:
        json.dump(en_list, f, ensure_ascii=False, indent=2)
    print(f'  wrote {zh_out} / {en_out}')
    return ids


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for pdf, zh_out, en_out, id_mode, id_base in JOBS:
        if only and only not in pdf:
            continue
        process(pdf, zh_out, en_out, id_mode, id_base)


if __name__ == '__main__':
    main()
