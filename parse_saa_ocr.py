import fitz
import subprocess
import tempfile
import os
import json
import re
import sys

PDF_FILES = [
    'SAA-C03_with_aizh_1-250.pdf',
    'SAA-C03_with_aizh_251-500.pdf',
    'SAA-C03_with_aizh_501-750.pdf',
    'SAA-C03_with_aizh_751-1000.pdf',
    'SAA-C03_with_aizh_1000-1250.pdf',
    'SAA-C03_with_aizh_1251-1500.pdf',
    'SAA-C03_with_aizh_1501-1750.pdf',
    'SAA-C03_with_aizh_1751-2000.pdf',
    'SAA-C03_with_aizh_2001-2124.pdf',
]

def ocr_page(doc, page_num):
    """Render a PDF page to image and OCR it"""
    page = doc[page_num]
    pix = page.get_pixmap(dpi=250)  # Balance quality vs speed

    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
        pix.save(f.name)
        temp_path = f.name

    try:
        result = subprocess.run(
            ['tesseract', temp_path, 'stdout', '-l', 'chi_sim+eng', '--psm', '6'],
            capture_output=True, text=True, timeout=30
        )
        return result.stdout
    except subprocess.TimeoutExpired:
        return ""
    finally:
        os.unlink(temp_path)

def clean_text(text):
    return re.sub(r'\s+', ' ', text).strip()

def split_en_zh(text):
    """Split mixed English/Chinese text into separate parts"""
    text = text.strip()

    # Find where English ends and Chinese begins
    # English question ends with ? and Chinese follows
    m = re.match(r'^(.*?\?)\s*([\u4e00-\u9fff].*)$', text, re.DOTALL)
    if m:
        return clean_text(m.group(1)), clean_text(m.group(2))

    # English statement ends with . and Chinese follows
    # Find first Chinese character that starts a sentence (not AWS terms)
    first_zh = re.search(r'(?<=[.?!])\s+([\u4e00-\u9fff])', text)
    if first_zh:
        return clean_text(text[:first_zh.start()]), clean_text(text[first_zh.start():])

    # Fallback: find first CJK block
    first_cjk = re.search(r'[\u4e00-\u9fff]{3,}', text)
    if first_cjk and first_cjk.start() > 20:
        return clean_text(text[:first_cjk.start()]), clean_text(text[first_cjk.start():])

    return clean_text(text), clean_text(text)

def parse_questions_from_ocr(pages_text):
    """Parse OCR'd text from all pages into structured questions"""
    # Join all pages
    all_text = '\n\n'.join(pages_text)

    # Split by question markers
    pattern = r'(?:Topic\s+\d+\s*\n?\s*)?Question\s+#(\d+)'
    splits = []
    for m in re.finditer(pattern, all_text):
        splits.append({'id': int(m.group(1)), 'index': m.start()})

    print(f"  Found {len(splits)} question markers")

    questions = []
    for i in range(len(splits)):
        start = splits[i]['index']
        end = splits[i+1]['index'] if i+1 < len(splits) else len(all_text)
        block = all_text[start:end].strip()
        qid = splits[i]['id']

        try:
            parsed = parse_question_block(block, qid)
            if parsed:
                questions.append(parsed)
            else:
                print(f"  Warning: Could not parse Q#{qid}")
        except Exception as e:
            print(f"  Error parsing Q#{qid}: {e}")

    return questions

