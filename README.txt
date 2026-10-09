聰動知識與互動網站完整套件 — 2026-10-09
SmartAction Knowledge & Interactive Website
============================================================

先看 deployment.html：這是本版完整的設定、Git 上傳、GitHub Pages、
市場資料後端、商品與大檔案部署操作說明。舊版配置文件保留作參考；
若內容衝突，請以 deployment.html 與本次各模組 README 為準。

一、立即開啟

解壓縮完整套件，保留 SmartAction 資料夾的內部相對路徑。
主要入口：index.html
中文檔名入口：社團法人高雄市聰動成長協會.html
兩者為同一新版主頁內容；日後修改應同步更新兩檔，或使用附上的建置腳本。
association-original.html 是保留的舊版協會首頁，供對照，不是新版入口。

建議先以本機伺服器開啟完整網站。Mac / Linux 在 SmartAction 資料夾執行：

  python3 -m http.server 8000

Windows（已安裝 Python）可執行：

  py -m http.server 8000

然後開啟：

  http://localhost:8000/
  http://localhost:8000/deployment.html

若 8000 已被使用，可改成 8080。關閉伺服器按 Ctrl+C。
直接雙擊 HTML 可閱讀部分頁面與使用小工具，但完整模型載入、Worker、
Service Worker 等瀏覽器功能需要 localhost 或 HTTPS，不應用 file:// 測試。

二、主要內容與目錄

  index.html                 新版首頁與小型資料夾入口
  knowledge.html             巴金森主題知識
  resources.html             臺灣與國際資源目錄
  quiz.html                  100 題互動題庫
  question-bank.html         可閱讀的題庫總覽
  videos.html                影音入口與查核狀態
  editorial.html             資料來源、翻譯及編輯政策
  deployment.html            本版主要部署教學
  blog/                      48 個既有文章頁
  assets/                    樣式、介面翻譯、題目、來源、影片與文章目錄
  play/                      3 個獨立育樂專案入口
  tools/                     5 組免費本機瀏覽器創作工具
  market/                    公益小物構想、行情資料介接與科技分析
  assistant/                 本機來源卡與實驗性生成模型
  backend/market-worker/     選用的市場資料代理後端
  docs/、scripts/、tests/     維護、建置與驗證資料
  社團法人高雄市聰動成長協會_files/  原提供的圖像等資產
  association-original.html、parkinson.html、動動腦/ 等
                             保留的原有內容與舊版互動工具

100 題中有 85 題巴金森相關知識及 15 題協會／站內資源導覽，
合計 80 題單選、20 題簡單填空；來源按鈕提供可追查連結與段落。
48 既有文章頁包括 33 個可用摘要、14 個標題／連結占位與 1 個影片紀錄。
找到 14 個不同 YouTube 影片 ID，不等同逐部看過完整內容；沒有為未查核
影片編造秒數或逐字稿。完整查核範圍見 editorial.html 和 assets/video-audit.json。

三、多語與多平台的實際範圍

- 主頁導覽介面：22 語；依瀏覽器語言與手動選擇，不是精確位置偵測。
- 知識主題頁：繁體中文、簡體中文、英文 3 語。
- 100 題互動題庫：繁體中文與英文。
- 創作小工具、消費與投資、育樂與編輯政策：完整繁體中文與英文。
- 知識助理的介面／來源卡：繁中、簡中、英文；實驗模型僅定位為英文短答。
- 22 種介面語言不表示所有原始醫療文章均已有 22 語完整翻譯。
- 使用者可改選語言，未提供的次頁語言會回退英文。
- 使用標準 HTML / CSS / JavaScript，不需安裝 Windows 應用程式。
  現代 Windows、macOS、Linux、Android、iOS 瀏覽器可依支援能力使用。
  各瀏覽器的影片編碼、WASM、儲存空間與記憶體支援不同；請見各頁能力提示。

四、育樂入口與小工具

play/ 直接連到使用者提供的三個獨立 GitHub Pages 專案：

  https://kuonanhong.github.io/AERO_Explorer/
  https://kuonanhong.github.io/Frame_to_Video/
  https://kuonanhong.github.io/3x3Basketball/

本套件保留動動腦/ 的舊版本機工具，不把它們宣稱為上述三個最新專案的
完整執行程式副本。各外部專案的版本與功能由各專案維護；育樂入口不要求
先看 YouTube 或點擊其他網站才能使用。

tools/ 內含：小畫家、圖片調整、簡報工作室、影片裁切、筆記與計算。
均有實際本機處理與下載功能；沒有複製桌面 Windows 應用程式。
簡報匯出 HTML / SVG / PNG / JSON，不匯入或輸出原生 PowerPoint .pptx。
影片依瀏覽器能力輸出 MP4 或 WebM，為即時重新編碼而非無損剪輯。
詳細範圍見 tools/README.txt。

五、離線 AI、容量與資料服務

本版解壓快照約 147 MiB（最終包大小可能因說明與測試記錄略有變動）。
其中 assistant/ 的模型、tokenizer、執行環境等約 120 MB；訪客開啟主頁
不會自動下載這批大型檔案，只有主動啟動本機模型時才按需載入。
本次檔案盤點每個單檔皆低於 100 MiB；最大 ONNX 檔為 59,339,331 bytes。
MB = 1,000,000 bytes；MiB = 1,048,576 bytes。

