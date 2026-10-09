import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const source = await readFile(resolve(here, "..", "simulator.js"), "utf8");
const listeners = new Map();
const rafQueue = [];
let now = 1000;

class ClassList {
  values = new Set();
  add(...items) { items.forEach((item) => this.values.add(item)); }
  remove(...items) { items.forEach((item) => this.values.delete(item)); }
  contains(item) { return this.values.has(item); }
}

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.value = id === "mode-select" ? "beginner" : "";
    this.hidden = false;
    this.textContent = "";
    this.dataset = {};
    this.style = {};
    this.classList = new ClassList();
    this.attributes = new Map();
    this.handlers = new Map();
    this.firstSpan = new FakeLeaf();
    this.lastSpan = new FakeLeaf();
    this.knob = new FakeLeaf();
  }
  addEventListener(type, callback) { this.handlers.set(type, callback); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  querySelector(selector) {
    if (selector === "span:first-child") return this.firstSpan;
    if (selector === "span:last-child") return this.lastSpan;
    if (selector === ".stick-knob") return this.knob;
    return null;
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 540 }; }
  focus() {}
  closest() { return null; }
  setPointerCapture() {}
}

class FakeLeaf {
  constructor() {
    this.textContent = "";
    this.dataset = {};
    this.style = {};
  }
}

const drawingContext = new Proxy({
  createLinearGradient() { return { addColorStop() {} }; },
  setTransform() {}, clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
  closePath() {}, fill() {}, stroke() {}, arc() {}, ellipse() {}, save() {}, restore() {},
  translate() {}, rotate() {}, fillText() {}, setLineDash() {}
}, {
  set(target, property, value) { target[property] = value; return true; }
});

const ids = [
  "flight-canvas", "stage", "mode-select", "camera-button", "pause-button", "reset-button",
  "fullscreen-button", "score-value", "gate-value", "gate-total", "altitude-value", "speed-value",
  "fps-value", "throttle-value", "lap-value", "message", "paused-panel", "live-status",
  "left-stick", "right-stick"
];
const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement(id)]));
elements["flight-canvas"].width = 960;
elements["flight-canvas"].height = 540;
elements["flight-canvas"].getContext = () => drawingContext;

const shell = new FakeElement("shell");
shell.requestFullscreen = async () => {};

const document = {
  documentElement: { lang: "zh-Hant" },
  hidden: false,
  fullscreenElement: null,
  getElementById: (id) => elements[id] ?? null,
  querySelector: (selector) => selector === ".sim-shell" ? shell : null,
  addEventListener(type, callback) { listeners.set(`document:${type}`, callback); },
  exitFullscreen: async () => {}
};

const windowObject = {
  devicePixelRatio: 1.5,
  matchMedia: () => ({ matches: false }),
  addEventListener(type, callback) { listeners.set(`window:${type}`, callback); },
  setTimeout() { return 1; }
};

class FakeInput {}
class FakeTextArea {}
class FakeSelect {}
class FakeButton {}
class FakeResizeObserver { constructor(callback) { this.callback = callback; } observe() {} }

const sandbox = {
  window: windowObject,
  document,
  navigator: { language: "zh-Hant" },
  performance: { now: () => now },
  requestAnimationFrame(callback) { rafQueue.push(callback); return rafQueue.length; },
  ResizeObserver: FakeResizeObserver,
  HTMLInputElement: FakeInput,
  HTMLTextAreaElement: FakeTextArea,
  HTMLSelectElement: FakeSelect,
  HTMLButtonElement: FakeButton,
  console,
  Math,
  Object,
  Set,
  Map,
  Promise
};

vm.runInNewContext(source, sandbox, { filename: "simulator.js" });

const diagnostics = windowObject.DroneSimDiagnostics;
assert.ok(diagnostics, "diagnostics API should be exposed");
assert.equal(diagnostics.fixedStep, 1 / 120);
assert.equal(diagnostics.ringCount, 8);
assert.equal(diagnostics.getState().mode, "beginner");
assert.ok(rafQueue.length > 0, "animation should schedule a frame");

const keydown = listeners.get("window:keydown");
const keyup = listeners.get("window:keyup");
assert.equal(typeof keydown, "function");
assert.equal(typeof keyup, "function");

const event = (code) => ({ code, repeat: false, target: elements.stage, preventDefault() {} });
keydown(event("KeyW"));
keydown(event("ArrowUp"));

for (let frame = 0; frame < 180; frame += 1) {
  now += 1000 / 60;
  const callback = rafQueue.shift();
  assert.equal(typeof callback, "function", "every frame should schedule the next frame");
  callback(now);
}

keyup(event("KeyW"));
keyup(event("ArrowUp"));
const afterFlight = diagnostics.getState();
assert.ok(afterFlight.position.y > 2.6, "beginner throttle command should raise assisted-hover altitude");
assert.ok(afterFlight.position.z > 0.5, "forward pitch command should move the drone down-course");
assert.ok(Number.isFinite(afterFlight.fps) && afterFlight.fps > 0, "FPS telemetry should be finite");

diagnostics.pause(true);
const beforePausedFrames = diagnostics.getState().position;
for (let frame = 0; frame < 20; frame += 1) {
  now += 1000 / 60;
  rafQueue.shift()(now);
}
const afterPausedFrames = diagnostics.getState().position;
assert.deepEqual(afterPausedFrames, beforePausedFrames, "paused simulator should not advance physics");

diagnostics.reset();
const resetState = diagnostics.getState();
assert.equal(resetState.score, 0);
assert.equal(resetState.currentRing, 0);
assert.equal(resetState.position.y, 2.5);

console.log("Drone simulator mocked runtime and physics checks passed.");