def parse_question_block(block, qid):
    """Parse a single question block into zh and en question objects"""
    # Remove the header line
    block = re.sub(r'^(?:Topic\s+\d+\s*\n?\s*)?Question\s+#\d+\s*', '', block, count=1).strip()

    # Find options - look for standalone "A." at start of line or after whitespace
    # Must be careful not to match things like "S3." "EC2." etc.
    option_positions = []
    for opt_match in re.finditer(r'(?:^|\n)\s*([A-F])\.\s', block):
        letter = opt_match.group(1)
        if not option_positions:
            if letter == 'A':
                option_positions.append({'letter': letter, 'index': opt_match.start()})
        else:
            last = option_positions[-1]['letter']
            if ord(letter) == ord(last) + 1:
                option_positions.append({'letter': letter, 'index': opt_match.start()})

    if len(option_positions) < 2:
        # Try inline options (no newline before A.)
        option_positions = []
        for opt_match in re.finditer(r'(?<![a-zA-Z0-9])([A-F])\.\s(?=[A-Z])', block):
            letter = opt_match.group(1)
            if not option_positions:
                if letter == 'A':
                    option_positions.append({'letter': letter, 'index': opt_match.start()})
            else:
                last = option_positions[-1]['letter']
                if ord(letter) == ord(last) + 1:
                    option_positions.append({'letter': letter, 'index': opt_match.start()})

    if len(option_positions) < 2:
        return None

    # Question text is before first option
    question_text = block[:option_positions[0]['index']].strip()
    if len(question_text) < 10:
        return None

    # Find end of options section (analysis section or answer)
    analysis_markers = [
        r'\n\s*(?:题目分析与解答|题目分析)',
        r'\n\s*Correct\s+Answer\s*[:：]',
        r'\n\s*正确答案\s*[:：]',
        r'\n\s*Community\s+vote',
        r'\n\s*社区投票',
    ]

    options_end = len(block)
    for marker in analysis_markers:
        m = re.search(marker, block[option_positions[0]['index']:])
        if m:
            candidate = option_positions[0]['index'] + m.start()
            if candidate < options_end:
                options_end = candidate

    # Extract options
    en_options = {}
    zh_options = {}

    for i, opt in enumerate(option_positions):
        letter = opt['letter']
        start = opt['index']
        end = option_positions[i+1]['index'] if i+1 < len(option_positions) else options_end

        opt_text = block[start:end].strip()
        # Remove letter prefix
        opt_text = re.sub(r'^[A-F]\.\s*', '', opt_text).strip()
        # Remove "Most Voted" tag
        opt_text = re.sub(r'\s*Most\s+Voted\s*', ' ', opt_text, flags=re.I).strip()

        if opt_text:
            en, zh = split_en_zh(opt_text)
            en_options[letter] = en
            zh_options[letter] = zh

    if len(en_options) < 2:
        return None

    # Find answer
    answer_letters = None
    answer_patterns = [
        r'Correct\s+Answer\s*[:：]\s*([A-F](?:\s*[,、&]\s*[A-F])*)',
        r'正确答案\s*[:：]\s*([A-F](?:\s*[,、&]\s*[A-F])*)',
        r'官方答案\s*(?:[:：是]\s*)?[:：]?\s*([A-F](?:\s*[,、&,]\s*[A-F])*)',
        r'(?:4\.\s*官方答案|官方正确答案)\s+([A-F](?:\s*[,、&,]\s*[A-F])*)',
        r'我选的答案\s*(?:[:：])?\s*([A-F](?:\s*[,、&,]\s*[A-F])*)',
        r'我的答案\s*(?:[:：])?\s*([A-F](?:\s*[,、&,]\s*[A-F])*)',
        r'我的选择\s*(?:[:：])?\s*([A-F](?:\s*[,、&,]\s*[A-F])*)',
    ]

    for pat in answer_patterns:
        m = re.search(pat, block, re.I)
        if m:
            answer_letters = re.findall(r'[A-F]', m.group(1).upper())
            break

    # Fallback: Most Voted
    if not answer_letters:
        mv = re.search(r'([A-F])\.\s+[^\n]*Most\s+Voted', block, re.I)
        if mv:
            answer_letters = [mv.group(1).upper()]

    if not answer_letters:
        return None

    is_multiple = len(answer_letters) > 1

    # Split question into en/zh
    en_question, zh_question = split_en_zh(question_text)

    # Extract explanations from analysis section
    zh_explanations = {}
    en_explanations = {}

    analysis_match = re.search(r'(?:2\.\s*)?选项分析\s*([\s\S]*?)(?=(?:3\.\s*(?:我选的答案|我的答案|我的选择))|(?:Community\s+vote)|$)', block)
    if analysis_match:
        analysis = analysis_match.group(1)
        for letter in en_options:
            next_letter = chr(ord(letter) + 1)
            # Find this option's explanation
            letter_pattern = re.compile(
                rf'(?:^|\n)\s*{letter}[.)]\s+([\s\S]*?)(?=(?:\n\s*{next_letter}[.)]\s)|$)',
                re.M
            )
            m = letter_pattern.search(analysis)
            if m:
                expl = clean_text(m.group(1))
                if len(expl) > 5:
                    zh_explanations[letter] = expl
                    en_explanations[letter] = expl

    # If no per-option explanations, try to get the full explanation
    if not zh_explanations:
        expl_match = re.search(r'(?:题目分析与解答|选项分析)([\s\S]*?)(?=Community\s+vote|社区投票|$)', block)
        if expl_match:
            full_expl = clean_text(expl_match.group(1))
            if len(full_expl) > 10:
                for letter in answer_letters:
                    zh_explanations[letter] = full_expl
                    en_explanations[letter] = full_expl

    zh_q = {
        'exam': 'SAA-C03',
        'id': qid,
        'type': 'multiple' if is_multiple else 'single',
        'question': zh_question,
        'options': zh_options,
        'answer': answer_letters if is_multiple else answer_letters[0],
        'explanations': zh_explanations,
    }

    en_q = {
        'exam': 'SAA-C03',
        'id': qid,
        'type': 'multiple' if is_multiple else 'single',
        'question': en_question,
        'options': en_options,
        'answer': answer_letters if is_multiple else answer_letters[0],
        'explanations': en_explanations,
    }

    return {'zh': zh_q, 'en': en_q}


