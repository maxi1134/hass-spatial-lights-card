// Extracts the SHIPPED method bodies out of the card file and drives them
// against stubs, so this tests the real source rather than a copy of it.
const fs = require('fs');
const SRC = fs.readFileSync(process.argv[2] || 'C:/claude/spatial-lights-card/hass-spatial-lights-card.js', 'utf8');

function extract(header) {
  const i = SRC.indexOf(header);
  if (i < 0) throw new Error('not found: ' + header);
  let j = SRC.indexOf('{', i), depth = 0, k = j;
  for (; k < SRC.length; k++) {
    if (SRC[k] === '{') depth++;
    else if (SRC[k] === '}') { depth--; if (depth === 0) break; }
  }
  const args = header.slice(header.indexOf('(') + 1, header.indexOf(')'));
  const body = SRC.slice(j + 1, k);
  return new Function(args, body);
}

const hold = extract('_applyHoldGesture(entity, pointerType) {');
const ctx  = extract('_handleCanvasContextMenu(e) {');
// The DURABLE half of the once-per-gesture latch. Extracted rather than stubbed,
// because its window is the thing under test: _longPressTriggered and _holdArm
// are both cleared by pointerup/pointercancel, and Android's real order is
// timer -> pointercancel -> contextmenu.
const just = extract('_longPressJustHandled() {');

Object.defineProperty(global, 'navigator', { configurable: true, writable: true, value: { vibrate: (p) => { global.__buzz.push(p); return true; } } });
global.CSS = { escape: (s) => s };

function card(selected = [], opts = {}) {
  const c = {
    _longPressTriggered: false,
    _longPressHandledAt: null,
    _longPressTimer: null,
    _holdArm: null,
    _pendingTap: null,
    _lastTap: null,
    _wallEditMode: false,
    _selectionTouchClaim: null,
    _selectedLights: new Set(selected),
    _hass: { states: { 'light.a': { attributes: { friendly_name: 'Lamp A' } } } },
    moreInfo: [], announced: [], pulses: [],
    _isSelectableEntity: (id) => id.split('.')[0] !== 'binary_sensor',
    _openMoreInfo(e) { this.moreInfo.push(e); },
    _announce(m) { this.announced.push(m); },
    _pulseLight(e) { this.pulses.push([e, 'in']); },
    _commitSelection(s) { this._selectedLights = new Set(s); },
    _applyHoldGesture: hold,
    _handleCanvasContextMenu: ctx,
    _longPressJustHandled: just,
    ...opts,
  };
  return c;
}
function lightEvent(entity) {
  const node = { dataset: { entity }, classList: { contains: (c) => c === 'light' } };
  return { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; },
           target: { closest: (sel) => (sel === '.light' ? node : null) } };
}

let fails = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { fails++; console.log(`FAIL ${name}\n  got  ${g}\n  want ${w}`); }
  else console.log(`ok   ${name}  ${g}`);
};

// 1. Empty selection, touch hold -> more-info (the user's stated requirement).
global.__buzz = [];
let c = card([]);
c._applyHoldGesture('light.a', 'touch');
eq('empty selection -> more-info', [c.moreInfo, [...c._selectedLights], global.__buzz], [['light.a'], [], [30]]);

// 2. Selection live, hold an UNSELECTED light -> added, one buzz, pulse in.
global.__buzz = [];
c = card(['light.b']);
c._applyHoldGesture('light.a', 'touch');
eq('add to selection', [[...c._selectedLights].sort(), c.moreInfo, c.pulses, global.__buzz],
   [['light.a', 'light.b'], [], [['light.a', 'in']], [30]]);
eq('add announces', c.announced, ['Added Lamp A. 2 lights selected']);

// 3. Hold an ALREADY-SELECTED light -> the group is UNCHANGED. The gesture only
//     ever adds, so a press the user is unsure about is safe to repeat; a
//     toggle here would silently undo the previous hold.
global.__buzz = [];
c = card(['light.a', 'light.b']);
c._applyHoldGesture('light.a', 'touch');
eq('already selected -> unchanged', [[...c._selectedLights].sort(), c.moreInfo, global.__buzz],
   [['light.a', 'light.b'], [], [30]]);
eq('already selected still confirms', c.announced, ['Already selected Lamp A. 2 lights selected']);

