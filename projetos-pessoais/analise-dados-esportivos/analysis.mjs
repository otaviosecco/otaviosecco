function eventType(event) {
  return event.type?.displayName ?? event.type ?? "Desconhecido";
}

function eventOutcome(event) {
  return Number(event.outcomeType?.value ?? event.outcomeType);
}

function isFiniteCoordinate(value) {
  return Number.isFinite(Number(value));
}

export function normalizeMatch(payload) {
  const data = payload.matchCentreData;
  if (!data?.events || !data.home || !data.away) {
    throw new Error("Formato de partida inesperado");
  }

  return {
    id: payload.matchId,
    home: { id: Number(data.home.teamId), name: data.home.name },
    away: { id: Number(data.away.teamId), name: data.away.name },
    players: data.playerIdNameDictionary ?? {},
    events: data.events,
  };
}

export function filterEvents(events, filters) {
  const selectedTypes = filters.eventTypes === null
    ? null
    : new Set(filters.eventTypes ?? []);
  return events.filter((event) => {
    const minute = Number(event.minute);
    if (minute < filters.minuteStart || minute > filters.minuteEnd) return false;
    if (selectedTypes !== null && !selectedTypes.has(eventType(event))) return false;
    if (filters.teamId !== null && Number(event.teamId) !== filters.teamId) return false;
    if (filters.touch !== null && Boolean(event.isTouch) !== filters.touch) return false;
    return true;
  });
}

export function orientEvent(event, homeTeamId) {
  const mirrored = Number(event.teamId) !== Number(homeTeamId);
  const transform = (value) => {
    if (!isFiniteCoordinate(value)) return null;
    return mirrored ? 100 - Number(value) : Number(value);
  };

  return {
    x: transform(event.x),
    y: transform(event.y),
    endX: transform(event.endX),
    endY: transform(event.endY),
  };
}

export function inferPassReceiver(events, passIndex) {
  const pass = events[passIndex];
  if (!pass || eventType(pass) !== "Pass" || eventOutcome(pass) !== 1) return null;
  if (!Number.isFinite(Number(pass.playerId))) return null;

  for (let index = passIndex + 1; index < events.length; index += 1) {
    const candidate = events[index];
    if (eventType(candidate) === "End") return null;
    if (!candidate.isTouch || !Number.isFinite(Number(candidate.playerId))) continue;
    if (Number(candidate.teamId) !== Number(pass.teamId)) return null;
    if (Number(candidate.playerId) === Number(pass.playerId)) continue;
    return Number(candidate.playerId);
  }
  return null;
}

export function buildPassNetwork(events, teamId, playerNames = {}) {
  const positions = new Map();
  const edges = new Map();
  const involvement = new Map();

  events.forEach((event, index) => {
    if (Number(event.teamId) !== Number(teamId)) return;
    const playerId = Number(event.playerId);
    if (!Number.isFinite(playerId)) return;

    if (isFiniteCoordinate(event.x) && isFiniteCoordinate(event.y)) {
      const position = positions.get(playerId) ?? { x: 0, y: 0, samples: 0 };
      position.x += Number(event.x);
      position.y += Number(event.y);
      position.samples += 1;
      positions.set(playerId, position);
    }

    const receiverId = inferPassReceiver(events, index);
    if (receiverId === null) return;
    const key = `${playerId}:${receiverId}`;
    edges.set(key, (edges.get(key) ?? 0) + 1);
    involvement.set(playerId, (involvement.get(playerId) ?? 0) + 1);
    involvement.set(receiverId, (involvement.get(receiverId) ?? 0) + 1);
  });

  const nodes = [...positions.entries()].map(([id, position]) => ({
    id,
    name: playerNames[String(id)] ?? `Jogador ${id}`,
    x: position.x / position.samples,
    y: position.y / position.samples,
    involvement: involvement.get(id) ?? 0,
  }));
  const nodeIds = new Set(nodes.map((node) => node.id));

  return {
    nodes,
    edges: [...edges.entries()]
      .map(([key, count]) => {
        const [source, target] = key.split(":").map(Number);
        return { source, target, count };
      })
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)),
  };
}

export function summarizeEvents(events) {
  const players = new Set();
  let successfulPasses = 0;
  for (const event of events) {
    if (Number.isFinite(Number(event.playerId))) players.add(Number(event.playerId));
    if (eventType(event) === "Pass" && eventOutcome(event) === 1) successfulPasses += 1;
  }
  return { events: events.length, successfulPasses, players: players.size };
}

export { eventOutcome, eventType };
