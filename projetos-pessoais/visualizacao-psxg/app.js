"use strict";

const MODEL_URL = "psxg_logistic_javascript.json";
const CALIBRATOR_URL = "psxg_xg_angle_calibrator.json";
const XG_GRID_URL = "xg_grid.json";
const SHOTS_URL = "shots_overlay.json?v=2";
const HEATMAP_SIZE = 120;
const GOAL_LEFT = 45.2;
const GOAL_RIGHT = 54.8;
const GOAL_TOP = 38;
const GOAL_WIDTH_M = 7.32;
const GOAL_HEIGHT_M = 2.44;
const VIEW_X_MIN = -6;
const VIEW_X_MAX = 6;
const VIEW_Z_MAX = 3.5;
const FIELD_X_MIN = 50;
const PITCH_LENGTH_M = 105;
const PITCH_WIDTH_M = 68;

const fieldCanvas = document.querySelector("#field-canvas");
const goalCanvas = document.querySelector("#goal-canvas");
const fieldContext = fieldCanvas.getContext("2d");
const goalContext = goalCanvas.getContext("2d");
const statusElement = document.querySelector("#model-status");
const originXElement = document.querySelector("#origin-x");
const originYElement = document.querySelector("#origin-y");
const xgValueElement = document.querySelector("#xg-value");
const xgScaleMaxElement = document.querySelector("#xg-scale-max");
const maxPsxgElement = document.querySelector("#max-psxg");
const maxPsxgLabelElement = document.querySelector("#max-psxg-label");
const goalReadoutElement = document.querySelector("#goal-readout");
const goalLegendElement = document.querySelector(".goal-panel > .legend");
const xgAdjustmentElement = document.querySelector("#xg-adjustment");
const calibrationExplanationElement = document.querySelector("#calibration-explanation");
const seasonButtons = [...document.querySelectorAll("[data-season]")];
const outcomeButtons = [...document.querySelectorAll("[data-outcome]")];
const shotsCountElement = document.querySelector("#shots-count");

const state = {
  model: null,
  calibrator: null,
  xgGrid: null,
  xgLayer: null,
  xgMaximum: 1,
  shots: [],
  fieldShotLayer: null,
  goalShotLayer: null,
  selectedSeason: "all",
  selectedOutcome: "none",
  originX: 100 - 11 / 105 * 100,
  originY: 50,
  calibratePsxg: false,
  animationFrame: null,
};

xgAdjustmentElement.checked = false;
calibrationExplanationElement.hidden = true;

const psxgStops = [
  [0, [12, 30, 25]],
  [0.25, [81, 18, 124]],
  [0.5, [183, 55, 121]],
  [0.75, [251, 135, 97]],
  [1, [252, 253, 191]],
];

const xgStops = [
  [0, [22, 96, 61]],
  [0.3, [72, 135, 68]],
  [0.55, [190, 169, 67]],
  [0.8, [240, 126, 58]],
  [1, [255, 244, 174]],
];

function formatNumber(value, digits = 2) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function interpolateColor(value, scaleMaximum, stops = psxgStops) {
  const normalized = Math.max(0, Math.min(1, value / scaleMaximum));
  for (let index = 1; index < stops.length; index += 1) {
    if (normalized > stops[index][0]) continue;
    const [leftPosition, leftColor] = stops[index - 1];
    const [rightPosition, rightColor] = stops[index];
    const ratio = (normalized - leftPosition) / (rightPosition - leftPosition);
    return leftColor.map((channel, channelIndex) =>
      Math.round(channel + (rightColor[channelIndex] - channel) * ratio));
  }
  return stops.at(-1)[1];
}