def main():
    all_zh = []
    all_en = []
    seen_ids = set()

    for pdf_file in PDF_FILES:
        if not os.path.exists(pdf_file):
            print(f"File not found: {pdf_file}, skipping")
            continue

        print(f"Processing: {pdf_file}")
        doc = fitz.open(pdf_file)
        num_pages = len(doc)
        print(f"  {num_pages} pages, OCR'ing...")

        pages_text = []
        for i in range(num_pages):
            if i % 25 == 0:
                print(f"  Page {i+1}/{num_pages}...")
            text = ocr_page(doc, i)
            pages_text.append(text)

        doc.close()

        questions = parse_questions_from_ocr(pages_text)
        print(f"  Parsed {len(questions)} questions")

        for q in questions:
            qid = q['zh']['id']
            if qid not in seen_ids:
                seen_ids.add(qid)
                all_zh.append(q['zh'])
                all_en.append(q['en'])
            else:
                # Update if better explanations
                idx = next((i for i, x in enumerate(all_zh) if x['id'] == qid), None)
                if idx is not None:
                    if len(q['zh']['explanations']) > len(all_zh[idx]['explanations']):
                        all_zh[idx] = q['zh']
                        all_en[idx] = q['en']

    # Sort
    all_zh.sort(key=lambda x: x['id'])
    all_en.sort(key=lambda x: x['id'])

    print(f"\nTotal unique questions: {len(all_zh)}")

    # Stats
    with_expl = sum(1 for q in all_zh if q['explanations'])
    multi = sum(1 for q in all_zh if q['type'] == 'multiple')
    print(f"With explanations: {with_expl}")
    print(f"Multiple choice: {multi}")

    # Write in chunks of 250
    data_dir = os.path.join('.', 'public', 'data')
    zh_files = []
    en_files = []

    for i in range(0, len(all_zh), 250):
        chunk_zh = all_zh[i:i+250]
        chunk_en = all_en[i:i+250]
        start_id = chunk_zh[0]['id']
        end_id = chunk_zh[-1]['id']

        zh_name = f"saa_c03_{start_id}_{end_id}.json"
        en_name = f"saa_c03_en_{start_id}_{end_id}.json"

        with open(os.path.join(data_dir, zh_name), 'w', encoding='utf-8') as f:
            json.dump(chunk_zh, f, ensure_ascii=False, indent=2)
        with open(os.path.join(data_dir, en_name), 'w', encoding='utf-8') as f:
            json.dump(chunk_en, f, ensure_ascii=False, indent=2)

        print(f"Wrote {zh_name} ({len(chunk_zh)} questions)")
        zh_files.append(zh_name)
        en_files.append(en_name)

    # Sample
    if all_zh:
        print("\n--- Sample Q1 (zh) ---")
        print(json.dumps(all_zh[0], ensure_ascii=False, indent=2)[:800])
        print("\n--- Sample Q1 (en) ---")
        print(json.dumps(all_en[0], ensure_ascii=False, indent=2)[:800])

    print("\n--- Manifest ---")
    print("files:", json.dumps(zh_files))
    print("enFiles:", json.dumps(en_files))

if __name__ == '__main__':
    main()
