import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPassNetwork,
  filterEvents,
  inferPassReceiver,
  orientEvent,
  summarizeEvents,
} from "./analysis.mjs";

const event = (overrides = {}) => ({
  minute: 10,
  second: 0,
  teamId: 1,
  playerId: 10,
  x: 20,
  y: 30,
  endX: 40,
  endY: 50,
  isTouch: true,
  type: { displayName: "Pass" },
  outcomeType: { value: 1 },
  ...overrides,
});

test("filters interval, type, team and touch independently", () => {
  const events = [
    event(),
    event({ minute: 20, type: { displayName: "Foul" }, isTouch: false }),
    event({ minute: 30, teamId: 2 }),
  ];
  const filtered = filterEvents(events, {
    minuteStart: 15,
    minuteEnd: 25,
    eventTypes: ["Foul"],
    teamId: 1,
    touch: false,
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].minute, 20);
});

test("null event types selects all while an empty selection selects none", () => {
  const events = [event(), event({ type: { displayName: "Foul" } })];
  const filters = { minuteStart: 0, minuteEnd: 100, teamId: null, touch: null };
  assert.equal(filterEvents(events, { ...filters, eventTypes: null }).length, 2);
  assert.equal(filterEvents(events, { ...filters, eventTypes: [] }).length, 0);
});

test("receiver skips non-touch events and requires same team", () => {
  const events = [
    event(),
    event({ type: { displayName: "Foul" }, isTouch: false, playerId: 99 }),
    event({ playerId: 11 }),
  ];
  assert.equal(inferPassReceiver(events, 0), 11);
  events[2].teamId = 2;
  assert.equal(inferPassReceiver(events, 0), null);
});

test("pass network aggregates each passing pair", () => {
  const events = [
    event({ playerId: 10, x: 10, y: 20 }),
    event({ playerId: 11, x: 30, y: 40 }),
    event({ playerId: 10, x: 20, y: 30 }),
    event({ playerId: 11, x: 40, y: 50 }),
  ];
  const network = buildPassNetwork(events, 1, { 10: "A", 11: "B" });
  assert.deepEqual(network.edges, [
    { source: 10, target: 11, count: 2 },
    { source: 11, target: 10, count: 1 },
  ]);
  assert.equal(network.nodes.find((node) => node.id === 10).x, 15);
  assert.equal(network.nodes.find((node) => node.id === 11).involvement, 3);
});

test("away events are mirrored on both axes", () => {
  assert.deepEqual(orientEvent(event({ teamId: 2 }), 1), {
    x: 80,
    y: 70,
    endX: 60,
    endY: 50,
  });
});

test("summary counts successful passes and distinct players", () => {
  const summary = summarizeEvents([
    event({ playerId: 10 }),
    event({ playerId: 11, outcomeType: { value: 0 } }),
    event({ playerId: 11, type: { displayName: "Foul" } }),
  ]);
  assert.deepEqual(summary, { events: 3, successfulPasses: 1, players: 2 });
});
