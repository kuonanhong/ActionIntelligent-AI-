const RATIOS = Object.freeze({
  "16:9": [16, 9],
  "9:16": [9, 16],
  "1:1": [1, 1],
  "4:3": [4, 3]
});

export function clamp(value, min = 0, max = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function even(value) {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

export function canvasSize(aspect = "16:9", shortEdge = 720) {
  const [x, y] = RATIOS[aspect] || RATIOS["16:9"];
  const edge = clamp(shortEdge, 240, 2160);
  if (x >= y) return { width: even(edge * x / y), height: even(edge) };
  return { width: even(edge), height: even(edge * y / x) };
}

export function motionFrame(kind, progress, strength = 0.7) {
  const p = clamp(progress);
  const s = clamp(strength);
  const eased = 0.5 - 0.5 * Math.cos(Math.PI * p);
  const zoom = 0.18 * s;
  const pan = 0.075 * s;

  switch (kind) {
    case "zoom-out":
      return { scale: 1 + zoom * (1 - eased), x: 0, y: 0 };
    case "pan-left":
      return { scale: 1 + zoom * 0.72, x: pan * (1 - 2 * eased), y: 0 };
    case "pan-up":
      return { scale: 1 + zoom * 0.72, x: 0, y: pan * (1 - 2 * eased) };
    case "breathe":
      return {
        scale: 1 + zoom * 0.36 * (0.5 - 0.5 * Math.cos(Math.PI * 2 * p)),
        x: Math.sin(Math.PI * 2 * p) * pan * 0.18,
        y: Math.cos(Math.PI * 2 * p) * pan * 0.12
      };
    case "none":
      return { scale: 1, x: 0, y: 0 };
    case "zoom-in":
    default:
      return { scale: 1 + zoom * eased, x: 0, y: 0 };
  }
}

export function canvasFilter(style = "none", strength = 0.7) {
  const s = clamp(strength);
  const pct = (base, delta) => `${Math.round(base + delta * s)}%`;
  switch (style) {
    case "cinematic":
      return `contrast(${pct(100, 28)}) saturate(${pct(100, -18)}) sepia(${Math.round(12 * s)}%) brightness(${pct(100, -5)})`;
    case "warm":
      return `sepia(${Math.round(34 * s)}%) saturate(${pct(100, 28)}) brightness(${pct(100, 4)})`;
    case "cool":
      return `hue-rotate(${Math.round(18 * s)}deg) saturate(${pct(100, 10)}) contrast(${pct(100, 9)})`;
    case "vivid":
      return `saturate(${pct(100, 85)}) contrast(${pct(100, 14)})`;
    case "grayscale":
      return `grayscale(${Math.round(100 * s)}%) contrast(${pct(100, 10)})`;
    case "soft":
      return `contrast(${pct(100, -13)}) saturate(${pct(100, -12)}) brightness(${pct(100, 8)})`;
    case "none":
    default:
      return "none";
  }
}

export function selectRecordingMime(isTypeSupported, userAgent = "") {
  const safari = /Safari/i.test(userAgent) && !/(Chrome|Chromium|CriOS|Android|Edg)/i.test(userAgent);
  const mp4 = ["video/mp4;codecs=h264", "video/mp4"];
  const webm = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  const candidates = safari ? [...mp4, ...webm] : [...webm, ...mp4];
  if (typeof isTypeSupported !== "function") return "";
  return candidates.find((mime) => {
    try { return Boolean(isTypeSupported(mime)); }
    catch { return false; }
  }) || "";
}

export function extensionForMime(mime = "") {
  const normalized = String(mime).toLowerCase();
  if (normalized.includes("mp4") || normalized.includes("h264") || normalized.includes("avc")) return "mp4";
  if (normalized.includes("webm") || normalized.includes("vp8") || normalized.includes("vp9")) return "webm";
  if (normalized.includes("ogg")) return "ogv";
  return "webm";
}

export function normalizeEndpoint(value = "") {
  const raw = String(value).trim();
  if (!raw) return "";
  let parsed;
  try { parsed = new URL(raw); }
  catch { throw new Error("後端網址格式不正確。"); }
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("後端網址只能使用 http 或 https。");
  if (parsed.username || parsed.password) throw new Error("後端網址不可包含帳號、密碼或 Token。");
  parsed.hash = "";
  parsed.search = "";
  let pathname = parsed.pathname.replace(/\/+$/, "");
  if (pathname.endsWith("/jobs")) pathname = pathname.slice(0, -5);
  parsed.pathname = pathname || "/";
  return parsed.toString().replace(/\/$/, "");
}

export function jobsUrl(endpoint) {
  const base = normalizeEndpoint(endpoint);
  if (!base) throw new Error("尚未設定後端網址。");
  return `${base}/jobs`;
}

export function jobUrl(endpoint, id) {
  const safeId = encodeURIComponent(String(id || "").trim());
  if (!safeId) throw new Error("後端未回傳工作 ID。");
  return `${jobsUrl(endpoint)}/${safeId}`;
}

export function normalizedProgress(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return clamp(number <= 1 ? number * 100 : number, 0, 100);
}
