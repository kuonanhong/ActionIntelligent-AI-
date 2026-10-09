import {
  canvasFilter,
  canvasSize,
  extensionForMime,
  jobUrl,
  jobsUrl,
  motionFrame,
  normalizeEndpoint,
  normalizedProgress,
  selectRecordingMime
} from "./media-core.mjs";

const $ = (id) => document.getElementById(id);
const ui = {
  input: $("mediaInput"),
  drop: $("dropZone"),
  fileMeta: $("fileMeta"),
  aspect: $("aspectSelect"),
  resolution: $("resolutionSelect"),
  duration: $("durationInput"),
  motion: $("motionSelect"),
  filter: $("filterSelect"),
  strength: $("strengthRange"),
  strengthOutput: $("strengthOutput"),
  preview: $("previewBtn"),
  pause: $("pauseBtn"),
  reset: $("resetBtn"),
  create: $("createLocalBtn"),
  cancel: $("cancelLocalBtn"),
  download: $("downloadBtn"),
  localProgress: $("localProgress"),
  localPercent: $("localPercent"),
  localStatus: $("localStatus"),
  canvas: $("previewCanvas"),
  video: $("sourceVideo"),
  formatBadge: $("formatBadge"),
  endpoint: $("endpointInput"),
  saveEndpoint: $("saveEndpointBtn"),
  clearEndpoint: $("clearEndpointBtn"),
  backendState: $("backendState"),
  model: $("modelSelect"),
  task: $("taskSelect"),
  prompt: $("promptInput"),
  submitAi: $("submitAiBtn"),
  cancelAi: $("cancelAiBtn"),
  exportPrompt: $("exportPromptBtn"),
  aiProgress: $("aiProgress"),
  aiPercent: $("aiPercent"),
  aiStatus: $("aiStatus"),
  aiResult: $("aiResultLink")
};

const ctx = ui.canvas.getContext("2d", { alpha: false });
const state = {
  file: null,
  kind: null,
  sourceUrl: null,
  image: null,
  outputUrl: null,
  outputName: "",
  previewRaf: 0,
  previewStart: 0,
  recording: null,
  aiController: null,
  aiTimer: 0,
  backendMode: "unconfigured"
};

