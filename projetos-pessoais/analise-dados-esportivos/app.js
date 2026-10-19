import {
  buildPassNetwork,
  eventOutcome,
  eventType,
  filterEvents,
  normalizeMatch,
  orientEvent,
  summarizeEvents,
} from "./analysis.mjs";

const DATA_URL = "data/Bahia-Gremio-Whoscored.json";
const SVG_NS = "http://www.w3.org/2000/svg";
const FIELD = { left: 50, top: 40, width: 950, height: 600 };
const TEAM_COLORS = ["#ff665c", "#62a8ff"];
const EVENT_COLORS = [
  "#baf36d", "#ff8c68", "#6ec5ff", "#f5ca5c", "#df78ff", "#70e0c1",
  "#ff769f", "#a5a8ff", "#dbed72", "#f39fd2", "#83d28d", "#f4a261",
];

const elements = {
  status: document.querySelector("#status"),
  minuteStart: document.querySelector("#minute-start"),
  minuteEnd: document.querySelector("#minute-end"),
  minuteRange: document.querySelector("#minute-range"),
  minuteSelection: document.querySelector(".range-selection"),
  minuteStartValue: document.querySelector("#minute-start-value"),
  minuteEndValue: document.querySelector("#minute-end-value"),
  touchFilter: document.querySelector("#touch-filter"),
  teamFilter: document.querySelector("#team-filter"),
  eventTypeOptions: document.querySelector("#event-type-options"),
  eventFilterSummary: document.querySelector("#event-filter-summary"),
  selectAllEvents: document.querySelector("#select-all-events"),
  clearEvents: document.querySelector("#clear-events"),
  resetFilters: document.querySelector("#reset-filters"),
  matchName: document.querySelector("#match-name"),
  eventCount: document.querySelector("#event-count"),
  passCount: document.querySelector("#pass-count"),
  playerCount: document.querySelector("#player-count"),
  teamLegend: document.querySelector("#team-legend"),
  eventsPitch: document.querySelector("#events-pitch"),
  networkGrid: document.querySelector("#network-grid"),
  tooltip: document.querySelector("#tooltip"),
};

const state = { match: null, eventTypes: [], eventColors: new Map() };

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function fieldPoint(x, y) {
  return [FIELD.left + x / 100 * FIELD.width, FIELD.top + y / 100 * FIELD.height];
}