function buildFeatures(startX, startY, targetY, targetZ) {
  const depth = (100 - startX) / 25;
  const startLateral = (startY - 50) / 50;
  const targetLateral = (targetY - 50) / 10;
  const targetHeight = targetZ / GOAL_TOP;
  const insideGoal = Number(
    targetY >= GOAL_LEFT && targetY <= GOAL_RIGHT && targetZ <= GOAL_TOP,
  );
  return [
    depth,
    startLateral,
    targetLateral,
    targetHeight,
    depth ** 2,
    startLateral ** 2,
    targetLateral ** 2,
    targetLateral ** 3,
    targetLateral ** 4,
    targetHeight ** 2,
    targetHeight ** 3,
    targetHeight ** 4,
    depth * targetLateral,
    startLateral * targetLateral,
    depth * targetHeight,
    startLateral * targetHeight,
    depth * targetLateral ** 2,
    startLateral * targetLateral ** 2,
    depth * targetHeight ** 2,
    startLateral * targetHeight ** 2,
    targetLateral * targetHeight,
    targetLateral ** 2 * targetHeight,
    targetLateral * targetHeight ** 2,
    insideGoal,
  ];
}

function predictPsxg(startX, startY, targetY, targetZ) {
  const features = buildFeatures(startX, startY, targetY, targetZ);
  const { mean, scale, coefficients, intercept } = state.model;
  let score = intercept;
  for (let index = 0; index < features.length; index += 1) {
    score += ((features[index] - mean[index]) / scale[index]) * coefficients[index];
  }
  score = Math.max(-35, Math.min(35, score));
  return 1 / (1 + Math.exp(-score));
}

function xgAt(x, y) {
  if (!state.xgGrid) return null;
  const { width, height, values } = state.xgGrid;
  const gridX = Math.max(0, Math.min(width - 1, x / 100 * (width - 1)));
  const gridY = Math.max(0, Math.min(height - 1, y / 100 * (height - 1)));
  const left = Math.floor(gridX);
  const right = Math.min(width - 1, left + 1);
  const bottom = Math.floor(gridY);
  const top = Math.min(height - 1, bottom + 1);
  const xWeight = gridX - left;
  const yWeight = gridY - bottom;
  const bottomValue = values[bottom * width + left] * (1 - xWeight)
    + values[bottom * width + right] * xWeight;
  const topValue = values[top * width + left] * (1 - xWeight)
    + values[top * width + right] * xWeight;
  return bottomValue * (1 - yWeight) + topValue * yWeight;
}

function shotAngleDegrees(x, y) {
  const goalDistance = Math.max(0, (100 - x) * PITCH_LENGTH_M / 100);
  const lateralDistance = (y - 50) * PITCH_WIDTH_M / 100;
  const leftPost = Math.atan2(-GOAL_WIDTH_M / 2 - lateralDistance, goalDistance);
  const rightPost = Math.atan2(GOAL_WIDTH_M / 2 - lateralDistance, goalDistance);
  let angle = Math.abs(rightPost - leftPost);
  if (angle > Math.PI) angle = 2 * Math.PI - angle;
  return angle * 180 / Math.PI;
}

function probabilityLogit(value) {
  const probability = Math.max(1e-6, Math.min(1 - 1e-6, value));
  return Math.log(probability / (1 - probability));
}

function calibrateProbability(psxg, xg, angleDegrees) {
  const features = [probabilityLogit(psxg), probabilityLogit(xg), angleDegrees / 180];
  const { mean, scale, coefficients, intercept } = state.calibrator;
  let score = intercept;
  for (let index = 0; index < features.length; index += 1) {
    score += ((features[index] - mean[index]) / scale[index]) * coefficients[index];
  }
  score = Math.max(-35, Math.min(35, score));
  return 1 / (1 + Math.exp(-score));
}

function displayedPsxg(psxg, xg, angleDegrees) {
  return state.calibratePsxg
    ? calibrateProbability(psxg, xg, angleDegrees)
    : psxg;
}