const EN_EXACT = new Map([
  ["請先選擇可讀取的圖片或影片。", "Choose a browser-readable image or video first."],
  ["選擇圖片或影片開始", "Choose an image or video to begin"],
  ["正在本機預覽；尚未輸出檔案。", "Previewing locally; no file has been exported."],
  ["檔案不是瀏覽器可辨識的圖片或影片。", "The browser does not recognize this file as an image or video."],
  ["正在讀取本機檔案…", "Reading the local file…"],
  ["尚未選擇檔案", "No file selected"],
  ["已重設；檔案物件網址已釋放。", "Reset complete; temporary object URLs were revoked."],
  ["此瀏覽器不支援錄製", "Recording is not supported in this browser"],
  ["由瀏覽器決定格式", "Format selected by browser"],
  ["已取消本機錄製；未保留部分檔案。", "Local recording cancelled; no partial file was retained."],
  ["瀏覽器沒有產生影片資料，請降低解析度或改用最新版瀏覽器。", "No video data was produced. Lower the resolution or use an up-to-date browser."],
  ["影片已在本機完成，可按「下載影片」。", "The local video is ready. Select Download."],
  ["正在取消錄製…", "Cancelling the recording…"],
  ["請先選擇圖片或影片。", "Choose an image or video first."],
  ["此瀏覽器缺少 MediaRecorder 或 Canvas captureStream，無法匯出影片。", "This browser lacks MediaRecorder or Canvas captureStream and cannot export video."],
  ["正在即時錄製 Canvas；請保持此分頁開啟。背景分頁可能被瀏覽器降速。", "Recording the Canvas in real time. Keep this tab open; browsers may throttle background tabs."],
  ["預覽已暫停。", "Preview paused."],
  ["正在檢查後端", "Checking backend"],
  ["查詢 /health；不會上傳素材。", "Checking /health; no media is uploaded."],
  ["預覽／模擬後端", "Preview / mock backend"],
  ["此服務沒有模型權重，不可當作 AI 生成；已停用送出按鈕。", "This service has no model weights and is not AI generation; submission is disabled."],
  ["偵測到 mock runner；請啟用真正模型後端。", "Mock runner detected. Enable a real model backend."],
  ["後端模型尚未就緒", "Backend model is not ready"],
  ["請先在後端載入模型。", "Load the model on the backend first."],
  ["後端回報 runner_ready=false。", "The backend reported runner_ready=false."],
  ["送出時才會上傳目前素材。", "The current media is uploaded only when you submit."],
  ["後端健康檢查成功；尚未送出任何素材。", "Backend health check passed; no media has been submitted."],
  ["後端已設定、未驗證", "Backend configured, not verified"],
  ["此服務沒有可用的 /health；仍可依公開 API 合約嘗試送出。", "No usable /health endpoint was found; you may still try the documented API contract."],
  ["後端尚未設定", "Backend not configured"],
  ["請輸入有效的 http 或 https 網址。", "Enter a valid http or https URL."],
  ["填入您信任的服務基底網址後才會啟用送出。", "Enter a trusted service base URL to enable submission."],
  ["已清除後端網址；沒有清除或刪除任何遠端工作。暫時只有本機工具可用。", "Backend URL cleared. No remote job was deleted; only local tools are available."],
  ["已停止等候後端工作。", "Stopped waiting for the backend job."],
  ["已停止這個分頁的輪詢；後端工作可能仍在執行。", "Polling stopped in this tab; the backend job may still be running."],
  ["後端回傳 mock 標記；這不是 AI 生成結果，已停止輪詢。", "The backend returned a mock marker. This is not AI generation; polling stopped."],
  ["後端正在使用一秒鐘合約預覽（mock），沒有模型推論；不會把輸出標示為 AI 生成。", "The backend is using a one-second contract preview (mock), with no model inference. It will not be labelled AI-generated."],
  ["後端回報工作完成；請開啟結果連結確認內容。", "The backend reports completion. Open the result link to verify it."],
  ["後端回報完成，但未提供有效的 http(s) 結果網址。", "The backend reports completion but did not provide a valid http(s) result URL."],
  ["請先在上方選擇圖片或影片。", "Choose an image or video above first."],
  ["此網址是 mock 預覽後端，沒有模型權重；不會將它呈現為 AI 生成。", "This URL is a mock preview backend with no model weights; it will not be presented as AI generation."],
  ["後端模型尚未就緒，請先完成後端設定。", "The backend model is not ready. Complete backend setup first."],
  ["image-to-video 工作需要圖片檔。", "The image-to-video task requires an image file."],
  ["video-to-video 工作需要影片檔。", "The video-to-video task requires a video file."],
  ["尚未設定後端網址；本站不含預設付費 API。", "No backend URL is configured; this site includes no paid API by default."],
  ["正在把素材送到您設定的後端…", "Uploading media to the backend you configured…"],
  ["工作建立回應含 mock 標記；這不是 AI 生成，結果不會顯示。", "The job response contains a mock marker. This is not AI generation and no result will be shown."],
  ["後端只執行 ffmpeg 合約預覽，沒有模型推論；請切換真正模型 runner。", "The backend only ran an ffmpeg contract preview with no model inference. Switch to a real model runner."],
  ["後端網址格式不正確。", "The backend URL is invalid."],
  ["後端網址只能使用 http 或 https。", "The backend URL must use http or https."],
  ["後端網址不可包含帳號、密碼或 Token。", "The backend URL must not contain a username, password, or token."],
  ["尚未設定後端網址。", "No backend URL is configured."],
  ["後端未回傳工作 ID。", "The backend did not return a job ID."],
  ["後端未回傳 id 或 job_id。", "The backend did not return id or job_id."],
  ["請輸入後端網址。", "Enter a backend URL."]
]);

function foreignLocale() {
  return !String(document.documentElement.lang || "zh-TW").toLowerCase().startsWith("zh");
}

function localized(message) {
  const text = String(message ?? "");
  if (!foreignLocale()) return text;
  if (EN_EXACT.has(text)) return EN_EXACT.get(text);
  const patterns = [
    [/^影片無法播放：(.*)$/, "Video playback failed: $1"],
    [/^影片無法開始播放：(.*)$/, "The video could not start: $1"],
    [/^瀏覽器無法解碼此圖片。$/, "The browser could not decode this image."],
    [/^瀏覽器無法解碼此影片。$/, "The browser could not decode this video."],
    [/^錄製失敗：(.*)$/, "Recording failed: $1"],
    [/^(圖片|影片)已載入，尚未上傳。$/, "Media loaded; nothing has been uploaded."],
    [/^預計輸出 (.*)$/, "Expected output: $1"],
    [/^完成・(.*)$/, "Ready · $1"],
    [/^後端可連線(.*)$/, "Backend reachable$1"],
    [/^健康檢查未完成：(.*)。未上傳素材。$/, "Health check incomplete: $1. No media was uploaded."],
    [/^工作 (.*)：(.*)$/, "Job $1: $2"],
    [/^後端工作未完成：(.*)$/, "Backend job did not complete: $1"],
    [/^查詢失敗（HTTP (.*)）$/, "Status request failed (HTTP $1)"],
    [/^建立工作失敗（HTTP (.*)）$/, "Job creation failed (HTTP $1)"],
    [/^(.*)。請檢查後端、CORS 與工作 ID。$/, "$1. Check the backend, CORS, and job ID."],
    [/^工作 (.*) 已建立；正在讀取後端真實狀態。$/, "Job $1 created; reading its real backend status."],
    [/^(.*)。請檢查 CORS 與 API 合約。$/, "$1. Check CORS and the API contract."]
  ];
  for (const [pattern, replacement] of patterns) {
    if (pattern.test(text)) return text.replace(pattern, replacement);
  }
  return text;
}

