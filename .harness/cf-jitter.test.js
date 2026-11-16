// Tests the SHIPPED _placeFloatingControls (extracted from the real file, not
// a re-implementation) for the ONE failure the design is most exposed to:
// updateLights() runs it on every watched state change, and the panel's own
// HEIGHT is not a stable input -- _getLiveColors walks every entity for
// state === 'on', so a lamp turning on anywhere in the card adds a preset
// swatch and .presets-row (flex-wrap: wrap) grows a row.
//
// Before the free-axis hold, a mid-height selection on a 900x563 plan took the
// 'right' side and its --cf-y was recomputed as `my - ph / 2` every tick, so
// the panel slid 16px each time that lamp toggled, and back, forever.
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'hass-spatial-lights-card.js'), 'utf8');
const s = src.indexOf('  _placeFloatingControls() {');
if (s < 0) throw new Error('_placeFloatingControls not found in shipped source');
let e = src.indexOf("el.classList.add('auto-placed');", s);
e = src.indexOf('\r\n  }', e >= 0 ? e : s);
if (e < 0) { e = src.indexOf('\n  }', s); }
const body = src.slice(src.indexOf('{', s) + 1, e + 2);
const place = new Function('SpatialLightColorCard', 'return function () {' + body + '\n};')(
  { CF_PLACEMENT: { RING: 6, LABEL: 29, GAP: 12, EDGE: 10, SLOP: 8 } },
);
// The SHIPPED reset too: since the deselect fade it owns cancelling the
// deferred clear, which a hand-written stub would silently not do.
const cs0 = src.indexOf('  _clearAutoPlacement(el) {');
if (cs0 < 0) throw new Error('_clearAutoPlacement not found in shipped source');
const clearAuto = new Function('return function (el) {'
  + src.slice(src.indexOf('{', cs0) + 1, src.indexOf('\n  }', cs0)) + '\n};')();

let fails = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { console.log(`FAIL ${name}: got ${g} want ${w}`); fails++; }
  else console.log(`  ok  ${name}`);
};

// A card stubbed down to exactly what the method reads.
function stub(W, H, pw, ph) {
  const cls = new Set();
  const el = {
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) },
    style: {
      setProperty: (k, v) => { card.writes++; card.styles[k] = v; },
      removeProperty: (k) => { delete card.styles[k]; },
    },
    parentElement: { getBoundingClientRect: () => ({ width: W, height: H }) },
    getBoundingClientRect: () => ({ width: card.pw, height: card.ph }),
  };
  const card = {
    pw, ph, styles: {}, writes: 0, W, H,
    _cfSide: null, _cfAt: null, _cfKey: null, _cfFreeY: null,
    _els: { controlsFloating: el },
    _selectedLights: new Set(),
    _config: { positions: {}, size_overrides: {}, light_size: 40, default_entity: null },
    _loadFloatingPos: () => null,
    _applyFloatingPos() {},
    // Nothing hand-placed to retire: this suite is about the TRACKING path,
    // where the shipped predicate returns false on its first line anyway
    // (`_loadFloatingPos()` is null above). The retire itself is measured in
    // the browser, in controls-place.html#groupRetire, where a real drag can
    // stamp a real group.
    _dropStaleFloatingPos: () => false,
    // The fit runs before placement and is the one thing that changes the
    // panel's SIZE -- which this suite supplies directly (`pw`/`ph`) so it can
    // flap the height on purpose. Stubbed out for that reason, not because it
    // is uninteresting: its own convergence is measured in the browser, in
    // caps-bars.html#fitStable, where a real box can be re-measured.
    _fitFloatingControls: () => {},
    _toScreenPct: (x, y) => ({ x, y }),          // identity: rotation is covered by rot-math
    _planRotation: () => 0,
    _lightScreenRadius: () => 20,
    _clearAutoPlacement: clearAuto,
    // The opacity fade a hiding panel waits out before parking. The browser
    // reads it from computed style; here it is whatever the case sets.
    fadeMs: 200,
    _cfFadeMs() { return this.fadeMs; },
    _placeFloatingControls: place,
  };
  return card;
}
const at = (c) => c.styles['--cf-x'] + '/' + c.styles['--cf-y'];
const sel = (c, pts) => {
  c._selectedLights.clear();
  pts.forEach(([id, x, y]) => { c._config.positions[id] = { x, y }; c._selectedLights.add(id); });
};

// A lamp elsewhere toggling on and off, over and over.
const FLAP = [321, 353, 321, 353, 385, 321, 353, 321];

