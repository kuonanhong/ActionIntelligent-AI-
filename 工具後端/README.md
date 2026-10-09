# SmartAction 本機影片工作後端（選用）

這是網頁中「圖片轉影片／影片轉影片」工具的**本機選用後端**。GitHub Pages 只能托管靜態檔案，不能在瀏覽器端執行 Wan 或 CogVideoX 權重；因此前端必須由使用者明確設定後端網址，不會使用假的雲端服務。

## API 契約

- `GET /health`
- `POST /jobs`（`multipart/form-data`）
  - `file`：必要的圖片或影片
  - `prompt`：1–4000 字元
  - `task`：`image-to-video` 或 `video-to-video`
  - `model`：
    - 圖轉影片：`Wan-AI/Wan2.1-I2V-14B-720P-Diffusers`
    - 影轉影片：`THUDM/CogVideoX-5b`
- `GET /jobs/{id}`：狀態為 `queued` / `running` / `succeeded` / `failed`，`progress` 為 0–100。
- `GET /outputs/{name}`：成功時由 `result_url` 與 `output_url` 回傳。

`POST /jobs` 同時回傳 `id` 與 `job_id`，方便新舊前端相容。回應也會含 `runner` 和 `is_mock`，前端必須把 mock 結果明顯標示為「契約測試預覽，非 AI 生成」。作業只在一個 worker 中依序執行，避免多作業同時搜括 GPU 記憶體。佇列預設最多 4 份工作，滿載時回傳 HTTP 429。作業狀態儲存於記憶體，服務重啟後不保留。

## 1. 不下載權重的本機測試

需要 Python 3.10 以上和 `ffmpeg` / `ffprobe`。

```bash
cd "工具後端"
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

開啟 <http://127.0.0.1:8000/health> 應看到 `runner: "mock"`。`mock` 只用 ffmpeg 產生 1 秒預覽，**不是 AI 生成**，用來測試上傳、排隊、查詢及下載契約。

執行測試：

```bash
python -m pip install -r requirements-dev.txt
pytest -q
```

## 2. 明確啟用真實 Diffusers 後端

1. 使用 [PyTorch 官方選擇器](https://pytorch.org/get-started/locally/) 安裝與主機 NVIDIA 驅動相容的 CUDA 版 PyTorch。
2. 再安裝模型套件：`python -m pip install -r requirements-models.txt`。
3. 確認有足夠的磁碟、系統記憶體與 GPU 記憶體，並閱讀模型頁面的授權與存取條件。本專案不保證權重可匿名或免費下載。
4. 明確允許載入／下載大型權重後才啟動：

```bash
export SMARTACTION_RUNNER=diffusers
export SMARTACTION_ALLOW_MODEL_DOWNLOADS=1
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

實作使用 Diffusers 官方 `WanImageToVideoPipeline` 和 `CogVideoXVideoToVideoPipeline` API：

- [Wan pipeline 文件](https://huggingface.co/docs/diffusers/api/pipelines/wan)
- [CogVideoX video-to-video 文件](https://huggingface.co/docs/diffusers/api/pipelines/cogvideox)
- [Wan 2.1 720P 模型頁](https://huggingface.co/Wan-AI/Wan2.1-I2V-14B-720P-Diffusers)
- [CogVideoX-5B 模型頁](https://huggingface.co/THUDM/CogVideoX-5b)

**重要：**這個儲存庫沒有 GPU，所以真實模型的權重載入與推論未在此處實測。大型影片擴散模型在 Mac CPU 上不實際；Apple Silicon / MPS 也不是本後端已驗證的執行路徑。不應用 `mock` 成功代表真實模型可用。
模型權重的授權與存取條件獲立於 Diffusers 程式庫授權，使用前必須另行查閱上述模型頁面。

## 安全邊界

- 預設 CORS 只允許 `localhost` / `127.0.0.1` 和 `https://kuonanhong.github.io`，無萬用字元。可用逗號分隔的 `SMARTACTION_CORS_ORIGINS` 調整。
- 預設單檔上限 100 MiB，影片最長 12 秒，圖片最多 4,000 萬畫素。可以 `SMARTACTION_MAX_UPLOAD_BYTES`、`SMARTACTION_MAX_VIDEO_SECONDS`、`SMARTACTION_MAX_IMAGE_PIXELS` 在安全範圍內調整。
- 可用 `SMARTACTION_MAX_QUEUED_JOBS` 調整 1–32 之間的有界佇列容量。
- 檔名會被 UUID 取代，圖片會實際解碼驗證，影片會用 ffprobe 驗證時長。
- 指令未接受任意 shell 參數；只允許列出的媒體副檔名。
- 預設啟動命令只綁定 `127.0.0.1`，不需要 API key。**不要**在沒有 HTTPS、身份驗證、反向代理上傳限制與速率限制時綁定 `0.0.0.0` 或公開到網際網路。
- 只上傳您有權使用的一般性安全媒體；不要上傳未授權、機密、非法或專有內容。模型輸出也需由使用者審核。
