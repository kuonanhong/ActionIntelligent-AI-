import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const [html, css, js, readme] = await Promise.all([
  readFile(resolve(root, "index.html"), "utf8"),
  readFile(resolve(root, "styles.css"), "utf8"),
  readFile(resolve(root, "simulator.js"), "utf8"),
  readFile(resolve(root, "README.md"), "utf8")
]);

assert.match(html, /<canvas[^>]+id="flight-canvas"/i, "flight canvas is required");
assert.match(html, /id="left-stick"[\s\S]*id="right-stick"/, "two touch joysticks are required");
assert.match(html, /W<\/kbd>[\s\S]*S<\/kbd>[\s\S]*A<\/kbd>[\s\S]*D<\/kbd>/, "Mode 2 keyboard help is required");
assert.match(html, /\.\.\/\.\.\/assets\/portal-i18n\.js/, "shared i18n runtime path is required");
assert.match(html, /\.\.\/\.\.\/assets\/engage\.js/, "shared engage runtime path is required");
assert.match(html, /data-sa-engage/, "visible optional support slot is required");
assert.match(html, /drone\.caa\.gov\.tw/, "Taiwan CAA reference is required");
assert.match(html, /maps\.google\.com/, "Google Maps reference is required");
assert.match(html, /openstreetmap\.org\/copyright/, "OSM attribution reference is required");
assert.match(html, /not flight certification|不是飛行認證/i, "safety disclaimer is required");
assert.match(html, /data-i18n=/, "translatable UI markers are required");
assert.match(html, /data-en=/, "English fallback text is required");

assert.match(js, /const FIXED_STEP = 1 \/ 120/, "fixed-step physics is required");
assert.match(js, /requestAnimationFrame\(animationFrame\)/, "animation loop is required");
assert.match(js, /pointerdown/, "pointer-based touch controls are required");
assert.match(js, /state\.dprCap/, "adaptive pixel-ratio cap is required");
assert.match(js, /cameraMode === "fpv"/, "FPV camera is required");
assert.match(js, /currentRing/, "ring-course state is required");
assert.match(js, /window\.DroneSimDiagnostics/, "diagnostics hook is required");

assert.match(css, /\.touch-controls[\s\S]*direction:\s*ltr/, "physical touch layout must remain LTR in RTL locales");
assert.match(css, /@media \(pointer: coarse\)/, "touch-device layout is required");
assert.match(css, /:fullscreen/, "full-screen layout is required");

for (const source of [html, css, js]) {
  assert.doesNotMatch(source, /strikingly/i, "no Strikingly dependency is allowed");
  assert.doesNotMatch(source, /https?:\/\/[^\s"']+\.(?:js|css)(?:\?|["'])/i, "no external JS/CSS CDN is allowed");
}

assert.match(readme, /PhoenixRC/, "proprietary-asset exclusion must be documented");
assert.match(readme, /已知限制/, "known limitations must be documented");

console.log("Drone simulator smoke checks passed.");
