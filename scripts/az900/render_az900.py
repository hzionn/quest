#!/usr/bin/env python3
"""把指定題目的頁面截圖出來，給「來源沒有 AI 解析、內容只存在於圖片裡」的
那幾題用（HOTSPOT 的作答區、答案區）。

用法：python3 scripts/az900/render_az900.py 35 48 62
輸出：scripts/az900/.build/q<id>_<n>.png
"""
import fitz, re, sys, os, glob

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(HERE, '.build')
DPI = int(os.environ.get('AZ_DPI', '105'))
HEAD = re.compile(r'Topic \d+\s*\nQuestion #(\d+)')


def page_index():
    """(檔案, 頁碼) → 該頁所屬的題號。題號只在題目第一頁出現，所以往後沿用。"""
    idx = []
    cur = None
    for f in sorted(glob.glob(os.path.join(REPO, 'AZ900', '*.pdf'))):
        d = fitz.open(f)
        for i, p in enumerate(d):
            m = HEAD.findall(p.get_text())
            if m:
                cur = int(m[-1])
            idx.append((f, i, cur))
    return idx


def render(qid, idx):
    out = []
    for f, i, q in idx:
        if q != qid:
            continue
        d = fitz.open(f)
        page = d[i]
        # 只截「內嵌圖片」的範圍：整頁截下來大半是文字，白吃掉一堆 token。
        rects = []
        for x in page.get_images(full=True):
            for r in page.get_image_rects(x[0]):
                if r.width >= 60 and r.height >= 30:
                    rects.append(r)
        if not rects:
            continue
        clip = rects[0]
        for r in rects[1:]:
            clip |= r
        clip = clip + (-6, -6, 6, 6)
        pix = page.get_pixmap(dpi=DPI, clip=clip)
        path = os.path.join(OUT, f'q{qid}_{len(out)}.png')
        pix.save(path)
        out.append(path)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    idx = page_index()
    for qid in (int(a) for a in sys.argv[1:]):
        paths = render(qid, idx)
        print(f'Q{qid}: {len(paths)} 張 -> {" ".join(os.path.basename(p) for p in paths)}')


if __name__ == '__main__':
    main()