function status(element, message, kind = "") {
  element.dataset.dynamicMessage = String(message ?? "");
  element.textContent = localized(message);
  element.classList.toggle("is-error", kind === "error");
  element.classList.toggle("is-success", kind === "success");
}

function bytes(value) {
  if (!Number.isFinite(value)) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

function inferredKind(file) {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (/\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(file.name)) return "image";
  if (/\.(mp4|m4v|mov|webm|ogv|ogg)$/i.test(file.name)) return "video";
  return null;
}

function mediaDimensions() {
  if (state.kind === "image" && state.image) {
    return { width: state.image.naturalWidth, height: state.image.naturalHeight };
  }
  if (state.kind === "video" && ui.video.videoWidth) {
    return { width: ui.video.videoWidth, height: ui.video.videoHeight };
  }
  return { width: 0, height: 0 };
}

function configureCanvas() {
  const size = canvasSize(ui.aspect.value, Number(ui.resolution.value));
  if (ui.canvas.width !== size.width || ui.canvas.height !== size.height) {
    ui.canvas.width = size.width;
    ui.canvas.height = size.height;
  }
  return size;
}

function drawPlaceholder() {
  configureCanvas();
  const { width, height } = ui.canvas;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#0b2c35");
  gradient.addColorStop(1, "#165463");
  ctx.filter = "none";
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255,255,255,.10)";
  ctx.beginPath();
  ctx.arc(width * .82, height * .18, Math.min(width, height) * .23, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d5e8e4";
  ctx.textAlign = "center";
  ctx.font = `700 ${Math.max(18, Math.round(height / 26))}px system-ui`;
  ctx.fillText(localized("選擇圖片或影片開始"), width / 2, height / 2);
  ctx.font = `400 ${Math.max(13, Math.round(height / 42))}px system-ui`;
  ctx.fillStyle = "#9bbdb8";
  ctx.fillText("Local canvas preview", width / 2, height / 2 + height / 16);
}

function drawFrame(progress = 0) {
  configureCanvas();
  const source = state.kind === "image" ? state.image : ui.video;
  const { width: sw, height: sh } = mediaDimensions();
  const cw = ui.canvas.width;
  const ch = ui.canvas.height;
  if (!source || !sw || !sh) {
    drawPlaceholder();
    return;
  }

  const effect = motionFrame(ui.motion.value, progress, Number(ui.strength.value) / 100);
  const cover = Math.max(cw / sw, ch / sh);
  const dw = sw * cover * effect.scale;
  const dh = sh * cover * effect.scale;
  const dx = (cw - dw) / 2 + effect.x * cw;
  const dy = (ch - dh) / 2 + effect.y * ch;

  ctx.save();
  ctx.fillStyle = "#071e25";
  ctx.fillRect(0, 0, cw, ch);
  ctx.filter = canvasFilter(ui.filter.value, Number(ui.strength.value) / 100);
  try { ctx.drawImage(source, dx, dy, dw, dh); }
  catch { /* A video may be between decoded frames; retain the previous canvas frame. */ }
  ctx.restore();
}

function pausePreview() {
  if (state.previewRaf) cancelAnimationFrame(state.previewRaf);
  state.previewRaf = 0;
  state.previewStart = 0;
  ui.video.pause();
  ui.preview.disabled = !state.file || Boolean(state.recording);
  ui.pause.disabled = true;
}

async function startPreview() {
  if (!state.file || state.recording) {
    status(ui.localStatus, "請先選擇可讀取的圖片或影片。", "error");
    return;
  }
  pausePreview();
  state.previewStart = performance.now();
  if (state.kind === "video") {
    ui.video.loop = true;
    ui.video.muted = true;
    try { await ui.video.play(); }
    catch (error) {
      status(ui.localStatus, `影片無法播放：${error.message}`, "error");
      return;
    }
  }
  ui.preview.disabled = true;
  ui.pause.disabled = false;
  status(ui.localStatus, "正在本機預覽；尚未輸出檔案。");
  const durationMs = Math.max(2, Number(ui.duration.value) || 6) * 1000;
  const tick = (now) => {
    if (!state.previewStart || state.recording) return;
    const progress = ((now - state.previewStart) % durationMs) / durationMs;
    drawFrame(progress);
    state.previewRaf = requestAnimationFrame(tick);
  };
  state.previewRaf = requestAnimationFrame(tick);
}

function revokeSource() {
  pausePreview();
  if (state.sourceUrl) URL.revokeObjectURL(state.sourceUrl);
  state.sourceUrl = null;
  state.image = null;
  ui.video.removeAttribute("src");
  ui.video.load();
}

function revokeOutput() {
  if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);
  state.outputUrl = null;
  state.outputName = "";
  ui.download.disabled = true;
}

