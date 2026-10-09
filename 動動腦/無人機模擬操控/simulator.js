(() => {
  "use strict";

  const canvas = document.getElementById("flight-canvas");
  const stage = document.getElementById("stage");
  const shell = document.querySelector(".sim-shell");
  const context = canvas && canvas.getContext("2d", { alpha: false });

  if (!canvas || !stage || !context) {
    return;
  }

  const dom = {
    mode: document.getElementById("mode-select"),
    camera: document.getElementById("camera-button"),
    pause: document.getElementById("pause-button"),
    reset: document.getElementById("reset-button"),
    fullscreen: document.getElementById("fullscreen-button"),
    score: document.getElementById("score-value"),
    gate: document.getElementById("gate-value"),
    gateTotal: document.getElementById("gate-total"),
    altitude: document.getElementById("altitude-value"),
    speed: document.getElementById("speed-value"),
    fps: document.getElementById("fps-value"),
    throttle: document.getElementById("throttle-value"),
    lap: document.getElementById("lap-value"),
    message: document.getElementById("message"),
    pausedPanel: document.getElementById("paused-panel"),
    liveStatus: document.getElementById("live-status")
  };

  const TAU = Math.PI * 2;
  const FIXED_STEP = 1 / 120;
  const MAX_FRAME_TIME = 0.2;
  const WORLD_LIMITS = { x: 82, y: 54, zMin: -24, zMax: 330 };
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const rings = [
    { x: 0, y: 5.0, z: 30, radius: 4.1 },
    { x: 8, y: 7.0, z: 60, radius: 4.0 },
    { x: -7, y: 9.5, z: 91, radius: 4.2 },
    { x: -14, y: 6.8, z: 123, radius: 3.9 },
    { x: 3, y: 5.0, z: 155, radius: 4.0 },
    { x: 15, y: 10.5, z: 188, radius: 4.3 },
    { x: 4, y: 13.0, z: 222, radius: 4.2 },
    { x: -8, y: 7.0, z: 258, radius: 4.5 }
  ];

  const zh = {
    "drone.msgStart": "朝亮色圓環飛行，小幅操作更容易保持穩定。",
    "drone.msgGate": "漂亮！通過圓環",
    "drone.msgMiss": "差一點，再對準圓環中心試一次。",
    "drone.msgCrash": "觸地！已安全返回起飛點。",
    "drone.msgBoundary": "已接近練習區邊界。",
    "drone.msgLap": "完成一圈！準備下一圈。",
    "drone.msgReset": "飛行器與賽道已重新設定。",
    "drone.msgMode": "飛行模式已切換。",
    "drone.msgAutoPause": "切換分頁時已自動暫停。",
    "drone.cameraFpv": "第一人稱",
    "drone.cameraThird": "第三人稱",
    "drone.pause": "暫停",
    "drone.resume": "繼續"
  };

  const en = {
    "drone.msgStart": "Fly toward the bright ring. Small inputs are easier to control.",
    "drone.msgGate": "Nice! Gate cleared",
    "drone.msgMiss": "Almost. Re-center and try the ring again.",
    "drone.msgCrash": "Ground contact. Safely returned to the launch point.",
    "drone.msgBoundary": "You are near the practice-area boundary.",
    "drone.msgLap": "Lap complete. Get ready for the next lap.",
    "drone.msgReset": "Aircraft and course reset.",
    "drone.msgMode": "Flight mode changed.",
    "drone.msgAutoPause": "Automatically paused while the tab was hidden.",
    "drone.cameraFpv": "First person",
    "drone.cameraThird": "Third person",
    "drone.pause": "Pause",
    "drone.resume": "Resume"
  };

  const input = {
    keys: new Set(),
    left: { x: 0, y: 0, pointerId: null },
    right: { x: 0, y: 0, pointerId: null }
  };

  const state = {
    position: vec(0, 2.5, 0),
    previousPosition: vec(0, 2.5, 0),
    velocity: vec(0, 0, 0),
    yaw: 0,
    pitch: 0,
    roll: 0,
    yawRate: 0,
    pitchRate: 0,
    rollRate: 0,
    throttle: 0.5,
    hoverAltitude: 2.5,
    mode: "beginner",
    cameraMode: "third",
    paused: false,
    score: 0,
    lap: 0,
    currentRing: 0,
    gateStartedAt: performance.now(),
    crossingCooldown: 0,
    boundaryCooldown: 0,
    messageUntil: 0,
    rotorPhase: 0,
    simTime: 0,
    fps: 60,
    fpsSampleFrames: 0,
    fpsSampleStart: performance.now(),
    lowFpsSeconds: 0,
    highFpsSeconds: 0,
    renderWidth: 1,
    renderHeight: 1,
    dprCap: Math.min(window.devicePixelRatio || 1, isCoarsePointer ? 1.25 : 1.6),
    dprFloor: 0.75,
    quality: "high"
  };

  const scenery = buildScenery();
  let lastFrame = performance.now();
  let accumulator = 0;
  let hudClock = 0;

  function vec(x = 0, y = 0, z = 0) {
    return { x, y, z };
  }

  function add(a, b) {
    return vec(a.x + b.x, a.y + b.y, a.z + b.z);
  }

  function sub(a, b) {
    return vec(a.x - b.x, a.y - b.y, a.z - b.z);
  }

  function scale(a, amount) {
    return vec(a.x * amount, a.y * amount, a.z * amount);
  }

  function dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  function cross(a, b) {
    return vec(
      a.y * b.z - a.z * b.y,
      a.z * b.x - a.x * b.z,
      a.x * b.y - a.y * b.x
    );
  }

  function length(a) {
    return Math.hypot(a.x, a.y, a.z);
  }

  function normalize(a) {
    const magnitude = length(a) || 1;
    return scale(a, 1 / magnitude);
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function approach(current, target, speed, dt) {
    const amount = 1 - Math.exp(-speed * dt);
    return current + (target - current) * amount;
  }

  function wrapAngle(value) {
    while (value > Math.PI) value -= TAU;
    while (value < -Math.PI) value += TAU;
    return value;
  }

  function runtimeTranslation(key) {
    const runtime = window.SA_I18N;
    if (!runtime) return "";
    try {
      if (typeof runtime.tr === "function") return runtime.tr(key, "") || "";
      if (typeof runtime.t === "function") return runtime.t(key) || "";
      if (typeof runtime.translate === "function") return runtime.translate(key) || "";
      if (typeof runtime.get === "function") return runtime.get(key) || "";
    } catch (_error) {
      return "";
    }
    return "";
  }

  function text(key) {
    const translated = runtimeTranslation(key);
    if (translated && translated !== key) return translated;
    const language = (document.documentElement.lang || navigator.language || "zh-Hant").toLowerCase();
    return language.startsWith("zh") ? (zh[key] || key) : (en[key] || zh[key] || key);
  }

  function setLocalizedNode(node, key, english, traditionalChinese) {
    if (!node) return;
    node.dataset.i18n = key;
    node.dataset.en = english;
    const translated = runtimeTranslation(key);
    const language = (document.documentElement.lang || navigator.language || "zh-Hant").toLowerCase();
    node.textContent = translated && translated !== key
      ? translated
      : (language.startsWith("zh") ? traditionalChinese : english);
  }

  function applySharedI18n() {
    const runtime = window.SA_I18N;
    if (!runtime) return;
    try {
      if (typeof runtime.apply === "function") runtime.apply(document);
      else if (typeof runtime.translatePage === "function") runtime.translatePage(document);
      else if (typeof runtime.refresh === "function") runtime.refresh(document);
    } catch (_error) {
      // The simulator keeps its embedded Traditional Chinese fallback if the shared runtime differs.
    }
  }

  function refreshLanguage() {
    applySharedI18n();
    const label = dom.camera.querySelector("span:last-child");
    const fpv = state.cameraMode === "fpv";
    setLocalizedNode(label, fpv ? "firstPerson" : "thirdPerson", fpv ? "First person" : "Third person", fpv ? "第一人稱" : "第三人稱");
    const pauseLabel = dom.pause.querySelector("span:last-child");
    setLocalizedNode(pauseLabel, state.paused ? "start" : "pause", state.paused ? "Resume" : "Pause", state.paused ? "繼續" : "暫停");
    updateStatus();
  }

  function buildScenery() {
    let seed = 12973;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const trees = [];
    for (let i = 0; i < 68; i += 1) {
      const side = random() > 0.5 ? 1 : -1;
      trees.push({
        x: side * (24 + random() * 60),
        y: 0,
        z: 12 + random() * 292,
        height: 2.4 + random() * 3.8,
        hue: 116 + Math.floor(random() * 26)
      });
    }
    const towers = [
      { x: -34, z: 42, height: 8, width: 5 },
      { x: 38, z: 78, height: 11, width: 6 },
      { x: -42, z: 146, height: 14, width: 7 },
      { x: 41, z: 211, height: 9, width: 5 },
      { x: -34, z: 273, height: 12, width: 7 }
    ];
    return { trees, towers };
  }

  function controls() {
    const pressed = (code) => input.keys.has(code) ? 1 : 0;
    return {
      throttle: clamp(pressed("KeyW") - pressed("KeyS") - input.left.y, -1, 1),
      yaw: clamp(pressed("KeyD") - pressed("KeyA") + input.left.x, -1, 1),
      pitch: clamp(pressed("ArrowUp") - pressed("ArrowDown") - input.right.y, -1, 1),
      roll: clamp(pressed("ArrowRight") - pressed("ArrowLeft") + input.right.x, -1, 1)
    };
  }

  function physicsStep(dt) {
    if (state.paused) return;

    const command = controls();
    state.previousPosition = { ...state.position };
    state.simTime += dt;
    state.rotorPhase = (state.rotorPhase + dt * (22 + state.throttle * 34)) % TAU;
    state.crossingCooldown = Math.max(0, state.crossingCooldown - dt);
    state.boundaryCooldown = Math.max(0, state.boundaryCooldown - dt);

    if (state.mode === "beginner") {
      state.hoverAltitude = clamp(state.hoverAltitude + command.throttle * 5.2 * dt, 1.2, 31);
      const altitudeAcceleration = (state.hoverAltitude - state.position.y) * 4.4 - state.velocity.y * 3.1;
      state.velocity.y += altitudeAcceleration * dt;
      state.throttle = clamp(0.5 + altitudeAcceleration / 30, 0.22, 0.8);
      state.pitch = approach(state.pitch, -command.pitch * 0.34, 6.5, dt);
      state.roll = approach(state.roll, command.roll * 0.38, 6.5, dt);
      state.yawRate = approach(state.yawRate, command.yaw * 1.3, 5.2, dt);
      state.pitchRate = 0;
      state.rollRate = 0;
    } else if (state.mode === "normal") {
      state.throttle = clamp(state.throttle + command.throttle * 0.34 * dt, 0, 1);
      state.pitch = approach(state.pitch, -command.pitch * 0.52, 4.6, dt);
      state.roll = approach(state.roll, command.roll * 0.58, 4.6, dt);
      state.yawRate = approach(state.yawRate, command.yaw * 1.65, 4, dt);
      state.velocity.y += ((state.throttle - 0.5) * 18 - state.velocity.y * 1.15) * dt;
      state.pitchRate = 0;
      state.rollRate = 0;
    } else {
      state.throttle = clamp(state.throttle + command.throttle * 0.42 * dt, 0, 1);
      state.pitchRate += -command.pitch * 2.7 * dt;
      state.rollRate += command.roll * 3.0 * dt;
      state.yawRate += command.yaw * 2.5 * dt;
      state.pitchRate *= Math.exp(-0.72 * dt);
      state.rollRate *= Math.exp(-0.72 * dt);
      state.yawRate *= Math.exp(-0.6 * dt);
      state.pitch = clamp(state.pitch + state.pitchRate * dt, -1.22, 1.22);
      state.roll = clamp(state.roll + state.rollRate * dt, -1.35, 1.35);
      const tiltLift = Math.max(0.25, Math.cos(state.pitch) * Math.cos(state.roll));
      state.velocity.y += ((state.throttle * 2 - 1) * 12 * tiltLift - state.velocity.y * 0.46) * dt;
    }

    state.yaw = wrapAngle(state.yaw + state.yawRate * dt);

    const forwardAcceleration = -Math.sin(state.pitch) * (10 + 11 * state.throttle);
    const rightAcceleration = Math.sin(state.roll) * (10 + 11 * state.throttle);
    const sinYaw = Math.sin(state.yaw);
    const cosYaw = Math.cos(state.yaw);
    state.velocity.x += (rightAcceleration * cosYaw + forwardAcceleration * sinYaw) * dt;
    state.velocity.z += (-rightAcceleration * sinYaw + forwardAcceleration * cosYaw) * dt;

    const drag = state.mode === "expert" ? 0.28 : (state.mode === "normal" ? 0.62 : 0.82);
    const dragFactor = Math.exp(-drag * dt);
    state.velocity.x *= dragFactor;
    state.velocity.z *= dragFactor;
    state.velocity.y *= Math.exp(-0.08 * dt);

    const horizontalSpeed = Math.hypot(state.velocity.x, state.velocity.z);
    const maxHorizontalSpeed = state.mode === "expert" ? 24 : (state.mode === "normal" ? 18 : 13);
    if (horizontalSpeed > maxHorizontalSpeed) {
      const factor = maxHorizontalSpeed / horizontalSpeed;
      state.velocity.x *= factor;
      state.velocity.z *= factor;
    }

    state.position.x += state.velocity.x * dt;
    state.position.y += state.velocity.y * dt;
    state.position.z += state.velocity.z * dt;

    if (state.position.y <= 0.32) {
      state.score = Math.max(0, state.score - 50);
      showMessage(text("drone.msgCrash"), 2.3);
      resetAircraft(true);
      return;
    }

    if (state.position.y > WORLD_LIMITS.y) {
      state.position.y = WORLD_LIMITS.y;
      state.velocity.y = Math.min(0, state.velocity.y) * 0.35;
      boundaryWarning();
    }

    if (Math.abs(state.position.x) > WORLD_LIMITS.x) {
      state.position.x = clamp(state.position.x, -WORLD_LIMITS.x, WORLD_LIMITS.x);
      state.velocity.x *= -0.35;
      boundaryWarning();
    }

    if (state.position.z < WORLD_LIMITS.zMin || state.position.z > WORLD_LIMITS.zMax) {
      state.position.z = clamp(state.position.z, WORLD_LIMITS.zMin, WORLD_LIMITS.zMax);
      state.velocity.z *= -0.35;
      boundaryWarning();
    }

    checkRingCrossing();
  }

  function boundaryWarning() {
    if (state.boundaryCooldown > 0) return;
    state.boundaryCooldown = 2.5;
    showMessage(text("drone.msgBoundary"), 1.6);
  }

  function checkRingCrossing() {
    if (state.crossingCooldown > 0) return;
    const ring = rings[state.currentRing];
    const previousSide = state.previousPosition.z - ring.z;
    const currentSide = state.position.z - ring.z;
    if (previousSide === 0 || previousSide * currentSide > 0) return;

    const crossingT = Math.abs(previousSide) / (Math.abs(previousSide) + Math.abs(currentSide));
    const crossingX = state.previousPosition.x + (state.position.x - state.previousPosition.x) * crossingT;
    const crossingY = state.previousPosition.y + (state.position.y - state.previousPosition.y) * crossingT;
    const radialDistance = Math.hypot(crossingX - ring.x, crossingY - ring.y);
    state.crossingCooldown = 0.75;

    if (radialDistance < ring.radius * 0.77) {
      const elapsed = (performance.now() - state.gateStartedAt) / 1000;
      const timeBonus = Math.max(0, Math.round((15 - elapsed) * 8));
      state.score += 100 + timeBonus;
      state.currentRing += 1;
      state.gateStartedAt = performance.now();
      showMessage(`${text("drone.msgGate")} +${100 + timeBonus}`, 1.35);

      if (state.currentRing >= rings.length) {
        state.lap += 1;
        state.score += 500;
        state.currentRing = 0;
        showMessage(`${text("drone.msgLap")} +500`, 2.4);
        resetAircraft(true);
      }
    } else if (Math.abs(currentSide) < 1.2 || Math.abs(state.velocity.z) > 1) {
      showMessage(text("drone.msgMiss"), 1.5);
    }
  }

  function resetAircraft(preserveProgress = false) {
    state.position = vec(0, 2.5, 0);
    state.previousPosition = vec(0, 2.5, 0);
    state.velocity = vec(0, 0, 0);
    state.yaw = 0;
    state.pitch = 0;
    state.roll = 0;
    state.yawRate = 0;
    state.pitchRate = 0;
    state.rollRate = 0;
    state.throttle = 0.5;
    state.hoverAltitude = 2.5;
    state.crossingCooldown = 0.8;
    input.keys.clear();
    resetStick(input.left, document.getElementById("left-stick"));
    resetStick(input.right, document.getElementById("right-stick"));
    if (!preserveProgress) {
      state.score = 0;
      state.lap = 0;
      state.currentRing = 0;
      state.gateStartedAt = performance.now();
    }
    updateHud(true);
  }

  function showMessage(message, duration = 1.5) {
    dom.message.textContent = message;
    dom.message.classList.add("show");
    state.messageUntil = performance.now() + duration * 1000;
  }

  function setPaused(paused, automatic = false) {
    state.paused = Boolean(paused);
    dom.pausedPanel.hidden = !state.paused;
    dom.pause.setAttribute("aria-pressed", String(state.paused));
    const label = dom.pause.querySelector("span:last-child");
    if (state.paused) {
      setLocalizedNode(label, "start", "Resume", "繼續");
      dom.pause.querySelector("span:first-child").textContent = "▶";
      if (automatic) showMessage(text("drone.msgAutoPause"), 2);
    } else {
      setLocalizedNode(label, "pause", "Pause", "暫停");
      dom.pause.querySelector("span:first-child").textContent = "Ⅱ";
      lastFrame = performance.now();
      accumulator = 0;
    }
    updateStatus();
  }

  function toggleCamera() {
    state.cameraMode = state.cameraMode === "third" ? "fpv" : "third";
    const label = dom.camera.querySelector("span:last-child");
    const fpv = state.cameraMode === "fpv";
    dom.camera.setAttribute("aria-pressed", String(fpv));
    setLocalizedNode(label, fpv ? "firstPerson" : "thirdPerson", fpv ? "First person" : "Third person", fpv ? "第一人稱" : "第三人稱");
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await shell.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (_error) {
      showMessage("Fullscreen is unavailable in this browser.", 1.8);
    }
  }

  function updateStatus() {
    const textNode = dom.liveStatus.querySelector("span:last-child");
    if (!textNode) return;
    if (state.paused) {
      textNode.textContent = document.documentElement.lang.toLowerCase().startsWith("zh") ? "模擬器已暫停" : "Simulator paused";
    } else {
      const modeLabels = {
        beginner: ["初學者懸停輔助", "Beginner hover assist"],
        normal: ["一般穩定模式", "Normal stabilized mode"],
        expert: ["專家手動模式", "Expert manual mode"]
      };
      const language = document.documentElement.lang.toLowerCase();
      textNode.textContent = modeLabels[state.mode][language.startsWith("zh") ? 0 : 1];
    }
  }

  function updateHud(force = false) {
    if (!force && state.simTime < hudClock) return;
    hudClock = state.simTime + 0.08;
    const speed = length(state.velocity);
    dom.score.textContent = String(Math.round(state.score)).padStart(4, "0");
    dom.gate.textContent = String(state.currentRing + 1);
    dom.gateTotal.textContent = String(rings.length);
    dom.altitude.textContent = Math.max(0, state.position.y).toFixed(1);
    dom.speed.textContent = speed.toFixed(1);
    dom.fps.textContent = String(Math.round(state.fps));
    dom.throttle.textContent = String(Math.round(state.throttle * 100));
    dom.lap.textContent = String(state.lap);
  }

  function createCamera() {
    const flatForward = vec(Math.sin(state.yaw), 0, Math.cos(state.yaw));
    let position;
    let target;

    if (state.cameraMode === "fpv") {
      const forward = normalize(vec(
        Math.sin(state.yaw) * Math.cos(state.pitch),
        Math.sin(state.pitch),
        Math.cos(state.yaw) * Math.cos(state.pitch)
      ));
      position = add(state.position, add(scale(forward, 0.38), vec(0, 0.25, 0)));
      target = add(position, scale(forward, 14));
    } else {
      position = add(state.position, add(scale(flatForward, -11.5), vec(0, 5.0, 0)));
      target = add(state.position, add(scale(flatForward, 5.5), vec(0, 1.1, 0)));
    }

    const forward = normalize(sub(target, position));
    let right = normalize(cross(forward, vec(0, 1, 0)));
    if (length(right) < 0.1) right = vec(1, 0, 0);
    const up = normalize(cross(right, forward));
    return {
      position,
      forward,
      right,
      up,
      focal: Math.min(state.renderWidth, state.renderHeight) * (state.cameraMode === "fpv" ? 0.92 : 0.86)
    };
  }

  function project(point, camera) {
    const relative = sub(point, camera.position);
    const depth = dot(relative, camera.forward);
    if (depth < 0.18) return null;
    return {
      x: state.renderWidth * 0.5 + dot(relative, camera.right) * camera.focal / depth,
      y: state.renderHeight * 0.52 - dot(relative, camera.up) * camera.focal / depth,
      depth
    };
  }

  function drawLine3D(a, b, camera, style, width = 1, alpha = 1) {
    const pa = project(a, camera);
    const pb = project(b, camera);
    if (!pa || !pb) return;
    context.globalAlpha = alpha;
    context.strokeStyle = style;
    context.lineWidth = width;
    context.beginPath();
    context.moveTo(pa.x, pa.y);
    context.lineTo(pb.x, pb.y);
    context.stroke();
    context.globalAlpha = 1;
  }

  function drawPolygon3D(points, camera, fill, stroke = "", alpha = 1) {
    const projected = points.map((point) => project(point, camera));
    if (projected.some((point) => !point)) return;
    context.globalAlpha = alpha;
    context.beginPath();
    context.moveTo(projected[0].x, projected[0].y);
    for (let i = 1; i < projected.length; i += 1) context.lineTo(projected[i].x, projected[i].y);
    context.closePath();
    if (fill) {
      context.fillStyle = fill;
      context.fill();
    }
    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = 1;
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  function render() {
    const width = state.renderWidth;
    const height = state.renderHeight;
    context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    context.clearRect(0, 0, width, height);

    const sky = context.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#4c90c9");
    sky.addColorStop(0.53, "#b9def0");
    sky.addColorStop(0.535, "#628e65");
    sky.addColorStop(1, "#173c32");
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);

    drawDistantHills(width, height);
    const camera = createCamera();
    drawGround(camera);
    drawCoursePath(camera);
    drawScenery(camera);
    drawRings(camera);
    if (state.cameraMode === "third") drawDrone(camera);
    else drawFpvOverlay(width, height);
    drawTargetGuide(camera, width, height);

    if (performance.now() > state.messageUntil) dom.message.classList.remove("show");
  }

  function drawDistantHills(width, height) {
    const horizon = height * 0.53;
    context.fillStyle = "rgba(37, 91, 82, 0.82)";
    context.beginPath();
    context.moveTo(0, horizon + 30);
    for (let x = 0; x <= width + 80; x += 80) {
      const wave = Math.sin(x * 0.012 + state.yaw) * 24 + Math.sin(x * 0.027) * 10;
      context.lineTo(x, horizon - 24 - wave);
    }
    context.lineTo(width, horizon + 80);
    context.lineTo(0, horizon + 80);
    context.closePath();
    context.fill();
  }

  function drawGround(camera) {
    const centerZ = Math.floor(camera.position.z / 10) * 10;
    const detail = state.quality === "low" ? 20 : 10;
    for (let z = centerZ - 20; z <= centerZ + 250; z += detail) {
      const major = z % 50 === 0;
      drawLine3D(vec(-110, 0, z), vec(110, 0, z), camera, major ? "#86a17c" : "#4f725e", major ? 1.5 : 1, major ? 0.5 : 0.34);
    }
    for (let x = -100; x <= 100; x += detail) {
      const major = x % 50 === 0;
      drawLine3D(vec(x, 0, centerZ - 20), vec(x, 0, centerZ + 270), camera, major ? "#86a17c" : "#4f725e", major ? 1.5 : 1, major ? 0.5 : 0.34);
    }

    drawPolygon3D([
      vec(-5, 0.018, -5), vec(5, 0.018, -5), vec(5, 0.018, 275), vec(-5, 0.018, 275)
    ], camera, "rgba(42, 53, 58, 0.68)", "rgba(214, 229, 226, 0.32)");

    for (let z = 4; z < 275; z += 16) {
      drawPolygon3D([
        vec(-0.18, 0.035, z), vec(0.18, 0.035, z), vec(0.18, 0.035, z + 7), vec(-0.18, 0.035, z + 7)
      ], camera, "rgba(255, 244, 189, 0.66)");
    }

    const shadow = project(vec(state.position.x, 0.05, state.position.z), camera);
    if (shadow) {
      const radius = clamp(camera.focal * 0.7 / shadow.depth, 2, 30) * (1 + state.position.y * 0.02);
      context.fillStyle = `rgba(0, 0, 0, ${clamp(0.28 - state.position.y * 0.004, 0.08, 0.25)})`;
      context.beginPath();
      context.ellipse(shadow.x, shadow.y, radius * 1.7, radius * 0.55, 0, 0, TAU);
      context.fill();
    }
  }

  function drawCoursePath(camera) {
    context.setLineDash([6, 9]);
    for (let index = 0; index < rings.length - 1; index += 1) {
      const a = rings[index];
      const b = rings[index + 1];
      drawLine3D(vec(a.x, 0.08, a.z), vec(b.x, 0.08, b.z), camera, "rgba(58, 230, 224, 0.48)", 1.5, 0.7);
    }
    context.setLineDash([]);
  }

  function drawScenery(camera) {
    const drawables = [];
    for (const tree of scenery.trees) {
      const p = project(vec(tree.x, tree.height * 0.5, tree.z), camera);
      if (p) drawables.push({ depth: p.depth, type: "tree", value: tree });
    }
    for (const tower of scenery.towers) {
      const p = project(vec(tower.x, tower.height * 0.5, tower.z), camera);
      if (p) drawables.push({ depth: p.depth, type: "tower", value: tower });
    }
    drawables.sort((a, b) => b.depth - a.depth);

    for (const item of drawables) {
      if (item.type === "tree") drawTree(item.value, camera);
      else drawTower(item.value, camera);
    }
  }

  function drawTree(tree, camera) {
    const base = project(vec(tree.x, 0, tree.z), camera);
    const crown = project(vec(tree.x, tree.height, tree.z), camera);
    if (!base || !crown) return;
    const scaleOnScreen = clamp(camera.focal / crown.depth, 0.2, 35);
    context.strokeStyle = "#493c2c";
    context.lineWidth = clamp(scaleOnScreen * 0.28, 1, 7);
    context.beginPath();
    context.moveTo(base.x, base.y);
    context.lineTo(crown.x, crown.y + scaleOnScreen * 0.7);
    context.stroke();
    context.fillStyle = `hsl(${tree.hue} 39% 30%)`;
    context.beginPath();
    context.arc(crown.x, crown.y + scaleOnScreen * 0.3, clamp(tree.height * scaleOnScreen * 0.5, 1.5, 30), 0, TAU);
    context.fill();
  }

  function drawTower(tower, camera) {
    const half = tower.width * 0.5;
    const x = tower.x;
    const z = tower.z;
    const top = tower.height;
    const corners = [
      vec(x - half, 0, z - half), vec(x + half, 0, z - half),
      vec(x + half, 0, z + half), vec(x - half, 0, z + half),
      vec(x - half, top, z - half), vec(x + half, top, z - half),
      vec(x + half, top, z + half), vec(x - half, top, z + half)
    ];
    drawPolygon3D([corners[0], corners[1], corners[5], corners[4]], camera, "#435b66", "#6f8890");
    drawPolygon3D([corners[1], corners[2], corners[6], corners[5]], camera, "#304751", "#6f8890");
    drawPolygon3D([corners[4], corners[5], corners[6], corners[7]], camera, "#718892", "#91a6ab");
  }

  function drawRings(camera) {
    const ordered = rings.map((ring, index) => ({ ring, index, center: project(vec(ring.x, ring.y, ring.z), camera) }))
      .filter((entry) => entry.center)
      .sort((a, b) => b.center.depth - a.center.depth);

    for (const entry of ordered) {
      const active = entry.index === state.currentRing;
      const complete = entry.index < state.currentRing;
      const pulse = active && !prefersReducedMotion ? 1 + Math.sin(state.simTime * 4.5) * 0.045 : 1;
      const segments = state.quality === "low" ? 22 : 40;
      const points = [];
      for (let segment = 0; segment <= segments; segment += 1) {
        const angle = segment / segments * TAU;
        points.push(project(vec(
          entry.ring.x + Math.cos(angle) * entry.ring.radius * pulse,
          entry.ring.y + Math.sin(angle) * entry.ring.radius * pulse,
          entry.ring.z
        ), camera));
      }
      if (points.some((point) => !point)) continue;
      context.strokeStyle = active ? "rgba(255, 221, 106, 0.28)" : (complete ? "rgba(167, 191, 199, 0.22)" : "rgba(58, 230, 224, 0.22)");
      context.lineWidth = active ? 10 : 7;
      context.beginPath();
      points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
      context.stroke();
      context.strokeStyle = active ? "#ffdb63" : (complete ? "#83959c" : "#36ddd8");
      context.lineWidth = active ? 3.4 : 2.2;
      context.beginPath();
      points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
      context.stroke();

      const label = entry.center;
      if (label.depth < 170) {
        context.fillStyle = active ? "#1e1a08" : "#08252a";
        context.beginPath();
        context.arc(label.x, label.y - clamp(camera.focal * entry.ring.radius / label.depth, 10, 70) - 14, 12, 0, TAU);
        context.fill();
        context.fillStyle = active ? "#ffdb63" : "#7fece7";
        context.font = "700 11px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(String(entry.index + 1), label.x, label.y - clamp(camera.focal * entry.ring.radius / label.depth, 10, 70) - 14);
      }
    }
  }

  function localToWorld(local) {
    let x = local.x;
    let y = local.y;
    let z = local.z;
    const cr = Math.cos(state.roll);
    const sr = Math.sin(state.roll);
    const cp = Math.cos(state.pitch);
    const sp = Math.sin(state.pitch);
    const cy = Math.cos(state.yaw);
    const sy = Math.sin(state.yaw);

    const rolledX = x * cr - y * sr;
    const rolledY = x * sr + y * cr;
    x = rolledX;
    y = rolledY;
    const pitchedY = y * cp - z * sp;
    const pitchedZ = y * sp + z * cp;
    y = pitchedY;
    z = pitchedZ;
    const yawedX = x * cy + z * sy;
    const yawedZ = -x * sy + z * cy;
    return add(state.position, vec(yawedX, y, yawedZ));
  }

  function drawDrone(camera) {
    const body = project(state.position, camera);
    if (!body) return;
    const rotorLocals = [vec(-1.15, 0, -1.15), vec(1.15, 0, -1.15), vec(-1.15, 0, 1.15), vec(1.15, 0, 1.15)];
    const rotors = rotorLocals.map((point) => project(localToWorld(point), camera));
    if (rotors.some((point) => !point)) return;

    context.strokeStyle = "#e8f5fb";
    context.lineWidth = clamp(camera.focal * 0.055 / body.depth, 2, 7);
    for (const rotor of rotors) {
      context.beginPath();
      context.moveTo(body.x, body.y);
      context.lineTo(rotor.x, rotor.y);
      context.stroke();
    }

    const rotorRadius = clamp(camera.focal * 0.56 / body.depth, 4, 34);
    for (let index = 0; index < rotors.length; index += 1) {
      const rotor = rotors[index];
      context.save();
      context.translate(rotor.x, rotor.y);
      context.rotate(state.rotorPhase * (index % 2 ? 1 : -1));
      context.strokeStyle = index < 2 ? "rgba(255, 113, 113, 0.88)" : "rgba(91, 239, 230, 0.88)";
      context.lineWidth = 2;
      context.beginPath();
      context.ellipse(0, 0, rotorRadius, rotorRadius * 0.26, 0, 0, TAU);
      context.stroke();
      context.restore();
    }

    const bodySize = clamp(camera.focal * 0.6 / body.depth, 6, 38);
    context.fillStyle = "#15283c";
    context.strokeStyle = "#f5fbff";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(body.x, body.y - bodySize * 0.62);
    context.lineTo(body.x + bodySize * 0.62, body.y);
    context.lineTo(body.x, body.y + bodySize * 0.55);
    context.lineTo(body.x - bodySize * 0.62, body.y);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = "#ff6f65";
    context.beginPath();
    context.arc(body.x, body.y - bodySize * 0.22, Math.max(2, bodySize * 0.14), 0, TAU);
    context.fill();
  }

  function drawFpvOverlay(width, height) {
    const centerX = width * 0.5;
    const centerY = height * 0.52;
    context.strokeStyle = "rgba(255, 255, 255, 0.72)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(centerX - 24, centerY);
    context.lineTo(centerX - 7, centerY);
    context.moveTo(centerX + 7, centerY);
    context.lineTo(centerX + 24, centerY);
    context.moveTo(centerX, centerY - 24);
    context.lineTo(centerX, centerY - 7);
    context.moveTo(centerX, centerY + 7);
    context.lineTo(centerX, centerY + 24);
    context.stroke();

    const bankY = height * 0.72;
    context.save();
    context.translate(centerX, bankY);
    context.rotate(-state.roll);
    context.strokeStyle = "rgba(255, 221, 99, 0.8)";
    context.beginPath();
    context.moveTo(-52, 0);
    context.lineTo(-10, 0);
    context.lineTo(0, 8);
    context.lineTo(10, 0);
    context.lineTo(52, 0);
    context.stroke();
    context.restore();
  }

  function drawTargetGuide(camera, width, height) {
    const ring = rings[state.currentRing];
    const center = project(vec(ring.x, ring.y, ring.z), camera);
    if (!center) return;
    const margin = 34;
    if (center.x >= margin && center.x <= width - margin && center.y >= margin && center.y <= height - margin) return;

    const x = clamp(center.x, margin, width - margin);
    const y = clamp(center.y, margin, height - margin);
    const angle = Math.atan2(center.y - height * 0.5, center.x - width * 0.5);
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillStyle = "#ffdb63";
    context.beginPath();
    context.moveTo(13, 0);
    context.lineTo(-8, -8);
    context.lineTo(-8, 8);
    context.closePath();
    context.fill();
    context.restore();
  }

  function resizeCanvas() {
    const bounds = stage.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1) return;
    const dpr = clamp(Math.min(window.devicePixelRatio || 1, state.dprCap), state.dprFloor, 2);
    const width = Math.round(bounds.width * dpr);
    const height = Math.round(bounds.height * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    state.renderWidth = bounds.width;
    state.renderHeight = bounds.height;
  }

  function samplePerformance(now) {
    state.fpsSampleFrames += 1;
    const elapsed = (now - state.fpsSampleStart) / 1000;
    if (elapsed < 1) return;
    const measured = state.fpsSampleFrames / elapsed;
    state.fps = state.fps * 0.55 + measured * 0.45;
    state.fpsSampleFrames = 0;
    state.fpsSampleStart = now;

    if (state.fps < 43) {
      state.lowFpsSeconds += elapsed;
      state.highFpsSeconds = 0;
    } else if (state.fps > 57) {
      state.highFpsSeconds += elapsed;
      state.lowFpsSeconds = 0;
    } else {
      state.lowFpsSeconds = Math.max(0, state.lowFpsSeconds - elapsed * 0.5);
      state.highFpsSeconds = 0;
    }

    if (state.lowFpsSeconds > 2.2 && state.dprCap > state.dprFloor) {
      state.dprCap = Math.max(state.dprFloor, state.dprCap - 0.2);
      state.quality = state.dprCap <= 1 ? "low" : "high";
      state.lowFpsSeconds = 0;
      resizeCanvas();
    } else if (state.highFpsSeconds > 5 && state.dprCap < Math.min(window.devicePixelRatio || 1, isCoarsePointer ? 1.25 : 1.6)) {
      state.dprCap = Math.min(Math.min(window.devicePixelRatio || 1, isCoarsePointer ? 1.25 : 1.6), state.dprCap + 0.15);
      state.quality = state.dprCap <= 1 ? "low" : "high";
      state.highFpsSeconds = 0;
      resizeCanvas();
    }
  }

  function animationFrame(now) {
    const frameTime = Math.min(MAX_FRAME_TIME, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (!state.paused) {
      accumulator += frameTime;
      let safety = 0;
      while (accumulator >= FIXED_STEP && safety < 30) {
        physicsStep(FIXED_STEP);
        accumulator -= FIXED_STEP;
        safety += 1;
      }
    } else {
      accumulator = 0;
    }
    render();
    updateHud();
    samplePerformance(now);
    requestAnimationFrame(animationFrame);
  }

  function editableTarget(target) {
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target instanceof HTMLButtonElement;
  }

  function onKeyDown(event) {
    if (editableTarget(event.target)) return;
    const movementKeys = ["KeyW", "KeyS", "KeyA", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    if (movementKeys.includes(event.code)) {
      event.preventDefault();
      input.keys.add(event.code);
      return;
    }
    if (event.repeat) return;
    if (event.code === "Space") {
      event.preventDefault();
      setPaused(!state.paused);
    } else if (event.code === "KeyV") {
      event.preventDefault();
      toggleCamera();
    } else if (event.code === "KeyR") {
      event.preventDefault();
      resetAircraft(false);
      showMessage(text("drone.msgReset"), 1.5);
    } else if (event.code === "KeyF") {
      event.preventDefault();
      toggleFullscreen();
    }
  }

  function onKeyUp(event) {
    input.keys.delete(event.code);
  }

  function setupStick(element, stickState) {
    if (!element) return;
    const knob = element.querySelector(".stick-knob");
    const update = (event) => {
      const bounds = element.getBoundingClientRect();
      const radius = bounds.width * 0.34;
      let x = (event.clientX - (bounds.left + bounds.width / 2)) / radius;
      let y = (event.clientY - (bounds.top + bounds.height / 2)) / radius;
      const magnitude = Math.hypot(x, y);
      if (magnitude > 1) {
        x /= magnitude;
        y /= magnitude;
      }
      stickState.x = Math.abs(x) < 0.05 ? 0 : x;
      stickState.y = Math.abs(y) < 0.05 ? 0 : y;
      knob.style.transform = `translate(calc(-50% + ${x * radius}px), calc(-50% + ${y * radius}px))`;
    };

    element.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      stickState.pointerId = event.pointerId;
      element.setPointerCapture(event.pointerId);
      update(event);
    });
    element.addEventListener("pointermove", (event) => {
      if (stickState.pointerId !== event.pointerId) return;
      event.preventDefault();
      update(event);
    });
    const release = (event) => {
      if (stickState.pointerId !== event.pointerId) return;
      resetStick(stickState, element);
    };
    element.addEventListener("pointerup", release);
    element.addEventListener("pointercancel", release);
    element.addEventListener("lostpointercapture", () => resetStick(stickState, element));
  }

  function resetStick(stickState, element) {
    stickState.x = 0;
    stickState.y = 0;
    stickState.pointerId = null;
    const knob = element && element.querySelector(".stick-knob");
    if (knob) knob.style.transform = "translate(-50%, -50%)";
  }

  dom.mode.addEventListener("change", () => {
    state.mode = dom.mode.value;
    resetAircraft(true);
    updateStatus();
    showMessage(text("drone.msgMode"), 1.3);
  });
  dom.camera.addEventListener("click", toggleCamera);
  dom.pause.addEventListener("click", () => setPaused(!state.paused));
  dom.reset.addEventListener("click", () => {
    resetAircraft(false);
    showMessage(text("drone.msgReset"), 1.5);
  });
  dom.fullscreen.addEventListener("click", toggleFullscreen);
  stage.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".touch-stick")) stage.focus({ preventScroll: true });
  });
  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => input.keys.clear());
  window.addEventListener("resize", resizeCanvas, { passive: true });
  document.addEventListener("fullscreenchange", resizeCanvas);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && !state.paused) setPaused(true, true);
  });
  window.addEventListener("sa-language-change", refreshLanguage);
  window.addEventListener("sa:language", refreshLanguage);
  window.addEventListener("SmartActionLanguage", refreshLanguage);
  document.addEventListener("sa:language", refreshLanguage);
  document.addEventListener("smartactionlanguage", refreshLanguage);

  setupStick(document.getElementById("left-stick"), input.left);
  setupStick(document.getElementById("right-stick"), input.right);

  if (typeof ResizeObserver === "function") {
    new ResizeObserver(resizeCanvas).observe(stage);
  }

  window.DroneSimDiagnostics = Object.freeze({
    getState: () => ({
      mode: state.mode,
      cameraMode: state.cameraMode,
      paused: state.paused,
      position: { ...state.position },
      velocity: { ...state.velocity },
      score: state.score,
      lap: state.lap,
      currentRing: state.currentRing,
      fps: state.fps,
      dprCap: state.dprCap
    }),
    reset: () => resetAircraft(false),
    pause: (value = true) => setPaused(value),
    fixedStep: FIXED_STEP,
    ringCount: rings.length
  });

  resizeCanvas();
  updateStatus();
  updateHud(true);
  applySharedI18n();
  window.setTimeout(applySharedI18n, 150);
  showMessage(text("drone.msgStart"), 4.2);
  requestAnimationFrame(animationFrame);
})();
