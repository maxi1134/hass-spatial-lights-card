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
    _toScreenPct: (x, y) => ({ x, y }),          // identity: rotation is covered by rot-math
    _planRotation: () => 0,
    _lightScreenRadius: () => 20,
    _clearAutoPlacement(n) { this._cfAt = null; n.classList.remove('auto-placed'); },
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

console.log(fails ? `\n${fails} FAILED` : '\nall floating-placement stability assertions pass against shipped code');
process.exit(fails ? 1 : 0);