async function loadImage(url) {
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("瀏覽器無法解碼此圖片。"));
  });
  return image;
}

async function loadVideo(url) {
  ui.video.src = url;
  ui.video.preload = "metadata";
  await new Promise((resolve, reject) => {
    const done = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error("瀏覽器無法解碼此影片。")); };
    const cleanup = () => {
      ui.video.removeEventListener("loadedmetadata", done);
      ui.video.removeEventListener("error", fail);
    };
    ui.video.addEventListener("loadedmetadata", done);
    ui.video.addEventListener("error", fail);
    ui.video.load();
  });
}

async function useFile(file) {
  const kind = inferredKind(file);
  if (!kind) {
    status(ui.localStatus, "檔案不是瀏覽器可辨識的圖片或影片。", "error");
    return;
  }
  if (state.recording) cancelRecording();
  revokeSource();
  revokeOutput();
  state.file = file;
  state.kind = kind;
  state.sourceUrl = URL.createObjectURL(file);
  status(ui.localStatus, "正在讀取本機檔案…");
  try {
    if (kind === "image") {
      state.image = await loadImage(state.sourceUrl);
      ui.task.value = "image-to-video";
      ui.model.value = "Wan-AI/Wan2.1-I2V-14B-720P-Diffusers";
    } else {
      await loadVideo(state.sourceUrl);
      ui.task.value = "video-to-video";
      ui.model.value = "THUDM/CogVideoX-5b";
    }
    const dimensions = mediaDimensions();
    const extra = kind === "video" && Number.isFinite(ui.video.duration)
      ? `・${ui.video.duration.toFixed(1)} 秒`
      : "";
    const localLabel = foreignLocale() ? "local only" : "只在本機";
    ui.fileMeta.textContent = `${file.name}・${bytes(file.size)}・${dimensions.width}×${dimensions.height}${extra}・${localLabel}`;
    ui.preview.disabled = false;
    ui.create.disabled = false;
    drawFrame(0);
    status(ui.localStatus, `${kind === "image" ? "圖片" : "影片"}已載入，尚未上傳。`, "success");
  } catch (error) {
    state.file = null;
    state.kind = null;
    revokeSource();
    ui.fileMeta.textContent = localized("尚未選擇檔案");
    status(ui.localStatus, error.message, "error");
    drawPlaceholder();
  }
}

function resetAll() {
  if (state.recording) cancelRecording();
  stopAiPolling("已停止等候後端工作。");
  revokeSource();
  revokeOutput();
  state.file = null;
  state.kind = null;
  ui.input.value = "";
  ui.fileMeta.textContent = localized("尚未選擇檔案");
  ui.localProgress.value = 0;
  ui.localPercent.textContent = "0%";
  ui.preview.disabled = true;
  ui.create.disabled = true;
  status(ui.localStatus, "已重設；檔案物件網址已釋放。");
  drawPlaceholder();
}

function detectedMime() {
  if (!("MediaRecorder" in window)) return "";
  return selectRecordingMime(MediaRecorder.isTypeSupported.bind(MediaRecorder), navigator.userAgent);
}

function updateFormatBadge() {
  const mime = detectedMime();
  if (!("MediaRecorder" in window) || typeof ui.canvas.captureStream !== "function") {
    ui.formatBadge.textContent = localized("此瀏覽器不支援錄製");
    return;
  }
  ui.formatBadge.textContent = localized(mime ? `預計輸出 ${extensionForMime(mime).toUpperCase()}` : "由瀏覽器決定格式");
}