// --- The regression itself: the sideways placements must not re-centre. ---
for (const [name, px, py, side] of [['mid-left', 15, 50, 'right'], ['mid-right', 85, 50, 'left']]) {
  const c = stub(900, 563, 420, 321);
  sel(c, [['light.a', px, py]]);
  const seen = new Set();
  for (const ph of FLAP) { c.ph = ph; c._placeFloatingControls(); seen.add(at(c)); }
  eq(`${name} selection takes the '${side}' side`, c._cfSide, side);
  eq(`${name} holds ONE position across a flapping panel height`, seen.size, 1);
  eq(`${name} writes only the first placement`, c.writes, 2);
}

// --- 'below' was always immune; keep it that way. ---
{
  const c = stub(900, 563, 420, 321);
  sel(c, [['light.a', 15, 12]]);
  const seen = new Set();
  for (const ph of FLAP) { c.ph = ph; c._placeFloatingControls(); seen.add(at(c)); }
  eq("top selection takes 'below' and never moves", [c._cfSide, seen.size, c.writes], ['below', 1, 2]);
}

// --- 'above' anchors by top, so its --cf-y MUST move as the box grows. What
//     must not move is the edge facing the selection: the gap is the promise. ---
{
  const c = stub(900, 563, 420, 200);
  sel(c, [['light.a', 15, 88]]);
  const bottoms = new Set();
  for (const ph of [200, 300, 400]) {
    c.ph = ph; c._placeFloatingControls();
    bottoms.add(parseInt(c.styles['--cf-y'], 10) + ph);
  }
  eq("'above' keeps its gap to the selection while the box grows", [c._cfSide, bottoms.size], ['above', 1]);
}

// --- The hold must never outlive the reason for it. ---
{
  const c = stub(900, 563, 420, 321);
  sel(c, [['a', 15, 50]]); c._placeFloatingControls();
  const first = at(c);
  sel(c, [['b', 85, 12]]); c._placeFloatingControls();
  eq('a NEW selection still moves the panel', at(c) !== first, true);
  eq('and re-derives the side for it', c._cfSide, 'below');
}

// --- A held offset is still clamped: a growing box may not leave the plan. ---
{
  const c = stub(900, 563, 420, 200);
  sel(c, [['a', 15, 50]]);
  let inside = true;
  for (const ph of [200, 300, 400, 500, 520]) {
    c.ph = ph; c._placeFloatingControls();
    const y = parseInt(c.styles['--cf-y'], 10);
    if (y < 0 || y + ph > 563) inside = false;
  }
  eq('the held offset stays inside the plan as the box grows', inside, true);
}

// --- A canvas resize is a real geometry change and must re-centre. ---
{
  const c = stub(900, 563, 420, 321);
  sel(c, [['a', 15, 50]]); c._placeFloatingControls();
  const before = at(c);
  c._els.controlsFloating.parentElement.getBoundingClientRect = () => ({ width: 900, height: 800 });
  c._placeFloatingControls();
  eq('a canvas resize re-centres rather than holding a stale offset', at(c) !== before, true);
}

// --- Whole rooms selected: the panel clears the ROOM, from a box chain of
//     [room+labels, room+markers, markers+labels, markers]. The incumbent has to
//     be a (side, box) pair, or a flapping panel height sends it back and forth
//     between "past the room" and "past the lights". Both cases below are the
//     ones adversarial review reproduced against the first version. ---
function roomStub(W, H, ph, roomBox) {
  const c = stub(W, H, 420, ph);
  c._config.room_tap = true;
  c._roomPlacementBox = () => ({ box: roomBox, key: '7' });
  return c;
}
{
  // Room {100,10,600,200}, lights well inside it at y=60px, a lamp elsewhere
  // flapping the panel between 321 and 353: once settled, ONE position.
  const c = roomStub(900, 563, 321, { l: 100, t: 10, r: 600, b: 200 });
  sel(c, [['light.a', 30, 60 / 563 * 100], ['light.b', 50, 60 / 563 * 100]]);
  const ys = [];
  for (const ph of FLAP) { c.ph = ph; c._placeFloatingControls(); ys.push(at(c)); }
  eq('room selection: no oscillation once settled (ticks 2..n identical)', new Set(ys.slice(1)).size, 1);
  eq('room selection: at most one settle move', new Set(ys).size <= 2, true);
}
{
  // A fresh selection must not jump on its SECOND tick with identical inputs.
  const c = roomStub(1000, 600, 250, { l: 200, t: 20, r: 700, b: 325 });
  sel(c, [['light.a', 40, 25], ['light.b', 50, 25]]);
  c._placeFloatingControls(); const t1 = at(c);
  c._placeFloatingControls(); const t2 = at(c);
  c._placeFloatingControls(); const t3 = at(c);
  eq('room selection: identical ticks do not move the panel', [t1 === t2, t2 === t3], [true, true]);
}
{
  // When the room fits below with room to spare, the panel goes BELOW THE ROOM,
  // not just below the lights.
  const c = roomStub(900, 900, 250, { l: 100, t: 10, r: 600, b: 400 });
  sel(c, [['light.a', 30, 10], ['light.b', 50, 10]]);
  c._placeFloatingControls();
  eq("room selection: 'below' clears the room's bottom edge", [c._cfSide, parseInt(c.styles['--cf-y'], 10) >= 400], ['below', true]);
}