function buildXgLayer() {
  const { width, height, values } = state.xgGrid;
  const maximum = values.reduce((current, value) => Math.max(current, value), 0) || 1;
  const layer = document.createElement("canvas");
  layer.width = width;
  layer.height = height;
  const context = layer.getContext("2d");
  const image = context.createImageData(width, height);
  for (let row = 0; row < height; row += 1) {
    const sourceRow = height - 1 - row;
    for (let column = 0; column < width; column += 1) {
      const value = values[sourceRow * width + column];
      const displayStrength = Math.pow(value / maximum, 0.52);
      const color = interpolateColor(displayStrength, 1, xgStops);
      const offset = (row * width + column) * 4;
      image.data[offset] = color[0];
      image.data[offset + 1] = color[1];
      image.data[offset + 2] = color[2];
      image.data[offset + 3] = value > 0
        ? Math.round(42 + 150 * displayStrength)
        : 0;
    }
  }
  context.putImageData(image, 0, 0);
  state.xgLayer = layer;
  state.xgMaximum = maximum;
  xgScaleMaxElement.textContent = formatNumber(maximum, 3);
}

function shotIsVisible(shot) {
  const seasonMatches = state.selectedSeason === "all" || shot[0] === state.selectedSeason;
  const outcomeMatches = (state.selectedOutcome === "all" && shot[5] !== 4)
    || (state.selectedOutcome === "saved" && shot[5] === 0)
    || (state.selectedOutcome === "goal" && shot[5] === 1)
    || (state.selectedOutcome === "missed" && shot[5] === 2)
    || (state.selectedOutcome === "post" && shot[5] === 3)
    || (state.selectedOutcome === "blocked" && shot[5] === 4);
  return seasonMatches && outcomeMatches;
}

function goalTargetToCanvas(targetY, targetZ) {
  const horizontalMeters = (50 - targetY) * GOAL_WIDTH_M / (GOAL_RIGHT - GOAL_LEFT);
  const heightMeters = targetZ * GOAL_HEIGHT_M / GOAL_TOP;
  return [
    (horizontalMeters - VIEW_X_MIN) / (VIEW_X_MAX - VIEW_X_MIN) * goalCanvas.width,
    goalCanvas.height - heightMeters / VIEW_Z_MAX * goalCanvas.height,
  ];
}

function rebuildShotLayers() {
  state.fieldShotLayer = null;
  state.goalShotLayer = null;
  if (state.selectedOutcome === "none" || !state.xgGrid) {
    shotsCountElement.textContent = "0";
    return;
  }

  const visibleShots = state.shots.filter(shotIsVisible);
  const fieldLayer = document.createElement("canvas");
  const goalLayer = document.createElement("canvas");
  fieldLayer.width = fieldCanvas.width;
  fieldLayer.height = fieldCanvas.height;
  goalLayer.width = goalCanvas.width;
  goalLayer.height = goalCanvas.height;
  const fieldLayerContext = fieldLayer.getContext("2d");
  const goalLayerContext = goalLayer.getContext("2d");
  const styles = [
    [0, "rgba(224, 244, 235, 0.34)"],
    [4, "rgba(91, 173, 255, 0.46)"],
    [2, "rgba(255, 139, 105, 0.48)"],
    [3, "rgba(255, 213, 92, 0.64)"],
    [1, "rgba(186, 243, 109, 0.72)"],
  ];

  for (const [outcome, color] of styles) {
    fieldLayerContext.beginPath();
    goalLayerContext.beginPath();
    for (const shot of visibleShots) {
      if (shot[5] !== outcome) continue;
      const xg = xgAt(shot[1], shot[2]) || 0;
      const radius = Math.max(1.2, 8 * Math.sqrt(xg / state.xgMaximum));
      if (shot[1] >= FIELD_X_MIN) {
        const [fieldX, fieldY] = fieldPointToCanvas(shot[1], shot[2]);
        fieldLayerContext.moveTo(fieldX + radius, fieldY);
        fieldLayerContext.arc(fieldX, fieldY, radius, 0, Math.PI * 2);
      }
      if (Number.isFinite(shot[3]) && Number.isFinite(shot[4])) {
        const [goalX, goalY] = goalTargetToCanvas(shot[3], shot[4]);
        if (goalX >= -radius && goalX <= goalCanvas.width + radius
            && goalY >= -radius && goalY <= goalCanvas.height + radius) {
          goalLayerContext.moveTo(goalX + radius, goalY);
          goalLayerContext.arc(goalX, goalY, radius, 0, Math.PI * 2);
        }
      }
    }
    fieldLayerContext.fillStyle = color;
    fieldLayerContext.fill();
    goalLayerContext.fillStyle = color;
    goalLayerContext.fill();
  }

  state.fieldShotLayer = fieldLayer;
  state.goalShotLayer = goalLayer;
  shotsCountElement.textContent = visibleShots.length.toLocaleString("pt-BR");
}