// 4. ...and it still CONSUMES the gesture, which is the real work in that case:
//     without _longPressTriggered the release runs the tap path, and a tap
//     REPLACES the selection with just this light.
eq('already selected consumes the tap',
   [c._longPressTriggered, c._pendingTap, c._lastTap], [true, null, null]);

// 4b. THE ANDROID CANCEL RACE, which is why the latch is a timestamp and not a
//      boolean. Real order on Android: the hold timer fires, a pointercancel
//      lands (clearing _longPressTriggered and _holdArm exactly as pointerup
//      does), and only THEN the contextmenu the same hold raised arrives. With
//      only the boolean guards it falls straight through to more-info, which
//      opens on top of the selection the hold just edited. Measured in a
//      browser before the fix: the light was added AND the dialog appeared.
c = card(['light.b']);
c._applyHoldGesture('light.a', 'touch');
c._longPressTriggered = false;    // what pointercancel/pointerup do
c._holdArm = null;                // ...and this
c._handleCanvasContextMenu(lightEvent('light.a'));
eq('cancel race: contextmenu after pointercancel is swallowed',
   [[...c._selectedLights].sort(), c.moreInfo], [['light.a', 'light.b'], []]);

// 4c. ...but the latch must not leak into a LATER genuine right-click.
c._longPressHandledAt = Date.now() - 5000;
c._handleCanvasContextMenu(lightEvent('light.c'));
eq('latch expires', c.moreInfo, ['light.c']);

// 5. Non-selectable entity with a selection live -> more-info, selection intact.
c = card(['light.b']);
c._applyHoldGesture('binary_sensor.door', 'touch');
eq('binary_sensor -> more-info', [c.moreInfo, [...c._selectedLights]], [['binary_sensor.door'], ['light.b']]);

// 6. Idempotence: the timer wins, Android's contextmenu arrives after.
c = card(['light.b']);
c._holdArm = { entity: 'light.a', pointerType: 'touch' };
c._applyHoldGesture('light.a', 'touch');          // timer
let e = lightEvent('light.a');
c._handleCanvasContextMenu(e);                     // contextmenu, same hold
eq('timer first: contextmenu swallowed', [[...c._selectedLights].sort(), c.moreInfo, e.defaultPrevented],
   [['light.a', 'light.b'], [], true]);

// 7. Idempotence the other way: contextmenu wins, the timer then no-ops.
c = card(['light.b']);
c._holdArm = { entity: 'light.a', pointerType: 'touch' };
c._longPressTimer = 99;
e = lightEvent('light.a');
c._handleCanvasContextMenu(e);
eq('contextmenu first: adds + kills timer', [[...c._selectedLights].sort(), c._longPressTimer], [['light.a', 'light.b'], null]);
c._applyHoldGesture('light.a', 'touch');           // the timer, had it survived
eq('timer after contextmenu is a no-op', [[...c._selectedLights].sort(), c.pulses.length], [['light.a', 'light.b'], 1]);

// 8. Mouse right-click still opens more-info with a selection live.
c = card(['light.a', 'light.b']);
c._holdArm = null;
e = lightEvent('light.a');
c._handleCanvasContextMenu(e);
eq('right-click -> more-info, selection kept', [c.moreInfo, [...c._selectedLights].sort()],
   [['light.a'], ['light.a', 'light.b']]);

// 9. A left-button hold armed by a MOUSE does not get the touch branch.
c = card(['light.b']);
c._holdArm = { entity: 'light.a', pointerType: 'mouse' };
e = lightEvent('light.a');
c._handleCanvasContextMenu(e);
eq('mouse-armed hold + contextmenu -> more-info', [c.moreInfo, [...c._selectedLights]], [['light.a'], ['light.b']]);

// 10. The hold cancels the pending tap so the release cannot also select.
c = card(['light.b']);
c._pendingTap = { entity: 'light.a' };
c._lastTap = { entity: 'light.a', time: 1 };
c._applyHoldGesture('light.a', 'touch');
eq('hold consumes the tap', [c._pendingTap, c._lastTap], [null, null]);

// 11. Mouse hold never vibrates.
global.__buzz = [];
c = card(['light.b']);
c._applyHoldGesture('light.a', 'mouse');
eq('mouse hold: no haptics', global.__buzz, []);

console.log(fails ? `\n${fails} FAILURES` : '\nall passed');
process.exit(fails ? 1 : 0);