助手內含 FLAN-T5-small int8 ONNX 權重、Transformers.js 與 ONNX Runtime Web。
來源卡檢索與真正的神經網路生成分開標示；不需付費 AI API。
模型在裝置上執行，但初次從網站下載仍會耗用網站流量與裝置儲存。
首次快取後的離線能力受瀏覽器快取保留影響；可靠離線方式是保存完整套件，
斷網時以 localhost 提供檔案。詳見 assistant/README.txt。
不保證所有手機都能載入模型，不以本套件宣稱十萬人同時首下載的服務保證。

GitHub Pages 是靜態網站。全球即時市場資料、付費資料授權與付款處理需要
另外設定相應服務；本包提供可操作介面、資料檢查與選用代理程式，未設定的
實況行情不應被當成已接通。商品價格、庫存、收款與訂購聯絡方式需由維護者
填妥後再對外販售。資料來源、時間、示範狀態與限制應保留顯示。

六、上傳 GitHub Pages

先閱讀 deployment.html，並備份現有網站。將本資料夾「內容」放進
SmartAction repository 的發布根目錄，避免多包一層 SmartAction/。
保留 .nojekyll 與全部相對路徑。不要把整個 ZIP 當成網站程式上傳。

已有本機 repository 時，在 repository 資料夾執行：

  git status
  git pull --ff-only

確認無未處理衝突後，複製本次要更新的網站檔案，然後：

  git add -- .
  git diff --cached --stat
  git commit -m "Update SmartAction knowledge portal"
  git push origin main

以上 main 是範例分支；請依自己 repository 的實際發布分支修改。
git pull 是下載遠端更新，git push 才是上傳本機提交。
Pages 設定、大檔處理、模型檔案與選用後端的細節，見 deployment.html。
請保留第三方 LICENSE / NOTICE 與來源資訊；本包未代替您修改已上線網站。

七、來源、權利與用途

原協會圖像、文章、影片連結與既有第三方素材的權利狀態維持原樣；
這次整理不替整包原始素材重新指定開源授權。新增頁面與實作的組織方式
也不代表原醫療來源或協會對所有新增內容背書。授權定位詳見
THIRD_PARTY_NOTICES.txt 與 assistant/vendor/ 的原始授權全文。
醫療與投資頁面是知識教育，請核對來源並依個人情況諮詢合格專業人員。

------------------------------------------------------------
ENGLISH QUICK START
------------------------------------------------------------

Read deployment.html for the current, detailed deployment instructions.
Keep the extracted directory structure intact. index.html is the new entry
point; the Chinese-named association HTML is the same homepage. Keep both
in sync when editing. association-original.html preserves the old homepage.

From the SmartAction directory, run:

  python3 -m http.server 8000

On Windows with Python installed, use: py -m http.server 8000
Open http://localhost:8000/ . Full model, Worker and service-worker behavior
requires localhost or HTTPS; opening file:// is not a full-site test.

The package contains a source-based Parkinson’s knowledge hub, resource
directory, 100 questions (85 Parkinson’s + 15 association/navigation;
80 multiple-choice + 20 short fill-in), video inventory, five local creative
tools, commerce/market interfaces, an optional market proxy, and a local AI
assistant. The three play cards link to the user’s independent AERO_Explorer,
Frame_to_Video and 3x3Basketball projects. Preserved legacy local games are
not represented as full copies of those projects’ current releases.

Language scope: 22 homepage interface languages; 3 knowledge-page languages
(Traditional Chinese, Simplified Chinese, English); 2 quiz/tool languages
(Traditional Chinese, English). The assistant has three interface/source-card
languages but experimental generation is scoped to short English answers.
Browser language and visitor choice are used, not silent geolocation.

The extracted snapshot is approximately 147 MiB. The assistant model/runtime
is about 120 MB and loads on demand, not with the homepage. Every file in
this snapshot is below 100 MiB. Models and runtimes are included locally;
no paid AI API is needed. Device memory and codec support vary. This package
does not guarantee capacity for 100,000 simultaneous first-time model loads.

Slides export HTML/SVG/PNG/JSON, not native PPTX. Video trimming re-encodes in
real time into a browser-supported MP4 or WebM. Live financial data, provider
licenses, merchant details and payment services require appropriate setup;
GitHub Pages itself does not execute the optional backend.

There are 48 legacy article pages (33 usable summaries, 14 placeholders,
one video record) and 14 identified YouTube video IDs. This is not a claim
that all full articles or videos were read or watched. Unverified video
timestamps are not invented. See editorial.html for evidence boundaries.

Use git pull to download changes and git push to upload commits. Follow
deployment.html for the repository branch, Pages publishing root, model
files and optional backend. The delivered package does not itself publish
or replace your currently live site.

Original association assets and source material retain their existing
rights. No blanket open-source license is assigned to the entire archive.
Keep THIRD_PARTY_NOTICES.txt and bundled LICENSE/NOTICE files with the code.