function drawXgOverlay() {
  if (!state.xgLayer) return;
  fieldContext.save();
  fieldContext.imageSmoothingEnabled = true;
  fieldContext.imageSmoothingQuality = "high";
  fieldContext.filter = "saturate(1.12)";
  const sourceX = state.xgLayer.width * FIELD_X_MIN / 100;
  fieldContext.drawImage(
    state.xgLayer,
    sourceX,
    0,
    state.xgLayer.width - sourceX,
    state.xgLayer.height,
    0,
    0,
    fieldCanvas.width,
    fieldCanvas.height,
  );
  fieldContext.filter = "none";
  fieldContext.globalCompositeOperation = "soft-light";
  const sheen = fieldContext.createLinearGradient(0, 0, fieldCanvas.width, fieldCanvas.height);
  sheen.addColorStop(0, "rgba(255,255,255,0.16)");
  sheen.addColorStop(0.42, "rgba(255,255,255,0.025)");
  sheen.addColorStop(1, "rgba(6,20,14,0.18)");
  fieldContext.fillStyle = sheen;
  fieldContext.fillRect(0, 0, fieldCanvas.width, fieldCanvas.height);
  fieldContext.restore();
}

function fieldPointToCanvas(x, y) {
  return [
    (x - FIELD_X_MIN) / (100 - FIELD_X_MIN) * fieldCanvas.width,
    (100 - y) / 100 * fieldCanvas.height,
  ];
}

function drawField() {
  const context = fieldContext;
  const width = fieldCanvas.width;
  const height = fieldCanvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#17603f";
  context.fillRect(0, 0, width, height);

  for (let stripe = 0; stripe < 10; stripe += 1) {
    context.fillStyle = stripe % 2 === 0 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.03)";
    context.fillRect(stripe * width / 10, 0, width / 10, height);
  }
  drawXgOverlay();

  const line = (fromX, fromY, toX, toY) => {
    const [x1, y1] = fieldPointToCanvas(fromX, fromY);
    const [x2, y2] = fieldPointToCanvas(toX, toY);
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
  };
  const rectangle = (x1, y1, x2, y2) => {
    const [left, top] = fieldPointToCanvas(x1, y2);
    const [right, bottom] = fieldPointToCanvas(x2, y1);
    context.rect(left, top, right - left, bottom - top);
  };

  context.beginPath();
  context.strokeStyle = "rgba(238, 250, 242, 0.92)";
  context.lineWidth = 3;
  rectangle(FIELD_X_MIN, 0.9, 99.4, 99.1);
  line(50, 0.9, 50, 99.1);
  rectangle(84.29, 20.35, 99.4, 79.65);
  rectangle(94.76, 36.53, 99.4, 63.47);
  context.stroke();

  const [centerX, centerY] = fieldPointToCanvas(50, 50);
  context.beginPath();
  context.ellipse(
    centerX,
    centerY,
    9.15 / (105 / 2) * width,
    9.15 / 68 * height,
    0,
    0,
    Math.PI * 2,
  );
  context.stroke();

  const [spotX, spotY] = fieldPointToCanvas(100 - 11 / 105 * 100, 50);
  context.beginPath();
  context.fillStyle = "#eefaf2";
  context.arc(spotX, spotY, 4, 0, Math.PI * 2);
  context.fill();

  if (state.fieldShotLayer) context.drawImage(state.fieldShotLayer, 0, 0);

  const [originX, originY] = fieldPointToCanvas(state.originX, state.originY);
  const [goalX, goalY] = fieldPointToCanvas(100, 50);
  context.beginPath();
  context.strokeStyle = "rgba(186, 243, 109, 0.55)";
  context.lineWidth = 2;
  context.setLineDash([8, 9]);
  context.moveTo(originX, originY);
  context.lineTo(goalX, goalY);
  context.stroke();
  context.setLineDash([]);

  context.beginPath();
  context.fillStyle = "#08120f";
  context.strokeStyle = "#baf36d";
  context.lineWidth = 5;
  context.arc(originX, originY, 11, 0, Math.PI * 2);
  context.fill();
  context.stroke();
}