// --- Deselect: a HIDING panel fades out where it is. Clearing the placement
//     in the same tick threw the box to its CSS anchor while it was still
//     fully opaque, so it jumped and faded out somewhere else. ---
async function deselectFade() {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const cls = (c) => c._els.controlsFloating.classList;
  // updateLights toggles .visible BEFORE it places, so the cases do the same.
  const pick = (c, pts) => { sel(c, pts); cls(c).add('visible'); c._placeFloatingControls(); };
  const drop = (c, keepVisible) => {
    c._selectedLights.clear();
    if (!keepVisible) cls(c).remove('visible');
    c._placeFloatingControls();
  };
  {
    const c = stub(900, 563, 420, 321); c.fadeMs = 60;
    pick(c, [['a', 15, 12]]); const placed = at(c);
    drop(c);
    eq('deselect while hiding: the same tick keeps the place', [at(c), cls(c).contains('auto-placed')], [placed, true]);
    c._placeFloatingControls();   // an idle tick mid-fade must not restart or skip the wait
    await wait(30);
    eq('deselect while hiding: still in place mid-fade', [at(c), cls(c).contains('auto-placed')], [placed, true]);
    await wait(120);
    eq('deselect while hiding: parked once the fade is over',
      [at(c), cls(c).contains('auto-placed'), c._cfAt], ['undefined/undefined', false, null]);
  }
  {
    const c = stub(900, 563, 420, 321); c.fadeMs = 60;
    pick(c, [['a', 15, 12]]); const first = at(c);
    drop(c);
    await wait(20);
    pick(c, [['b', 85, 88]]); const second = at(c);
    await wait(120);
    eq('a reselect mid-fade cancels the pending clear',
      [cls(c).contains('auto-placed'), at(c), second !== first, !c._cfClearTimer], [true, second, true, true]);
  }
  {
    // The grip can keep focus through a deselect, and an arrow key on it during
    // the fade hands the box to the user: `dragged`, its own --cf-x/--cf-y. The
    // pending clear must not strip those.
    const c = stub(900, 563, 420, 321); c.fadeMs = 60;
    pick(c, [['a', 15, 12]]);
    drop(c);
    const el = c._els.controlsFloating;
    el.style.setProperty('--cf-x', '33px'); el.style.setProperty('--cf-y', '44px');
    cls(c).remove('auto-placed'); cls(c).add('dragged');
    await wait(120);
    eq('a hand placement during the fade survives the pending clear', [at(c), cls(c).contains('dragged')], ['33px/44px', true]);
  }
  {
    // always_show_controls / default_entity: the panel stays up, nothing to wait for.
    const c = stub(900, 563, 420, 321); c.fadeMs = 60;
    pick(c, [['a', 15, 12]]);
    drop(c, true);
    eq('a panel that stays visible is handed back at once',
      [at(c), cls(c).contains('auto-placed'), !c._cfClearTimer], ['undefined/undefined', false, true]);
  }
  {
    // prefers-reduced-motion zeroes the fade: no fade, no wait.
    const c = stub(900, 563, 420, 321); c.fadeMs = 0;
    pick(c, [['a', 15, 12]]);
    drop(c);
    eq('no fade to wait for clears at once', [cls(c).contains('auto-placed'), !c._cfClearTimer], [false, true]);
  }
}

deselectFade().then(() => {
  console.log(fails ? `\n${fails} FAILED` : '\nall floating-placement stability assertions pass against shipped code');
  process.exit(fails ? 1 : 0);
});