function finishRecording(run) {
  if (state.recording !== run) return;
  if (run.raf) cancelAnimationFrame(run.raf);
  run.stream.getTracks().forEach((track) => track.stop());
  ui.video.pause();
  state.recording = null;
  ui.cancel.disabled = true;
  ui.create.disabled = false;
  ui.preview.disabled = !state.file;

  if (run.cancelled) {
    status(ui.localStatus, "已取消本機錄製；未保留部分檔案。");
    return;
  }
  const type = run.recorder.mimeType || run.chunks.find((chunk) => chunk.type)?.type || run.mime || "video/webm";
  const blob = new Blob(run.chunks, { type });
  if (!blob.size) {
    status(ui.localStatus, "瀏覽器沒有產生影片資料，請降低解析度或改用最新版瀏覽器。", "error");
    return;
  }
  revokeOutput();
  state.outputUrl = URL.createObjectURL(blob);
  const extension = extensionForMime(blob.type || type);
  const stem = (state.file?.name || "smartaction").replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}_-]+/gu, "-");
  state.outputName = `${stem || "smartaction"}-local.${extension}`;
  ui.download.disabled = false;
  ui.localProgress.value = 100;
  ui.localPercent.textContent = "100%";
  ui.formatBadge.textContent = localized(`完成・${extension.toUpperCase()}・${bytes(blob.size)}`);
  status(ui.localStatus, "影片已在本機完成，可按「下載影片」。", "success");
}

function cancelRecording() {
  const run = state.recording;
  if (!run) return;
  run.cancelled = true;
  if (run.raf) cancelAnimationFrame(run.raf);
  ui.video.pause();
  status(ui.localStatus, "正在取消錄製…");
  if (run.recorder.state !== "inactive") run.recorder.stop();
  else finishRecording(run);
}

async function createLocalVideo() {
  if (!state.file) {
    status(ui.localStatus, "請先選擇圖片或影片。", "error");
    return;
  }
  if (!("MediaRecorder" in window) || typeof ui.canvas.captureStream !== "function") {
    status(ui.localStatus, "此瀏覽器缺少 MediaRecorder 或 Canvas captureStream，無法匯出影片。", "error");
    return;
  }
  pausePreview();
  revokeOutput();
  configureCanvas();
  const duration = Math.min(30, Math.max(2, Number(ui.duration.value) || 6));
  ui.duration.value = String(duration);
  const mime = detectedMime();
  const stream = ui.canvas.captureStream(30);
  let recorder;
  try {
    recorder = mime ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 }) : new MediaRecorder(stream);
  } catch (firstError) {
    try { recorder = new MediaRecorder(stream); }
    catch (secondError) {
      stream.getTracks().forEach((track) => track.stop());
      status(ui.localStatus, `錄製失敗：${secondError.message || firstError.message}`, "error");
      return;
    }
  }
  const run = { recorder, stream, mime, chunks: [], raf: 0, cancelled: false, stopping: false };
  state.recording = run;
  recorder.addEventListener("dataavailable", (event) => { if (event.data?.size) run.chunks.push(event.data); });
  recorder.addEventListener("stop", () => finishRecording(run), { once: true });
  recorder.addEventListener("error", (event) => {
    run.cancelled = true;
    status(ui.localStatus, `錄製失敗：${event.error?.message || "瀏覽器錄製器錯誤"}`, "error");
    if (state.recording === run) {
      try {
        if (recorder.state !== "inactive") recorder.stop();
        else finishRecording(run);
      } catch { finishRecording(run); }
    }
  });

  ui.create.disabled = true;
  ui.preview.disabled = true;
  ui.pause.disabled = true;
  ui.cancel.disabled = false;
  ui.download.disabled = true;
  ui.localProgress.value = 0;
  ui.localPercent.textContent = "0%";
  status(ui.localStatus, "正在即時錄製 Canvas；請保持此分頁開啟。背景分頁可能被瀏覽器降速。");

  if (state.kind === "video") {
    ui.video.currentTime = 0;
    ui.video.loop = true;
    ui.video.muted = true;
    try { await ui.video.play(); }
    catch (error) {
      run.cancelled = true;
      stream.getTracks().forEach((track) => track.stop());
      state.recording = null;
      ui.cancel.disabled = true;
      ui.create.disabled = false;
      status(ui.localStatus, `影片無法開始播放：${error.message}`, "error");
      return;
    }
  }

  drawFrame(0);
  try { recorder.start(250); }
  catch (error) {
    run.cancelled = true;
    ui.video.pause();
    stream.getTracks().forEach((track) => track.stop());
    state.recording = null;
    ui.cancel.disabled = true;
    ui.create.disabled = false;
    ui.preview.disabled = false;
    status(ui.localStatus, `錄製失敗：${error.message}`, "error");
    return;
  }
  const began = performance.now();
  const frame = (now) => {
    if (run.cancelled || state.recording !== run) return;
    const progress = Math.min(1, (now - began) / (duration * 1000));
    drawFrame(progress);
    const percent = Math.round(progress * 100);
    ui.localProgress.value = percent;
    ui.localPercent.textContent = `${percent}%`;
    if (progress < 1) {
      run.raf = requestAnimationFrame(frame);
    } else if (!run.stopping) {
      run.stopping = true;
      ui.video.pause();
      recorder.stop();
    }
  };
  run.raf = requestAnimationFrame(frame);
}

