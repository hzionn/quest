# AZ-900 題庫轉換

來源：`AZ900/` 底下三份 ExamTopics「中文AI解析版」PDF，共 **474 題**。

跟 AZ-104 的來源不同 —— 這份 PDF 的英文題幹、簡體中文翻譯、選項、官方答案、
社群投票分布、逐選項的 AI 解析**都在文字層裡**，所以絕大多數題目不需要讀圖。

## 怎麼跑

```bash
python3 scripts/az900/parse_az900.py    # PDF → .build/az900_parsed.json
python3 scripts/az900/build_az900.py    # → public/data/az_900_*.json
node scripts/gen-bank-index.mjs && node scripts/validate-bank.mjs
```

重跑是冪等的。中間檔在 `.build/`（已 gitignore）。

只有下面這個指令會用到讀圖，給沒有解析段的題目用：

```bash
python3 scripts/az900/render_az900.py 35 48 62   # → .build/q35_0.png …
```

## 檔案

| 檔案 | 做什麼 |
|---|---|
| `parse_az900.py` | PDF → 結構化記錄（題幹、選項、答案、投票、AI 解析五個小節） |
| `az900_zh.py` | 簡轉繁（OpenCC `s2twp`）＋ Azure 台灣術語表 |
| `az900_manual.py` | 來源沒有解析、只能從截圖轉錄的 25 題，人工撰寫 |
| `build_az900.py` | 組成題庫 JSON，寫檔前跑全部驗證 |
| `render_az900.py` | 把指定題目的截圖切出來 |

## 進度

| 型別 | 題數 | 狀態 |
|---|---:|---|
| 單選／複選（文字層直接轉） | 203 | ✅ |
| 只在截圖裡的 19 題 HOTSPOT + 6 題選擇 | 25 | ✅ |
| HOTSPOT 是非 → 配對（自動抽取批次） | 55 | ✅ |
| HOTSPOT「完成句子」→ 單選（自動抽取批次） | 72 | ✅ |
| DRAG DROP → 配對／排序／複選（最乾淨子集） | 18 | ✅ |
| HOTSPOT 是非 → 配對（格式較亂，手動撰寫批次二） | 35 | ✅ |
| HOTSPOT「完成句子」→ 單選（手動撰寫批次二） | 25 | ✅ |
| HOTSPOT 多欄下拉／單一空格 → 單選或配對 | 32 | ✅ |
| 剩餘 DRAG DROP → 配對／排序 | 19 | ✅ |
| **合計** | **474** | **474 完成** |

全部 474 題已轉換完畢。後續若來源 PDF 有更新（新題號、答案修訂），
重跑 `parse_az900.py` + `build_az900.py` 即可增量處理——尚未被任何
`YESNO`/`CHOICE`/`MATCHING`/`ORDERING`/`MULTIPLE` 字典認領的題號，
會被跳過並在 `skipped` 統計中列出，不會誤植空白題目。

批次二／三（是非、完成句子、多欄下拉、剩餘 DRAG DROP）的來源格式明顯比
第一批亂：不少題目的官方答案段（`sections['4']`）本身跟自己的選項分析
矛盾、被截斷、或整段是 AI 產生失敗的樣板文字（「其他選項（未顯示具體
內容）」）。這幾批一律不強行套自動抽取規則，改成：

1. 能用 `sections['2']`／`['3']` 交叉核對出正確內容的，直接手動撰寫
   （`az900_yesno2_zh.py`、`az900_sentence2_zh.py`）。
2. 抽取徹底失敗、選項內容完全不存在於文字層的，用
   `render_az900.py <id>` 截圖答案區，核對圖上標示的官方答案（綠色／
   紅框／黑框）後再手動撰寫（`az900_dropdown_single_zh.py`、
   `az900_matching2_zh.py`）——絕不採信憑空重建或套用其他題目內容
   拼湊出來的答案。

## 驗證（`build_az900.py` 寫檔前一定會跑）

任何一條不過就整批不寫檔：

1. 答案字母必須存在於選項，每個選項都要有解析。
2. 解析的「正確／錯誤」判定要跟答案一致 —— 來源自己判定跟官方答案打架時
   會直接失敗，不會默默用答案蓋過去（見 `OVERRIDES`，目前只有 id 443）。
3. 配對題每一組都要有解析，解析開頭的是／否要跟答案一致。
4. 人工從截圖轉錄的是非題，要跟 PDF 文字層裡官方的 `Box N: Yes/No` 對得起來
   （19 題中有 10 題有這份獨立答案，全數一致）。

改動驗證邏輯之後，記得用突變測試確認它真的會擋：故意把某題答案翻面，
build 應該失敗。

## 已知的答案改判

| id | 官方 | 改成 | 理由 |
|---|---|---|---|
| 117 | A | C | 官方建議 A（事件中樞），社群投票 50%:49% 幾乎平手。事件中樞是事件擷取管線（保留幾天），Azure 監視器才是把資源遙測長期收進 Log Analytics 工作區的服務。 |
| 443 (選項 D) | — | 解析重寫 | 來源解析說「Chrome OS 不支援 PowerShell」判錯，但腳本跑在 Azure Cloud Shell（雲端），與本機作業系統無關。官方答案 A/D/E 正確。 |
| 168 | Dashboard | Service Health | 來源官方答案段本身是壞的（跟自己的選項分析矛盾）；選項分析明確標記「Service Health：正確」，且 Service Health 本來就是用來查看計畫性維護事件的功能。 |
| 199 | （三個節點名稱串在一起，非有效答案） | Access control (IAM) | 官方答案段被污染成把所有候選節點名稱串成一行，不是有效答案。選項分析明確標記「Access control (IAM)：正確」，且指派角色本來就是在 IAM 節點操作。 |
| 276 | Resource costs | Locks | 來源官方答案段本身是壞的；選項分析明確標記「Locks：正確」，且來源自己嵌入的參考文件也在講資源鎖定 (CanNotDelete/ReadOnly)，與「Resource costs」（成本檢視功能）無關。 |
| 328 | Create a resource | Help + support | 來源自己標記的正確選項與其嵌入的官方參考文件矛盾——文件明確指出配額增加要透過「說明及支援 (Help + support)」提出標準配額增加要求。Create a resource 是用來佈建全新資源，跟申請既有配額調整是兩回事。 |

改判一律要在解析裡標註【答案校正】並寫清楚理由。