function drawPitch(svg, suffix) {
  const defs = svgElement("defs");
  const marker = svgElement("marker", {
    id: `arrow-${suffix}`, viewBox: "0 0 10 10", refX: "8", refY: "5",
    markerWidth: "5", markerHeight: "5", orient: "auto-start-reverse",
  });
  marker.append(svgElement("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "context-stroke" }));
  defs.append(marker);
  svg.append(defs);

  const markings = svgElement("g", { class: "pitch-markings" });
  markings.append(svgElement("rect", { x: FIELD.left, y: FIELD.top, width: FIELD.width, height: FIELD.height, rx: "3" }));
  markings.append(svgElement("line", { x1: "525", y1: FIELD.top, x2: "525", y2: FIELD.top + FIELD.height }));
  markings.append(svgElement("circle", { cx: "525", cy: "340", r: "88" }));
  markings.append(svgElement("circle", { cx: "525", cy: "340", r: "4", class: "pitch-solid" }));
  markings.append(svgElement("rect", { x: FIELD.left, y: "165", width: "158", height: "350" }));
  markings.append(svgElement("rect", { x: "842", y: "165", width: "158", height: "350" }));
  markings.append(svgElement("rect", { x: FIELD.left, y: "245", width: "55", height: "190" }));
  markings.append(svgElement("rect", { x: "945", y: "245", width: "55", height: "190" }));
  markings.append(svgElement("circle", { cx: "153", cy: "340", r: "4", class: "pitch-solid" }));
  markings.append(svgElement("circle", { cx: "897", cy: "340", r: "4", class: "pitch-solid" }));
  svg.append(markings);
}

function filtersFromControls() {
  const selectedTypes = [...elements.eventTypeOptions.querySelectorAll("input:checked")]
    .map((input) => input.value);
  const teamValue = elements.teamFilter.value;
  const touchValue = elements.touchFilter.value;
  return {
    minuteStart: Number(elements.minuteStart.value),
    minuteEnd: Number(elements.minuteEnd.value),
    eventTypes: selectedTypes.length === state.eventTypes.length ? null : selectedTypes,
    teamId: teamValue === "all" ? null : Number(teamValue),
    touch: touchValue === "all" ? null : touchValue === "true",
  };
}

function showTooltip(event, matchEvent) {
  const player = state.match.players[String(matchEvent.playerId)] ?? "Sem jogador";
  const team = Number(matchEvent.teamId) === state.match.home.id ? state.match.home.name : state.match.away.name;
  elements.tooltip.innerHTML = `<strong>${eventType(matchEvent)}</strong><span>${player} · ${team}</span><span>${matchEvent.minute}'${String(matchEvent.second ?? 0).padStart(2, "0")}</span>`;
  elements.tooltip.hidden = false;
  const bounds = event.currentTarget.ownerSVGElement.getBoundingClientRect();
  elements.tooltip.style.left = `${event.clientX - bounds.left + 14}px`;
  elements.tooltip.style.top = `${event.clientY - bounds.top + 14}px`;
}

function hideTooltip() {
  elements.tooltip.hidden = true;
}

function renderEvents(events) {
  elements.eventsPitch.replaceChildren();
  drawPitch(elements.eventsPitch, "events");

  const passLayer = svgElement("g", { class: "pass-layer" });
  const eventLayer = svgElement("g", { class: "event-layer" });
  const labelLayer = svgElement("g", { class: "event-label-layer" });

  for (const event of events) {
    const position = orientEvent(event, state.match.home.id);
    if (position.x === null || position.y === null) continue;
    const [x, y] = fieldPoint(position.x, position.y);
    const teamIndex = Number(event.teamId) === state.match.home.id ? 0 : 1;

    if (eventType(event) === "Pass" && position.endX !== null && position.endY !== null) {
      const [endX, endY] = fieldPoint(position.endX, position.endY);
      passLayer.append(svgElement("line", {
        x1: x, y1: y, x2: endX, y2: endY,
        stroke: TEAM_COLORS[teamIndex],
        "stroke-opacity": eventOutcome(event) === 1 ? "0.48" : "0.2",
        "stroke-width": eventOutcome(event) === 1 ? "1.4" : "1",
        "stroke-dasharray": eventOutcome(event) === 1 ? "" : "4 4",
        "marker-end": "url(#arrow-events)",
      }));
    }

    const point = svgElement("circle", {
      cx: x, cy: y, r: eventType(event) === "Goal" ? "5.5" : "3",
      fill: state.eventColors.get(eventType(event)),
      stroke: TEAM_COLORS[teamIndex], "stroke-width": "1.2", tabindex: "0",
    });
    point.addEventListener("pointerenter", (pointerEvent) => showTooltip(pointerEvent, event));
    point.addEventListener("pointermove", (pointerEvent) => showTooltip(pointerEvent, event));
    point.addEventListener("pointerleave", hideTooltip);
    point.addEventListener("focus", (focusEvent) => showTooltip(focusEvent, event));
    point.addEventListener("blur", hideTooltip);
    eventLayer.append(point);

    const label = svgElement("text", { x: x + 5, y: y - 5, fill: TEAM_COLORS[teamIndex] });
    label.textContent = eventType(event);
    labelLayer.append(label);
  }

  elements.eventsPitch.append(passLayer, eventLayer, labelLayer);
}

function interpolateEdgeColor(ratio) {
  const start = [45, 109, 142];
  const end = [186, 243, 109];
  return `rgb(${start.map((value, index) => Math.round(value + (end[index] - value) * ratio)).join(",")})`;
}

function renderNetwork(team, network, teamIndex) {
  const panel = document.createElement("article");
  panel.className = "network-panel";
  const heading = document.createElement("div");
  heading.className = "network-title";
  heading.innerHTML = `<span class="team-dot" style="--team-color:${TEAM_COLORS[teamIndex]}"></span><h3>${team.name}</h3><strong>${network.edges.reduce((total, edge) => total + edge.count, 0)} passes</strong>`;
  const svg = svgElement("svg", { class: "pitch network-pitch", viewBox: "0 0 1050 680", role: "img", "aria-label": `Rede de passes de ${team.name}` });
  drawPitch(svg, `network-${team.id}`);

  const nodeMap = new Map(network.nodes.map((node) => [node.id, node]));
  const maximumEdge = Math.max(1, ...network.edges.map((edge) => edge.count));
  const maximumInvolvement = Math.max(1, ...network.nodes.map((node) => node.involvement));
  const edgeLayer = svgElement("g", { class: "network-edges" });
  const nodeLayer = svgElement("g", { class: "network-nodes" });

  for (const edge of network.edges.sort((left, right) => left.count - right.count)) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) continue;
    const [x1, y1] = fieldPoint(source.x, source.y);
    const [x2, y2] = fieldPoint(target.x, target.y);
    const ratio = edge.count / maximumEdge;
    edgeLayer.append(svgElement("line", {
      x1, y1, x2, y2,
      stroke: interpolateEdgeColor(ratio),
      "stroke-width": String(1 + ratio * 8),
      "stroke-opacity": String(0.18 + ratio * 0.72),
      "stroke-linecap": "round",
      "marker-end": `url(#arrow-network-${team.id})`,
    }));
  }

  for (const node of network.nodes) {
    const [x, y] = fieldPoint(node.x, node.y);
    const radius = 5 + Math.sqrt(node.involvement / maximumInvolvement) * 15;
    const group = svgElement("g");
    const circle = svgElement("circle", { cx: x, cy: y, r: radius, fill: TEAM_COLORS[teamIndex], class: "network-node" });
    const label = svgElement("text", { x, y: y - radius - 7, class: "player-label", "text-anchor": "middle" });
    label.textContent = node.name;
    const value = svgElement("text", { x, y: y + 4, class: "node-value", "text-anchor": "middle" });
    value.textContent = node.involvement;
    group.append(circle, label, value);
    nodeLayer.append(group);
  }

  svg.append(edgeLayer, nodeLayer);
  panel.append(heading, svg);
  return panel;
}