function downloadOutput() {
  if (!state.outputUrl) return;
  const anchor = document.createElement("a");
  anchor.href = state.outputUrl;
  anchor.download = state.outputName;
  anchor.click();
}

function setBackendDisplay(mode, title, detail) {
  state.backendMode = mode;
  ui.backendState.dataset.titleMessage = title;
  ui.backendState.dataset.detailMessage = detail;
  ui.backendState.classList.toggle("is-ready", mode === "ready");
  ui.backendState.classList.toggle("is-mock", mode === "mock");
  const strong = ui.backendState.querySelector("strong");
  const span = ui.backendState.querySelector("span:last-child");
  strong.textContent = localized(title);
  span.textContent = localized(detail);
  if (!state.aiController) ui.submitAi.disabled = ["unconfigured", "mock", "not-ready", "checking"].includes(mode);
}

async function inspectBackend(endpoint) {
  setBackendDisplay("checking", "正在檢查後端", "查詢 /health；不會上傳素材。");
  try {
    const response = await fetch(`${endpoint}/health`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.runner === "mock" || data.is_mock === true) {
      setBackendDisplay("mock", "預覽／模擬後端", "此服務沒有模型權重，不可當作 AI 生成；已停用送出按鈕。");
      status(ui.aiStatus, data.detail || "偵測到 mock runner；請啟用真正模型後端。", "error");
      return;
    }
    if (data.runner_ready === false) {
      setBackendDisplay("not-ready", "後端模型尚未就緒", data.detail || "請先在後端載入模型。");
      status(ui.aiStatus, "後端回報 runner_ready=false。", "error");
      return;
    }
    const runner = data.runner ? `（${data.runner}）` : "";
    setBackendDisplay("ready", `後端可連線${runner}`, data.detail || "送出時才會上傳目前素材。");
    status(ui.aiStatus, "後端健康檢查成功；尚未送出任何素材。", "success");
  } catch (error) {
    setBackendDisplay("unverified", "後端已設定、未驗證", "此服務沒有可用的 /health；仍可依公開 API 合約嘗試送出。");
    status(ui.aiStatus, `健康檢查未完成：${error.message}。未上傳素材。`);
  }
}

async function saveEndpoint() {
  try {
    const endpoint = normalizeEndpoint(ui.endpoint.value);
    if (!endpoint) throw new Error("請輸入後端網址。");
    ui.endpoint.value = endpoint;
    localStorage.setItem("smartaction-video-backend", endpoint);
    await inspectBackend(endpoint);
  } catch (error) {
    setBackendDisplay("unconfigured", "後端尚未設定", "請輸入有效的 http 或 https 網址。");
    status(ui.aiStatus, error.message, "error");
  }
}

function clearEndpoint() {
  stopAiPolling();
  try { localStorage.removeItem("smartaction-video-backend"); } catch { /* Private mode may deny storage. */ }
  ui.endpoint.value = "";
  setBackendDisplay("unconfigured", "後端尚未設定", "填入您信任的服務基底網址後才會啟用送出。");
  status(ui.aiStatus, "已清除後端網址；沒有清除或刪除任何遠端工作。暫時只有本機工具可用。");
}

function stopAiPolling(message = "") {
  if (state.aiTimer) clearTimeout(state.aiTimer);
  state.aiTimer = 0;
  if (state.aiController) state.aiController.abort();
  state.aiController = null;
  ui.cancelAi.disabled = true;
  ui.submitAi.disabled = ["unconfigured", "mock", "not-ready", "checking"].includes(state.backendMode);
  if (message) status(ui.aiStatus, message);
}

function safeResultUrl(value) {
  try {
    const parsed = new URL(value, normalizeEndpoint(ui.endpoint.value));
    return /^https?:$/.test(parsed.protocol) ? parsed.href : "";
  } catch { return ""; }
}