function rawTargetFromGoalCanvas(pixelX, pixelY) {
  const horizontalMeters = VIEW_X_MIN
    + pixelX / goalCanvas.width * (VIEW_X_MAX - VIEW_X_MIN);
  const heightMeters = (1 - pixelY / goalCanvas.height) * VIEW_Z_MAX;
  return {
    targetY: 50 - horizontalMeters / (GOAL_WIDTH_M / (GOAL_RIGHT - GOAL_LEFT)),
    targetZ: heightMeters / (GOAL_HEIGHT_M / GOAL_TOP),
    horizontalMeters,
    heightMeters,
  };
}

function drawGoalFrame() {
  const meterToX = (value) =>
    (value - VIEW_X_MIN) / (VIEW_X_MAX - VIEW_X_MIN) * goalCanvas.width;
  const meterToY = (value) => goalCanvas.height - value / VIEW_Z_MAX * goalCanvas.height;
  const left = meterToX(-GOAL_WIDTH_M / 2);
  const right = meterToX(GOAL_WIDTH_M / 2);
  const top = meterToY(GOAL_HEIGHT_M);
  const bottom = meterToY(0);

  const strokeFrame = (color, width) => {
    goalContext.beginPath();
    goalContext.strokeStyle = color;
    goalContext.lineWidth = width;
    goalContext.moveTo(left, bottom);
    goalContext.lineTo(left, top);
    goalContext.lineTo(right, top);
    goalContext.lineTo(right, bottom);
    goalContext.stroke();
  };
  strokeFrame("rgba(3, 15, 11, 0.9)", 11);
  strokeFrame("#f8fbf9", 6);
}

function drawGoalHeatmap() {
  if (!state.model) return;
  if (state.selectedOutcome !== "none") {
    goalContext.clearRect(0, 0, goalCanvas.width, goalCanvas.height);
    if (state.goalShotLayer) goalContext.drawImage(state.goalShotLayer, 0, 0);
    drawGoalFrame();
    maxPsxgElement.textContent = "—";
    return;
  }
  const heatmap = document.createElement("canvas");
  heatmap.width = HEATMAP_SIZE;
  heatmap.height = HEATMAP_SIZE;
  const heatmapContext = heatmap.getContext("2d");
  const image = heatmapContext.createImageData(HEATMAP_SIZE, HEATMAP_SIZE);
  const probabilities = new Float32Array(HEATMAP_SIZE * HEATMAP_SIZE);
  const insideGoalMask = new Uint8Array(HEATMAP_SIZE * HEATMAP_SIZE);
  const currentXg = xgAt(state.originX, state.originY);
  const currentAngle = shotAngleDegrees(state.originX, state.originY);
  let maximum = 0;

  for (let row = 0; row < HEATMAP_SIZE; row += 1) {
    for (let column = 0; column < HEATMAP_SIZE; column += 1) {
      const canvasX = (column + 0.5) / HEATMAP_SIZE * goalCanvas.width;
      const canvasY = (row + 0.5) / HEATMAP_SIZE * goalCanvas.height;
      const { targetY, targetZ } = rawTargetFromGoalCanvas(canvasX, canvasY);
      const insideGoal = targetY >= GOAL_LEFT && targetY <= GOAL_RIGHT && targetZ <= GOAL_TOP;
      const psxg = insideGoal
        ? predictPsxg(state.originX, state.originY, targetY, targetZ)
        : 0;
      const probability = insideGoal
        ? displayedPsxg(psxg, currentXg, currentAngle)
        : 0;
      const index = row * HEATMAP_SIZE + column;
      probabilities[index] = probability;
      insideGoalMask[index] = Number(insideGoal);
      maximum = Math.max(maximum, probability);
    }
  }

  const colorScaleMaximum = 1;
  for (let row = 0; row < HEATMAP_SIZE; row += 1) {
    for (let column = 0; column < HEATMAP_SIZE; column += 1) {
      const index = row * HEATMAP_SIZE + column;
      const probability = probabilities[index];
      const color = interpolateColor(probability, colorScaleMaximum);
      const offset = index * 4;
      image.data[offset] = color[0];
      image.data[offset + 1] = color[1];
      image.data[offset + 2] = color[2];
      image.data[offset + 3] = insideGoalMask[index] ? 255 : 0;
    }
  }

  heatmapContext.putImageData(image, 0, 0);
  goalContext.clearRect(0, 0, goalCanvas.width, goalCanvas.height);
  goalContext.imageSmoothingEnabled = false;
  goalContext.drawImage(heatmap, 0, 0, goalCanvas.width, goalCanvas.height);
  if (state.goalShotLayer) goalContext.drawImage(state.goalShotLayer, 0, 0);
  drawGoalFrame();
  maxPsxgElement.textContent = formatNumber(maximum, 3);
}