function renderNetworks(events) {
  elements.networkGrid.replaceChildren();
  for (const [team, index] of [[state.match.home, 0], [state.match.away, 1]]) {
    const network = buildPassNetwork(events, team.id, state.match.players);
    elements.networkGrid.append(renderNetwork(team, network, index));
  }
}

function updateEventSummary(selectedCount) {
  elements.eventFilterSummary.textContent = selectedCount === state.eventTypes.length
    ? "Todos"
    : `${selectedCount} selecionado${selectedCount === 1 ? "" : "s"}`;
}

function syncMinuteRange(minuteStart, minuteEnd) {
  const minimum = Number(elements.minuteStart.min);
  const maximum = Number(elements.minuteStart.max);
  const span = maximum - minimum || 1;
  const startPosition = (minuteStart - minimum) / span * 100;
  const endPosition = (minuteEnd - minimum) / span * 100;
  elements.minuteRange.style.setProperty("--range-start", `${startPosition}%`);
  elements.minuteRange.style.setProperty("--range-end", `${endPosition}%`);
  elements.minuteStart.style.zIndex = minuteStart >= minuteEnd - 4 ? "4" : "3";
}

function render() {
  if (!state.match) return;
  const minuteStart = Number(elements.minuteStart.value);
  const minuteEnd = Number(elements.minuteEnd.value);
  elements.minuteStartValue.textContent = `${minuteStart}'`;
  elements.minuteEndValue.textContent = `${minuteEnd}'`;
  syncMinuteRange(minuteStart, minuteEnd);

  const filters = filtersFromControls();
  filters.minuteStart = minuteStart;
  filters.minuteEnd = minuteEnd;
  const events = filterEvents(state.match.events, filters);
  const summary = summarizeEvents(events);
  elements.eventCount.textContent = summary.events.toLocaleString("pt-BR");
  elements.passCount.textContent = summary.successfulPasses.toLocaleString("pt-BR");
  elements.playerCount.textContent = summary.players.toLocaleString("pt-BR");
  updateEventSummary([...elements.eventTypeOptions.querySelectorAll("input:checked")].length);
  renderEvents(events);
  renderNetworks(events);
}

function buildControls() {
  elements.matchName.textContent = `${state.match.home.name} × ${state.match.away.name}`;
  for (const team of [state.match.home, state.match.away]) {
    const option = document.createElement("option");
    option.value = team.id;
    option.textContent = team.name;
    elements.teamFilter.append(option);
  }

  elements.teamLegend.innerHTML = [state.match.home, state.match.away]
    .map((team, index) => `<span><i style="--team-color:${TEAM_COLORS[index]}"></i>${team.name}</span>`)
    .join("");

  state.eventTypes = [...new Set(state.match.events.map(eventType))].sort((left, right) => left.localeCompare(right, "pt-BR"));
  state.eventColors = new Map(state.eventTypes.map((type, index) => [type, EVENT_COLORS[index % EVENT_COLORS.length]]));
  for (const type of state.eventTypes) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = type;
    input.checked = true;
    label.append(input, document.createTextNode(type));
    elements.eventTypeOptions.append(label);
  }
}

