聰動小工具 / SmartAction Creative Desk
====================================

開啟：tools/index.html；也可直接在瀏覽器開啟本機 index.html。
將 tools/ 原封不動上傳到 GitHub Pages，即可由 ../tools/ 使用。
核心工具不需要帳號、API key、付費套件、CDN 或網路連線。
未匯出的作品留在目前分頁記憶體中，重新整理會清除；請先下載。
瀏覽器的「保留檔案」與下載位置由各平台決定。iPhone / iPad 可能先開啟預覽，再選分享 > 儲存到檔案。

1. 小畫家
- 滑鼠、觸控筆或手指畫圖，顏色、筆寬、白色橡皮擦、清空與 PNG 下載。
- 匯入照片會等比例置入 1280×720 白色畫布，不會任意拉伸。
- 最多 12 次復原；匯入與清空也可復原。
- 這是簡易筆刷工具，沒有圖層、字體排版或完整桌面繪圖軟體功能。

2. 圖片調整
- PNG / JPEG / WebP 等瀏覽器可解碼圖片，单檔最多 40 MB。
- 來源長邊超過 3000 px 時先縮小，以減少手機記憶體壓力；JPEG EXIF 方向由瀏覽器解碼行為決定。
- 亮度、對比、飽和度、灰階以像素演算法處理，不依賴 Canvas filter 支援。
- 旋轉、裁切及尺寸調整會修改目前基底圖片；「恢復原圖」可回到最初匯入後的尺寸。
- 按「拖曳選取裁切範圍」後在圖片上拖曳；也可直接輸入 X、Y、寬與高，然後套用。
- 尺寸上限 3000×3000。PNG 保留透明度；JPEG 透明區域以白色填入。
- 不支援原始相機 RAW、HEIC 的跨瀏覽器解碼保證，也不是生成式 AI 圖像模型。

3. 簡報工作室
- 支援新增、刪除、排序投影片；標題、內文、背景色與講者筆記。
- JSON 是可再次匯入編輯的專案格式，最多 100 頁；匯入驗證欄位，不執行 JSON 中任何程式。
- 「播放簡報」可用左右方向鍵、PageUp/PageDown、空白鍵換頁，Esc 關閉。
- 可下載自包含 HTML 簡報；HTML 不含講者筆記，文字透過 escaping 處理。
- 可下載單頁 SVG / PNG。HTML 長文可捲動；圖片過長時請分頁。
- 本版不匯出 .pptx，也不聲稱是 Microsoft PowerPoint 的完整替代。

4. 影片裁切
- 選本機影片，在預覽中移動時間，輸入或按鈕設定起訖秒數。
- 使用 Canvas captureStream + MediaRecorder 重新錄製選取範圍，沒有上傳伺服器。
- 「裁切」是重新編碼，並非無損串流裁切。10 秒片段約需 10 秒，依裝置可能更慢。
- 開始/結束為近似影格精度；本版不是專業精確到取樣的剪輯器。
- 輸出最長 10 分鐘，選擇長邊 720/1280/1920；不放大來源影片。
- 依 MediaRecorder.isTypeSupported 選 MP4 或 WebM，副檔名和實際 MIME 相符。
- 有音軌輸出需 Web Audio 支援。來源沒有音軌時，可能輸出靜音音軌；不保證所有影片音訊編碼都可解碼。
- 若音訊介面不支援會停止並提示，可取消「保留聲音」後輸出。
- 錄製期間必須保留分頁在前景；切背景會取消，不下載不完整結果。可隨時取消。
- 不支援多軌剪輯、轉場、字幕、混音、任意格式解碼。移動裝置長片需留意耗電與可用記憶體。
- 每次輸出的暫時 Object URL 會在下載啟動後 30 秒撤銷。匯入影片 URL 在換片或離開時撤銷。

5. 筆記與計算
- 文字 / Markdown 匯入與下載，單檔最多 2 MB。
- 計算機支援加减乘除與百分比，長度換算公尺、公分、英呎。
- 不使用 eval，不把文字當作 HTML 執行。

語言
- 核心介面內建繁體中文與 English，依瀏覽器語言起始，自選會保留在 localStorage。
- 可用 ?lang=zh-Hant 或 ?lang=en 明確指定。
- 主網站可透過 window.SmartActionTools.registerTranslations(code, messages, label) 註冊完整翻譯；再用 setLanguage(code) 切換。
- 此擴充介面不等同已有全部語系翻譯；未加入的工具語言會回到英文。

相容性 / Compatibility
- 需要支援 Canvas 2D、Pointer Events、Blob、Object URL 的現代瀏覽器。
- 影片另需 MediaRecorder、canvas.captureStream，保留聲音需 AudioContext。
- 各平台、瀏覽器、編碼器實際支援不同；這些 API 不保證每部舊手機或每種檔案都可處理。
- Touch-friendly controls, no paid API or server upload. Data stays in the current browser tab.
- Video export runs in real time, requires a visible foreground tab, and outputs supported MP4 or WebM.
- HTML presentation, JSON projects, SVG and PNG are supported. PPTX is not supported.
- Files are not automatically backed up. Export before refreshing or closing.

授權
- 本工具的自製 HTML、CSS、JavaScript 可由聰動網站使用與修改。
- 未複製 Windows、Microsoft、Adobe 等軟體的商標、圖示、原始碼或付費素材。
- 使用者匯入之圖像、影片、文字的權利由使用者自行管理。