function updateOrigin(x, y) {
  state.originX = Math.max(FIELD_X_MIN, Math.min(100, x));
  state.originY = Math.max(0, Math.min(100, y));
  originXElement.textContent = formatNumber(state.originX);
  originYElement.textContent = formatNumber(state.originY);
  const currentXg = xgAt(state.originX, state.originY);
  xgValueElement.textContent = currentXg === null ? "—" : formatNumber(currentXg, 3);
  drawField();
  drawGoalHeatmap();
}

fieldCanvas.addEventListener("pointermove", (event) => {
  const bounds = fieldCanvas.getBoundingClientRect();
  const x = FIELD_X_MIN
    + (event.clientX - bounds.left) / bounds.width * (100 - FIELD_X_MIN);
  const y = 100 - (event.clientY - bounds.top) / bounds.height * 100;
  if (state.animationFrame !== null) cancelAnimationFrame(state.animationFrame);
  state.animationFrame = requestAnimationFrame(() => {
    updateOrigin(x, y);
    state.animationFrame = null;
  });
});

goalCanvas.addEventListener("pointermove", (event) => {
  if (!state.model) return;
  if (state.selectedOutcome !== "none") return;
  const bounds = goalCanvas.getBoundingClientRect();
  const pixelX = (event.clientX - bounds.left) / bounds.width * goalCanvas.width;
  const pixelY = (event.clientY - bounds.top) / bounds.height * goalCanvas.height;
  const target = rawTargetFromGoalCanvas(pixelX, pixelY);
  const insideGoal = target.targetY >= GOAL_LEFT
    && target.targetY <= GOAL_RIGHT
    && target.targetZ <= GOAL_TOP;
  const psxg = insideGoal
    ? predictPsxg(state.originX, state.originY, target.targetY, target.targetZ)
    : 0;
  const probability = insideGoal
    ? displayedPsxg(
      psxg,
      xgAt(state.originX, state.originY),
      shotAngleDegrees(state.originX, state.originY),
    )
    : 0;
  const probabilityLabel = state.calibratePsxg ? "PSxG calibrado" : "PSxG";
  goalReadoutElement.textContent = `Destino ${formatNumber(target.horizontalMeters)} m × ${formatNumber(target.heightMeters)} m · ${probabilityLabel} ${formatNumber(probability, 3)}`;
});

goalCanvas.addEventListener("pointerleave", () => {
  if (state.selectedOutcome === "none") {
    goalReadoutElement.textContent = "Passe o mouse no gol para consultar uma célula.";
  }
});