async function pollJob(endpoint, id, controller) {
  if (controller.signal.aborted) return;
  try {
    const response = await fetch(jobUrl(endpoint, id), { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`查詢失敗（HTTP ${response.status}）`);
    const data = await response.json();
    if (data.runner === "mock" || data.is_mock === true) {
      stopAiPolling();
      setBackendDisplay("mock", "預覽／模擬後端", "後端回傳 mock 標記；這不是 AI 生成結果，已停止輪詢。");
      ui.aiProgress.value = 0;
      ui.aiPercent.textContent = "—";
      ui.aiResult.hidden = true;
      status(ui.aiStatus, "後端正在使用一秒鐘合約預覽（mock），沒有模型推論；不會把輸出標示為 AI 生成。", "error");
      return;
    }
    const phase = String(data.status || "unknown").toLowerCase();
    const progress = normalizedProgress(data.progress);
    if (progress === null) {
      ui.aiProgress.removeAttribute("value");
      ui.aiPercent.textContent = "—";
    } else {
      ui.aiProgress.value = progress;
      ui.aiPercent.textContent = `${Math.round(progress)}%`;
    }
    status(ui.aiStatus, `工作 ${id}：${phase}${data.detail ? `・${data.detail}` : ""}`);
    if (["succeeded", "completed", "done"].includes(phase)) {
      const result = safeResultUrl(data.result_url || data.output_url || "");
      stopAiPolling();
      ui.aiProgress.value = 100;
      ui.aiPercent.textContent = "100%";
      if (result) {
        ui.aiResult.href = result;
        ui.aiResult.hidden = false;
        status(ui.aiStatus, "後端回報工作完成；請開啟結果連結確認內容。", "success");
      } else {
        status(ui.aiStatus, "後端回報完成，但未提供有效的 http(s) 結果網址。", "error");
      }
      return;
    }
    if (["failed", "error", "cancelled", "canceled"].includes(phase)) {
      stopAiPolling();
      status(ui.aiStatus, `後端工作未完成：${data.error || data.detail || phase}`, "error");
      return;
    }
    state.aiTimer = setTimeout(() => pollJob(endpoint, id, controller), 2000);
  } catch (error) {
    if (error.name === "AbortError") return;
    stopAiPolling();
    status(ui.aiStatus, `${error.message}。請檢查後端、CORS 與工作 ID。`, "error");
  }
}

async function submitAiJob() {
  if (!state.file) {
    status(ui.aiStatus, "請先在上方選擇圖片或影片。", "error");
    return;
  }
  if (state.backendMode === "mock") {
    status(ui.aiStatus, "此網址是 mock 預覽後端，沒有模型權重；不會將它呈現為 AI 生成。", "error");
    return;
  }
  if (state.backendMode === "not-ready") {
    status(ui.aiStatus, "後端模型尚未就緒，請先完成後端設定。", "error");
    return;
  }
  if (ui.task.value === "image-to-video" && state.kind !== "image") {
    status(ui.aiStatus, "image-to-video 工作需要圖片檔。", "error");
    return;
  }
  if (ui.task.value === "video-to-video" && state.kind !== "video") {
    status(ui.aiStatus, "video-to-video 工作需要影片檔。", "error");
    return;
  }

  let endpoint;
  try { endpoint = normalizeEndpoint(ui.endpoint.value); }
  catch (error) { status(ui.aiStatus, error.message, "error"); return; }
  if (!endpoint) {
    status(ui.aiStatus, "尚未設定後端網址；本站不含預設付費 API。", "error");
    return;
  }

  stopAiPolling();
  const controller = new AbortController();
  state.aiController = controller;
  ui.submitAi.disabled = true;
  ui.cancelAi.disabled = false;
  ui.aiResult.hidden = true;
  ui.aiProgress.removeAttribute("value");
  ui.aiPercent.textContent = "—";
  status(ui.aiStatus, "正在把素材送到您設定的後端…");

  const form = new FormData();
  form.append("file", state.file, state.file.name);
  form.append("prompt", ui.prompt.value.trim());
  form.append("model", ui.model.value);
  form.append("task", ui.task.value);

  try {
    const response = await fetch(jobsUrl(endpoint), { method: "POST", body: form, signal: controller.signal });
    if (!response.ok) throw new Error(`建立工作失敗（HTTP ${response.status}）`);
    const data = await response.json();
    if (data.runner === "mock" || data.is_mock === true) {
      stopAiPolling();
      setBackendDisplay("mock", "預覽／模擬後端", "工作建立回應含 mock 標記；這不是 AI 生成，結果不會顯示。");
      status(ui.aiStatus, "後端只執行 ffmpeg 合約預覽，沒有模型推論；請切換真正模型 runner。", "error");
      return;
    }
    const id = data.id || data.job_id;
    if (!id) throw new Error("後端未回傳 id 或 job_id。");
    status(ui.aiStatus, `工作 ${id} 已建立；正在讀取後端真實狀態。`);
    await pollJob(endpoint, id, controller);
  } catch (error) {
    if (error.name === "AbortError") return;
    stopAiPolling();
    status(ui.aiStatus, `${error.message}。請檢查 CORS 與 API 合約。`, "error");
  }
}

function exportPrompt() {
  const text = [
    "SmartAction video job prompt",
    `model: ${ui.model.value}`,
    `task: ${ui.task.value}`,
    `source: ${state.file?.name || "(not selected)"}`,
    `aspect_ratio: ${ui.aspect.value}`,
    `duration_seconds: ${ui.duration.value}`,
    "",
    ui.prompt.value.trim() || "(empty prompt)"
  ].join("\n");
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "smartaction-video-prompt.txt";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

ui.input.addEventListener("change", () => { if (ui.input.files?.[0]) useFile(ui.input.files[0]); });
for (const eventName of ["dragenter", "dragover"]) {
  ui.drop.addEventListener(eventName, (event) => { event.preventDefault(); ui.drop.classList.add("is-dragging"); });
}
for (const eventName of ["dragleave", "drop"]) {
  ui.drop.addEventListener(eventName, (event) => { event.preventDefault(); ui.drop.classList.remove("is-dragging"); });
}
ui.drop.addEventListener("drop", (event) => { if (event.dataTransfer?.files?.[0]) useFile(event.dataTransfer.files[0]); });
ui.strength.addEventListener("input", () => { ui.strengthOutput.textContent = `${ui.strength.value}%`; if (!state.previewRaf) drawFrame(0); });
for (const element of [ui.aspect, ui.resolution, ui.motion, ui.filter]) {
  element.addEventListener("change", () => { if (!state.previewRaf && !state.recording) drawFrame(0); });
}
ui.preview.addEventListener("click", startPreview);
ui.pause.addEventListener("click", () => { pausePreview(); status(ui.localStatus, "預覽已暫停。"); });
ui.reset.addEventListener("click", resetAll);
ui.create.addEventListener("click", createLocalVideo);
ui.cancel.addEventListener("click", cancelRecording);
ui.download.addEventListener("click", downloadOutput);
ui.saveEndpoint.addEventListener("click", saveEndpoint);
ui.clearEndpoint.addEventListener("click", clearEndpoint);
ui.submitAi.addEventListener("click", submitAiJob);
ui.cancelAi.addEventListener("click", () => stopAiPolling("已停止這個分頁的輪詢；後端工作可能仍在執行。"));
ui.exportPrompt.addEventListener("click", exportPrompt);
ui.model.addEventListener("change", () => {
  ui.task.value = ui.model.value.startsWith("Wan-AI/") ? "image-to-video" : "video-to-video";
});
ui.task.addEventListener("change", () => {
  ui.model.value = ui.task.value === "image-to-video"
    ? "Wan-AI/Wan2.1-I2V-14B-720P-Diffusers"
    : "THUDM/CogVideoX-5b";
});

window.addEventListener("beforeunload", () => {
  if (state.recording) cancelRecording();
  stopAiPolling();
  revokeSource();
  revokeOutput();
});

document.addEventListener("sa:language", () => {
  for (const element of [ui.localStatus, ui.aiStatus]) {
    if (element.dataset.dynamicMessage) element.textContent = localized(element.dataset.dynamicMessage);
  }
  if (ui.backendState.dataset.titleMessage) {
    const strong = ui.backendState.querySelector("strong");
    const span = ui.backendState.querySelector("span:last-child");
    strong.textContent = localized(ui.backendState.dataset.titleMessage);
    span.textContent = localized(ui.backendState.dataset.detailMessage || "");
  }
  if (!state.file) ui.fileMeta.textContent = localized("尚未選擇檔案");
  updateFormatBadge();
  if (!state.file) drawPlaceholder();
});

try {
  const savedEndpoint = normalizeEndpoint(localStorage.getItem("smartaction-video-backend") || "");
  if (savedEndpoint) {
    ui.endpoint.value = savedEndpoint;
    inspectBackend(savedEndpoint);
  }
} catch { localStorage.removeItem("smartaction-video-backend"); }

updateFormatBadge();
drawPlaceholder();
