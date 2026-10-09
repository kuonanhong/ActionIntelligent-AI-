import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
} from "../media-core.mjs";

test("canvas size follows aspect ratio with even dimensions", () => {
  assert.deepEqual(canvasSize("16:9", 720), { width: 1280, height: 720 });
  assert.deepEqual(canvasSize("9:16", 720), { width: 720, height: 1280 });
  assert.deepEqual(canvasSize("1:1", 480), { width: 480, height: 480 });
  assert.deepEqual(canvasSize("4:3", 720), { width: 960, height: 720 });
});

test("recording MIME prefers MP4 only for Safari and yields correct extension", () => {
  const supported = (mime) => ["video/mp4", "video/webm;codecs=vp8"].includes(mime);
  assert.equal(selectRecordingMime(supported, "Mozilla/5.0 Safari/605.1.15"), "video/mp4");
  assert.equal(selectRecordingMime(supported, "Mozilla/5.0 Chrome/123 Safari/537.36"), "video/webm;codecs=vp8");
  assert.equal(extensionForMime("video/mp4;codecs=avc1"), "mp4");
  assert.equal(extensionForMime("video/webm;codecs=vp9"), "webm");
});

test("endpoint helpers normalize base URL and encode job id", () => {
  assert.equal(normalizeEndpoint(" http://127.0.0.1:8000/jobs/ "), "http://127.0.0.1:8000");
  assert.equal(jobsUrl("https://video.example/api/"), "https://video.example/api/jobs");
  assert.equal(jobUrl("https://video.example", "a/b"), "https://video.example/jobs/a%2Fb");
  assert.throws(() => normalizeEndpoint("javascript:alert(1)"), /http/);
  assert.throws(() => normalizeEndpoint("https://token:secret@video.example"), /Token/);
});

test("motion, filter, and backend progress stay bounded", () => {
  assert.deepEqual(motionFrame("none", 99, 99), { scale: 1, x: 0, y: 0 });
  assert.match(canvasFilter("grayscale", 1), /grayscale\(100%\)/);
  assert.equal(normalizedProgress(.42), 42);
  assert.equal(normalizedProgress(42), 42);
  assert.equal(normalizedProgress(150), 100);
  assert.equal(normalizedProgress("not-a-number"), null);
});

test("HTML keeps the privacy, localization, engagement, and API contracts", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /data-sa-engage/);
  assert.match(html, /\.\.\/\.\.\/assets\/engage\.js/);
  assert.match(html, /\.\.\/\.\.\/assets\/portal-i18n\.js/);
  assert.match(html, /data-i18n="notGenerative"/);
  assert.match(html, /Wan-AI\/Wan2\.1-I2V-14B-720P-Diffusers/);
  assert.match(html, /THUDM\/CogVideoX-5b/);
  assert.match(html, /POST \/jobs/);
  assert.doesNotMatch(html, /api[_-]?key\s*=/i);
});

test("application explicitly detects mock responses at health, create, and poll stages", async () => {
  const source = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
  const checks = source.match(/data\.runner === "mock" \|\| data\.is_mock === true/g) || [];
  assert.ok(checks.length >= 3, `expected at least three mock checks, found ${checks.length}`);
  assert.match(source, /URL\.revokeObjectURL/);
  assert.match(source, /MediaRecorder/);
  assert.match(source, /canvas\.captureStream/);
  assert.match(source, /form\.append\("file"/);
});
