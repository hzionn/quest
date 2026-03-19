#!/usr/bin/env python3
"""
Extract proper per-option explanations from PDF analysis sections.
Uses embedded text extraction (fast) with character mapping to fix font encoding issues.
"""

import fitz
import json
import re
import os

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

# Load character mapping
with open('/tmp/char_mapping_full.json', 'r') as f:
    CHAR_MAPPING = json.load(f)


def fix_text(text):
    """Apply character mapping to fix font encoding issues."""
    for bad, good in CHAR_MAPPING.items():
        text = text.replace(bad, good)
    return text


def clean_text(text):
    """Normalize whitespace."""
    return re.sub(r'\s+', ' ', text).strip()


def extract_analysis_from_text(text, option_keys):
    """Extract per-option explanations from an analysis section text."""
    explanations = {}

    # Find the 选项分析 section
    analysis_match = re.search(
        r'(?:2\.\s*)?选项分析\s*([\s\S]*?)(?=(?:3\.\s*(?:我选的答案|我的答案|我的选择|官方答案))|(?:IT认证)|$)',
        text
    )
    if not analysis_match:
        return explanations

    analysis = analysis_match.group(1)

    # Extract per-option explanations
    sorted_keys = sorted(option_keys)
    for i, letter in enumerate(sorted_keys):
        next_letter = chr(ord(letter) + 1)

        # Use \Z for end-of-string (not $ which matches end-of-line with re.M)
        if i + 1 < len(sorted_keys):
            next_key = sorted_keys[i + 1]
            pat = re.compile(
                rf'(?:^|\n)\s*{letter}[.)]\s+([\s\S]*?)(?=\n\s*{next_key}[.)]\s)',
                re.M
            )
        else:
            pat = re.compile(
                rf'(?:^|\n)\s*{letter}[.)]\s+([\s\S]*?)(?=\n\s*(?:\d+\.\s*|IT认证)|\Z)',
                re.M
            )

        m = pat.search(analysis)
        if m:
            raw_expl = m.group(1).strip()
            # The explanation includes the English option text followed by Chinese analysis
            # Try to extract just the Chinese analysis part
            expl_text = clean_text(raw_expl)

            if len(expl_text) > 10:
                explanations[letter] = expl_text

    return explanations


def process_pdfs():
    """Extract all explanations from PDFs using embedded text."""
    # Map question ID to explanations
    all_explanations = {}

    for pdf_file in PDF_FILES:
        if not os.path.exists(pdf_file):
            print(f"  Skipping {pdf_file} (not found)")
            continue

        doc = fitz.open(pdf_file)
        print(f"Processing {pdf_file} ({len(doc)} pages)")

        # Concatenate all pages' text
        all_text = ""
        for i in range(len(doc)):
            page_text = doc[i].get_text()
            page_text = fix_text(page_text)
            all_text += page_text + "\n\n"

        doc.close()

        # Split by question markers
        pattern = r'(?:Topic\s+\d+\s*\n?\s*)?Question\s+#(\d+)'
        splits = []
        for m in re.finditer(pattern, all_text):
            splits.append({'id': int(m.group(1)), 'index': m.start()})

        print(f"  Found {len(splits)} questions")

        extracted = 0
        for i in range(len(splits)):
            qid = splits[i]['id']
            start = splits[i]['index']
            end = splits[i + 1]['index'] if i + 1 < len(splits) else len(all_text)
            block = all_text[start:end]

            # Find option keys in this block
            option_keys = []
            for opt_match in re.finditer(r'(?:^|\n)\s*([A-F])\.\s', block):
                letter = opt_match.group(1)
                if not option_keys:
                    if letter == 'A':
                        option_keys.append(letter)
                elif ord(letter) == ord(option_keys[-1]) + 1:
                    option_keys.append(letter)

            if len(option_keys) < 2:
                continue

            explanations = extract_analysis_from_text(block, option_keys)
            if explanations:
                # Keep the better version (more options explained)
                if qid not in all_explanations or len(explanations) > len(all_explanations[qid]):
                    all_explanations[qid] = explanations
                    extracted += 1

        print(f"  Extracted explanations for {extracted} questions")

    return all_explanations


def update_json_files(all_explanations):
    """Update existing JSON data files with proper explanations."""
    data_dir = 'public/data'

    zh_files = [f for f in os.listdir(data_dir) if f.startswith('saa_c03_') and not f.startswith('saa_c03_en_') and f.endswith('.json')]
    en_files = [f for f in os.listdir(data_dir) if f.startswith('saa_c03_en_') and f.endswith('.json')]

    updated_total = 0

    for zh_file in sorted(zh_files):
        filepath = os.path.join(data_dir, zh_file)
        with open(filepath, 'r', encoding='utf-8') as f:
            questions = json.load(f)

        updated = 0
        for q in questions:
            qid = q['id']
            if qid in all_explanations:
                new_expls = all_explanations[qid]
                # Only update if we have meaningful explanations (longer than option text)
                if new_expls and any(len(v) > 50 for v in new_expls.values()):
                    q['explanations'] = new_expls
                    updated += 1

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(questions, f, ensure_ascii=False, indent=2)

        print(f"  Updated {updated} questions in {zh_file}")
        updated_total += updated

    # Also update English files with same explanations (they contain the analysis in Chinese too)
    for en_file in sorted(en_files):
        filepath = os.path.join(data_dir, en_file)
        with open(filepath, 'r', encoding='utf-8') as f:
            questions = json.load(f)

        for q in questions:
            qid = q['id']
            if qid in all_explanations:
                new_expls = all_explanations[qid]
                if new_expls and any(len(v) > 50 for v in new_expls.values()):
                    q['explanations'] = new_expls

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(questions, f, ensure_ascii=False, indent=2)

    print(f"\nTotal updated: {updated_total} questions")
    return updated_total


def main():
    print("=== Extracting explanations from PDFs ===")
    all_explanations = process_pdfs()
    print(f"\nTotal questions with explanations: {len(all_explanations)}")

    # Sample check
    if 1 in all_explanations:
        print("\n--- Sample Q1 explanations ---")
        for k, v in all_explanations[1].items():
            print(f"  {k}: {v[:200]}...")
            print()

    if 715 in all_explanations:
        print("\n--- Sample Q715 explanations ---")
        for k, v in all_explanations[715].items():
            print(f"  {k}: {v[:200]}...")
            print()

    print("\n=== Updating JSON files ===")
    update_json_files(all_explanations)


if __name__ == '__main__':
    main()