xgAdjustmentElement.addEventListener("change", () => {
  state.calibratePsxg = xgAdjustmentElement.checked;
  calibrationExplanationElement.hidden = !state.calibratePsxg;
  maxPsxgLabelElement.textContent = state.calibratePsxg
    ? "Maior PSxG calibrado"
    : "Maior PSxG";
  goalReadoutElement.textContent = state.calibratePsxg
    ? "Calibração ativa: PSxG + xG + ângulo. Passe o mouse no gol para consultar uma célula."
    : "Passe o mouse no gol para consultar uma célula.";
  drawGoalHeatmap();
});

function syncPsxgVisibility() {
  const showingObservedShots = state.selectedOutcome !== "none";
  if (showingObservedShots) {
    state.calibratePsxg = false;
    xgAdjustmentElement.checked = false;
  }
  xgAdjustmentElement.disabled = showingObservedShots;
  calibrationExplanationElement.hidden = true;
  goalLegendElement.hidden = showingObservedShots;
  goalReadoutElement.hidden = showingObservedShots;
  maxPsxgLabelElement.textContent = showingObservedShots ? "PSxG oculto" : "Maior PSxG";
}

function selectFilter(buttons, selectedButton, key, value) {
  for (const button of buttons) {
    button.setAttribute("aria-pressed", String(button === selectedButton));
  }
  state[key] = value;
  syncPsxgVisibility();
  rebuildShotLayers();
  drawField();
  drawGoalHeatmap();
}

for (const button of seasonButtons) {
  button.addEventListener("click", () => {
    const season = button.dataset.season === "all" ? "all" : Number(button.dataset.season);
    selectFilter(seasonButtons, button, "selectedSeason", season);
  });
}

for (const button of outcomeButtons) {
  button.addEventListener("click", () => {
    selectFilter(outcomeButtons, button, "selectedOutcome", button.dataset.outcome);
  });
}

async function loadAssets() {
  drawField();
  try {
    const [modelResponse, calibratorResponse, xgResponse, shotsResponse] = await Promise.all([
      fetch(MODEL_URL),
      fetch(CALIBRATOR_URL),
      fetch(XG_GRID_URL),
      fetch(SHOTS_URL),
    ]);
    if (!modelResponse.ok) throw new Error(`Modelo PSxG: HTTP ${modelResponse.status}`);
    if (!calibratorResponse.ok) {
      throw new Error(`Calibrador: HTTP ${calibratorResponse.status}`);
    }
    if (!xgResponse.ok) throw new Error(`Grade xG: HTTP ${xgResponse.status}`);
    if (!shotsResponse.ok) throw new Error(`Finalizações: HTTP ${shotsResponse.status}`);
    state.model = await modelResponse.json();
    state.calibrator = await calibratorResponse.json();
    state.xgGrid = await xgResponse.json();
    const shotsPayload = await shotsResponse.json();
    state.shots = shotsPayload.shots;
    if (state.model.coefficients.length !== 24) {
      throw new Error("Quantidade inesperada de coeficientes");
    }
    if (state.xgGrid.values.length !== state.xgGrid.width * state.xgGrid.height) {
      throw new Error("Dimensões inesperadas na grade xG");
    }
    if (state.calibrator.coefficients.length !== 3) {
      throw new Error("Quantidade inesperada de coeficientes do calibrador");
    }
    if (!Array.isArray(state.shots)) {
      throw new Error("Formato inesperado das finalizações");
    }
    buildXgLayer();
    rebuildShotLayers();
    xgAdjustmentElement.disabled = false;
    for (const button of [...seasonButtons, ...outcomeButtons]) button.disabled = false;
    statusElement.textContent = "Modelos carregados";
    statusElement.classList.add("ready");
    updateOrigin(state.originX, state.originY);
  } catch (error) {
    statusElement.textContent = "Falha ao carregar modelos";
    statusElement.classList.add("error");
    goalReadoutElement.textContent = "Abra esta página por um servidor HTTP na raiz do projeto.";
    console.error(error);
  }
}

loadAssets();
