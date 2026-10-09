# 影像動畫工坊

這是一個可直接由靜態網站提供的瀏覽器工具。預設的「本機模式」不需要帳號、API key 或付費服務，也不會上傳檔案。

## 實際提供的功能

- 圖片：用 Canvas 做 Ken Burns 式拉近、拉遠、平移或輕柔呼吸動畫，再用 MediaRecorder 錄成影片。
- 既有影片：在播放時逐格畫入 Canvas，套用暖色、冷色、電影感、黑白等濾鏡，再重新錄製。
- 比例與解析度：16:9、9:16、1:1、4:3；480p、720p、1080p；2–30 秒。
- 瀏覽器格式偵測：Safari 優先嘗試 MP4；其他瀏覽器優先 WebM。下載副檔名依 MediaRecorder 實際 MIME type 決定。
- 可取消、顯示真實本機錄製進度，換檔或關閉頁面時撤銷 Blob/Object URL。
- 提示詞可匯出為純文字檔。

本機模式是影像處理與錄製，**不是生成式 AI**。它不會創造原素材中不存在的人物、物件或動作。目前 Canvas 匯出為無聲影片，未保留原影片音軌。

## 開啟方式

從 `SmartAction` 根目錄啟動既有本機伺服器：

```bash
python3 start_server.py
```

再依終端顯示的網址開啟網站，進入：

```text
動動腦/AI由圖片生成影片/
```

必須使用上述本機 HTTP 或部署後 HTTPS 網址。不要直接雙擊 `index.html`：`file://` 會使 JavaScript 模組和共用語系 JSON 遭瀏覽器限制，工具可能無法啟動。

## 選用的生成式 AI 後端

網頁本身不附模型、不附 API key，也沒有預設付費 API 或免費雲端額度。使用者必須自行部署並信任後端，然後在頁面輸入「基底網址」。localStorage 只保存這個網址；不得把 token、密碼或 API key 貼進網址欄位。

### API 合約

建立工作：

```http
POST {base}/jobs
Content-Type: multipart/form-data
```

欄位：

- `file`: 圖片或影片檔
- `prompt`: 文字提示詞
- `model`: `Wan-AI/Wan2.1-I2V-14B-720P-Diffusers` 或 `THUDM/CogVideoX-5b`
- `task`: `image-to-video` 或 `video-to-video`

建立回應需有 `id` 或 `job_id`。前端接著每兩秒呼叫：

```http
GET {base}/jobs/{id}
```

狀態回應格式：

```json
{
  "status": "queued | running | succeeded | failed | cancelled",
  "progress": 0,
  "result_url": "https://example/result.mp4",
  "output_url": "https://example/result.mp4",
  "error": null,
  "runner": "diffusers",
  "is_mock": false
}
```

`progress` 可用 0–100；前端也接受 0–1。完成時可回傳 `result_url` 或 `output_url`。後端必須配置 CORS 允許網站來源。

若有健康檢查，前端會讀取：

```http
GET {base}/health
```

真正模型服務建議回傳 `{"runner":"diffusers","runner_ready":true}`。若任何健康檢查、建立工作或輪詢回應含 `runner:"mock"` 或 `is_mock:true`，前端會明確標為「預覽／模擬後端」、停止顯示結果，且不會把輸出冒充為 AI 生成。專案附帶後端若以 mock 模式執行，其一秒 ffmpeg 輸出只用來檢查 API 合約，不是模型推論。

「停止等候」只會停止目前分頁的請求與輪詢，不會刪除遠端工作；若要支援遠端取消，需另行設計並取得明確使用者授權。

## 測試

純函式與頁面合約測試不需要額外套件：

```bash
node --test tests/*.test.mjs
node --check app.mjs
```

人工瀏覽器煙霧測試：

1. 上傳一張圖片，選 480p、2 秒，按「製作本機影片」。確認進度到 100%，下載檔可播放且副檔名與畫面徽章一致。
2. 上傳短影片，選黑白濾鏡，先預覽再匯出；確認輸出畫面有套用濾鏡。
3. 錄製中按取消；確認不出現可下載的部分檔。
4. 換檔、重設與離開頁面；確認沒有繼續播放或錄製。
5. 不設定後端時按送出；確認沒有網路工作。設定 mock 後端時，確認頁面明確阻擋／標示非 AI。

瀏覽器對 MediaRecorder 的編碼器支援不同；若 1080p 失敗，先改用 720p 或 480p，並以最新版 Safari、Chrome、Edge 或 Firefox 測試。