function setAllEventTypes(checked) {
  for (const input of elements.eventTypeOptions.querySelectorAll("input")) input.checked = checked;
  render();
}

function resetFilters() {
  elements.minuteStart.value = 0;
  elements.minuteEnd.value = elements.minuteEnd.max;
  elements.touchFilter.value = "all";
  elements.teamFilter.value = "all";
  for (const input of elements.eventTypeOptions.querySelectorAll("input")) input.checked = true;
  render();
}

let minuteRangeDrag = null;

elements.minuteSelection.addEventListener("pointerdown", (event) => {
  const trackWidth = elements.minuteSelection.parentElement.getBoundingClientRect().width;
  if (!trackWidth) return;

  minuteRangeDrag = {
    pointerId: event.pointerId,
    pointerStart: event.clientX,
    minuteStart: Number(elements.minuteStart.value),
    minuteEnd: Number(elements.minuteEnd.value),
    trackWidth,
  };
  elements.minuteSelection.setPointerCapture(event.pointerId);
  elements.minuteRange.classList.add("is-dragging");
  event.preventDefault();
});

elements.minuteSelection.addEventListener("pointermove", (event) => {
  if (!minuteRangeDrag || event.pointerId !== minuteRangeDrag.pointerId) return;

  const minimum = Number(elements.minuteStart.min);
  const maximum = Number(elements.minuteStart.max);
  const minuteSpan = maximum - minimum;
  const pointerDelta = event.clientX - minuteRangeDrag.pointerStart;
  let minuteDelta = Math.round(pointerDelta / minuteRangeDrag.trackWidth * minuteSpan);
  minuteDelta = Math.max(minimum - minuteRangeDrag.minuteStart, minuteDelta);
  minuteDelta = Math.min(maximum - minuteRangeDrag.minuteEnd, minuteDelta);

  const nextStart = minuteRangeDrag.minuteStart + minuteDelta;
  const nextEnd = minuteRangeDrag.minuteEnd + minuteDelta;
  if (Number(elements.minuteStart.value) === nextStart && Number(elements.minuteEnd.value) === nextEnd) return;

  elements.minuteStart.value = nextStart;
  elements.minuteEnd.value = nextEnd;
  render();
});

function stopMinuteRangeDrag(event) {
  if (!minuteRangeDrag || event.pointerId !== minuteRangeDrag.pointerId) return;
  minuteRangeDrag = null;
  elements.minuteRange.classList.remove("is-dragging");
}

elements.minuteSelection.addEventListener("pointerup", stopMinuteRangeDrag);
elements.minuteSelection.addEventListener("pointercancel", stopMinuteRangeDrag);

elements.minuteStart.addEventListener("input", () => {
  if (Number(elements.minuteStart.value) > Number(elements.minuteEnd.value)) {
    elements.minuteStart.value = elements.minuteEnd.value;
  }
  render();
});
elements.minuteEnd.addEventListener("input", () => {
  if (Number(elements.minuteEnd.value) < Number(elements.minuteStart.value)) {
    elements.minuteEnd.value = elements.minuteStart.value;
  }
  render();
});
for (const control of [elements.touchFilter, elements.teamFilter]) {
  control.addEventListener("input", render);
}
elements.eventTypeOptions.addEventListener("change", render);
elements.selectAllEvents.addEventListener("click", () => setAllEventTypes(true));
elements.clearEvents.addEventListener("click", () => setAllEventTypes(false));
elements.resetFilters.addEventListener("click", resetFilters);

async function loadMatch() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`Partida: HTTP ${response.status}`);
    state.match = normalizeMatch(await response.json());
    const maximumMinute = Math.max(...state.match.events.map((event) => Number(event.minute)));
    elements.minuteStart.max = maximumMinute;
    elements.minuteEnd.max = maximumMinute;
    elements.minuteEnd.value = maximumMinute;
    buildControls();
    render();
    elements.status.textContent = "Partida carregada";
    elements.status.classList.add("ready");
  } catch (error) {
    elements.status.textContent = `Falha: ${error.message}`;
    elements.status.classList.add("error");
    console.error(error);
  }
}

loadMatch();
