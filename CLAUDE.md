> Work in Progress! The following might change at any moment.

## Project Structure Overview

**Single-file architecture.** The whole card lives in `/home/user/hass-spatial-lights-card/hass-spatial-lights-card.js`. It's a Web Component that extends `HTMLElement` (`class SpatialLightColorCard`), plus a sibling editor (`class SpatialLightColorCardEditor`).

> ℹ️ Anchors below are **function/identifier names** rather than line numbers — line numbers drift constantly. Use `grep -n` to jump to a name (e.g. `grep -n '_renderAll' hass-spatial-lights-card.js`).

**Key concepts:**
- `setConfig(config)` — Lovelace contract; normalizes config and re-renders if `hass` is set.
- `set hass(hass)` — Lovelace contract; diffs `prev.states` vs `next.states` against the config's entity set (`_isRelevantHassChange`) and runs `updateLights()` only when something relevant changed. First call goes through `_renderAll()`.
- `_renderAll()` — destructive: writes the whole `shadowRoot.innerHTML`, caches element refs, calls `_attachEventListeners()`. Calls `_cancelActiveInteractions()` first so an in-flight gesture commits its pending value before the DOM is wiped.
- `updateLights()` — non-destructive: walks each `.light` and toggles classes / sets styles based on current state (color, on/off, selected, unavailable). Drives `_updateControlValues`, `_refreshColorPresets`, `_updateAllGlows`, `_repositionLabels`.

---

## 1. Slider Controls Rendering

**Renderers:** `_renderControlsFloating(visible, controlContext)` and `_renderControlsBelow(controlContext)`. Both emit the same children: the colour bars (`_colorBarsHTML` — preview swatch, tint, hue), two `<input type="range">` sliders (brightness 0-255, temperature in `tempRange.min..max`), and a `.presets-row` = power toggle (`_renderPowerToggle`, gated by `show_power_button`) + `.power-separator` + `.presets-area`. The row carries `.has-presets` (set at render and kept in sync by `_refreshColorPresets`); without it the separator and the empty presets area are `display: none`, leaving just the toggle.

**Power toggle:** `<button class="power-toggle" id="powerToggle">` at the start of `.presets-row` — the slot beside the wheel on mobile / under the sliders on desktop, whose height the 128 px wheel already sets — so it costs neither slider width nor card height. `_getPowerState(controlled)` classifies the available light/switch/input_boolean subset as `on` / `off` / `mixed` / `none` (→ disabled); `_updatePowerToggle` syncs class, `aria-pressed` (`mixed` for partial) and the label from `_updateControlValues`. Click calls `_toggleSelection(_getControlledEntities())` — the same any-off → all-on rule as the Space key.

**Layout modes:**
- Desktop (`@media (min-width: 769px)`): CSS Grid 2×2. Color wheel `grid-column: 1; grid-row: 1/3`; sliders top-right; `.presets-row` bottom-right (presets wrap inside it).
- Mobile (`@media (max-width: 768px)`): flex-wrap row. Wheel order 1, `.presets-row` order 2 with `max-width: calc(100% - 140px)`, sliders order 3 at full width.
- Floating vs below: `controls_below: true` (default) renders the controls block after the canvas; otherwise they're absolutely positioned over the canvas with mobile-aware insets.

**Slider gesture (`_bindSliderGesture`):** Pointer-down captures and immediately calls `_applyPointerValue(el, clientX)`. Pointermove follows the finger, with a 6 px / `dy > dx` heuristic that releases capture and reverts the value when the user is actually trying to scroll the page. Pointerup commits via `_handleBrightnessChange()` or `_handleTemperatureChange()`. The active gesture is recorded in `this._activeSliderGesture` so `_updateControlValues` skips clobbering the value while the user's finger is down. Keyboard-driven `change` events commit through `_scheduleSliderCommit` (150 ms trailing debounce).

**Service-call throttling:** Live mouse drags on the mini wheel go through `_applyColorWheelSelectionLive` (leading+trailing throttle, ~7 calls/sec); the pointerup commit calls `_applyColorWheelSelection` directly after `_cancelLiveWheelThrottle()` so a stale trailing color never lands after the final one.

**Theming:** `_themeTokens()` emits the `:host` CSS custom properties per `theme_mode` (`auto` maps HA theme variables with the original dark palette as fallbacks and derives elevation surfaces via `color-mix`; `dark`/`light` are fixed palettes), then appends user `theme.*` overrides. In auto mode without a `card_background` override, the `ha-card` background is NOT overridden so native theme styling (incl. glass backdrop-filter) applies. All components consume tokens only — never hardcoded colors.

**Visual updates:**
- `_updateSliderVisual(el)` — sets `--slider-percent` / `--slider-ratio` from `value`/`min`/`max`.
- `_updateControlValues(controlContext)` — full sync to averaged state, plus capability gating via `_getControlCapabilities()` (toggles `disabled` attribute on sliders, `.disabled` on the colour bars, `.no-rgb-support`/`.no-temp-support`/`.no-brightness-support` on the controls container). The temperature slider's warm-to-cool gradient is a static CSS background — it's a visual affordance, not a precise color readout.

---

## 2. Color Presets & Live Colors

**Flow:** `_renderPresetsContent()` → `_renderColorPresets()` + (separator) + `_renderTemperaturePresets()` + `_renderEffectPresets()`.

**Color presets (`_renderColorPresets`):**
1. `_getLiveColors()` walks `state === 'on'` entities, filters by `color_mode` ∈ `RGB_COLOR_MODES`, deduplicates with `_rgbDistance() < COLOR_TOLERANCE` (constants on the class).
2. Filters live colors against config presets so config wins on collision.
3. Each preset is a focusable `<div role="button" tabindex="0">` carrying `data-preset-color`, optionally `data-preset-rgb`, and `data-preset-entities`.

**Active state:** `_getActivePresetColor()` returns the unique RGB shared by all controlled lights (within tolerance), or null. The preset whose RGB matches gets `.active`.

**Temperature presets (`_renderTemperaturePresets`):** Only emitted if `show_live_colors: true`. `_getLiveTemperatures()` groups lights with `color_mode === 'color_temp'` by ±`TEMP_TOLERANCE` Kelvin. The swatch is `_kelvinToRgb(kelvin)` (Tanner Helland, clamped to 1000-40000 K).

**Separator:** A 1×20 px div between RGB and temp presets. `_updateSeparatorVisibility()` checks via `getBoundingClientRect()` whether the previous color preset and the next temp preset are on the same row, and hides the separator otherwise.

**Preset interaction:** `_bindPresetHighlight(el)` and `_bindPresetHandlers()`. Mouse hover highlights matching lights via `pointerenter`/`pointerleave`; touch uses a 300 ms long-press to highlight, then clears on `pointerup`. Click applies via `_applyColorWheelSelection(rgb)` / `_applyTemperaturePreset(kelvin)` / `_applyEffectPreset(effect)` / `_applyAdaptiveLighting()`. Keyboard Enter/Space activates from `_handleKeyDown` → `composedPath()` lookup.

**Adaptive Lighting toggle:** opt-in (`adaptive_lighting: true` / `{enabled: true}`). `_renderAdaptivePreset()` emits one extra `.effect-preset.adaptive-preset` button in the effect block when `_getAdaptiveLightingContext()` resolves a main switch of the basnijholt/adaptive-lighting integration (config `adaptive_lighting.switch`, else auto-detect via `findAdaptiveSwitches` — cached in `_alSwitchCache`, invalidated in `setConfig`). Active (`_isAdaptiveActive`) = switch on + every target in the switch's `configuration.lights` attribute and absent from its `manual_control` attribute. `_applyAdaptiveLighting()` toggles: inactive → `adaptive_lighting.set_manual_control` (`manual_control: false`, managed lights only) then `adaptive_lighting.apply` on the selected-or-all `light.*` targets; active → `set_manual_control` with `manual_control: true` (pause). `_isRelevantHassChange` also watches the resolved switch (`_alSwitchId`).

---

## 3. Light Rendering

**`_renderLightsHTML()`** maps over `_config.entities`, renders each as:

```html
<div class="light {state} {selected} {iconOnly} {unavailable}"
     style="left:Px%; top:Px%; ..."
     data-entity="..." tabindex="0" role="button"
     aria-label="..." aria-pressed="..." aria-disabled="...">
  <div class="light-glow"></div>?            <!-- if glow enabled -->
  <ha-icon ...>?                              <!-- if icons -->
  <div class="light-label">...</div>
  <div class="light-status-badge">?</div>?    <!-- if unavailable -->
</div>
```

**`updateLights()`** does in-place sync without rebuilding the DOM: state class, color, selection, and the `unavailable` class + badge are added/removed lazily.

**Color resolution:** `_resolveEntityColor(id, isOn, attributes)` consults `color_overrides`, then domain-specific defaults (`switch_on_color`/`switch_off_color`, `binary_sensor_*_color`, `scene_color`), then `attributes.rgb_color`, with `'#ffa500'` fallback for unknown.

---

## 4. Selection & Interaction State Machine

**Pointer events (`_attachEventListeners`):** All canvas pointer events flow into `_onPointerDown` / `_onPointerMove` / `_onPointerUp` / `_onPointerCancel`. `_handleCanvasContextMenu` opens more-info on right-click and clears any pending long-press.

**Modes:**
- Locked (default `_lockPositions = true`): tap → select / toggle (per `switch_single_tap`); 500 ms long-press → more-info. The canvas gets `touch-action: pan-y pinch-zoom` (class `touch-scroll`, gated by `canvas_touch_scroll`) so vertical swipes scroll the page.
- Edit positions (`_editPositionsMode`): tap → select; drag → reposition; arrow keys nudge. This is **editor-session state, never config**: the editor broadcasts `spatial-card-edit-mode` window events (and answers `spatial-card-preview-hello` from recreated preview cards); only a card inside `hui-card-preview` (`_isInsideEditorPreview`) honors them. Legacy `_edit_positions`/`_editor_id` keys in saved configs are ignored by the card and stripped by the editor.
- Rubber-band: a pointerdown on empty canvas arms `_selectionStart`/`_selectionPointerId`; the `.selection-box` materializes only after 5 px of movement, hit-testing is rAF-coalesced and diffed, and a completed tap (not pointerdown) is what deselects. Touch ownership is decided in JS, not by touch-action: the canvas is `touch-action: auto` (class `touch-scroll`) and `_handleCanvasTouchMove` (non-passive) rules on the first cancelable touchmove — movement within ~22° of vertical is declined to the browser (native scroll → pointercancel, selection kept, box never created thanks to a touch gate on box creation), anything else claims `_selectionTouchClaim = 'select'` and preventDefaults every subsequent touchmove so the marquee can then travel in any direction. A ~300 ms still hold (`_selectionHoldTimer`) claims 'select' outright for deliberately vertical box drags; `_handleCanvasContextMenu` swallows Android's ~500 ms long-press contextmenu while claimed.
- Preset hold-to-preview sets `_suppressPresetClick` so the synthesized click on release never applies the preset.

**Cancellation:** `_cancelActiveInteractions()` is the single sink for "abort everything." It releases capture, clears `_dragState`, all timers, magnifier state, color-wheel gesture, and commits any pending slider value. It's called from `_onPointerCancel`, `disconnectedCallback`-equivalent (via `_cancelActiveInteractions`), `visibilitychange` (when `document.hidden`), `window.blur`, and at the top of `_renderAll`.

---

## 5. Service Calls

All `light.turn_on` calls are routed through `_getServiceTargets(controlled, capability)`, which:
- filters to `light.*` entities (no `light.turn_on` on switches/scenes),
- skips unavailable entities,
- intersects with `supported_color_modes` for `'rgb'` / `'color_temp'` / `'brightness'`.

The result is sent in a single batched call (`entity_id: [array]`) so platforms (Hue, Z2M, deCONZ) can sync the bulbs together. Promise rejections are logged via `console.warn` rather than swallowed silently.

`_toggleEntity(entity)` handles tap-toggle: domain-aware (`scene.turn_on` for scenes, `switch.turn_on/off` for switches, etc.), and skips unavailable entities.

---

## 6. Capability Helpers

- `_isEntityAvailable(id)` — `state` is not `unavailable`/`unknown`/null.
- `_getControlCapabilities(controlled)` — union of `supported_color_modes` across the controlled lights; returns `{rgb, color_temp, brightness, anyLight}`. Drives the disabled/dimmed state of the wheel and sliders.
- `_getServiceTargets(controlled, capability)` — filters for service calls.

---

## 7. Color Picker (bars)

Four stacked full-width bars are the whole control surface: **brightness** (the track carries the
light's current colour, the axis is brightness), **tint** (the pure hue to white), **hue** (the
spectrum), and **temperature** (the warm-to-cool ramp). They replaced both the colour wheel AND the
separate brightness/temperature sliders, so `.slider` and its rules are gone from the card's
stylesheet — the editor has its own copies and is unaffected.

The brightness bar doubles as the preview: its track is painted with the ACTUAL averaged colour, not
the two colour bars' reconstruction, because a dim or warm-white light has a value they cannot express
with V pinned to 100. It deliberately carries no ramp — a dark-to-colour gradient would read as a
second colour control rather than a brightness axis.

`brightnessSlider` and `temperatureSlider` KEPT their ids when they moved into the bars, so every
existing consumer (`_updateControlValues`'s sync, `_bindSliderGesture`'s commit, `_scheduleSliderCommit`,
`_applyTemperaturePreset`) keeps working untouched. Capability gating sets the disabled property on
those two individually — a light may do colour but not temperature — so
`.color-bar-input:disabled` mutes them on their own, separately from the whole-block
`.color-bars.disabled` that `caps.rgb` drives.

The numeric readouts (`brightnessValue` / `temperatureValue`) have no elements any more; every write to
them is already element-guarded, so they are inert rather than broken and would light up again if the
labels ever came back.

**Script buttons** (`script_buttons`) run a script against whatever the controls are pointed at. They
render as `.effect-preset.script-preset` in the presets row, so they inherit the icon-circle look, the
click binding and the Enter/Space path the other presets already have — the only new code is the
normalizer, the renderer and `_applyScriptButton`.

`script` is a full `domain.service`, so `scene.movie` and `automation.trigger` work as well as
`script.foo`; that is why there is no separate `service` key. The entities go in under `target_key`
(default `entity_id`), which is the variable name the script receives, and `data` merges fixed arguments
underneath. Targeting widens the same way `_applyEffectPreset` does — selection, else `default_entity`,
else every entity on the plan — so a button still does something sensible with nothing selected.
`pass_entities: false` opts out entirely, for a script that takes none.

**The floating controls are draggable, and that is the answer to them being in the way.**
`default_entity` keeps them on screen — it names the light they act on when nothing is selected,
which is only useful if they are there to act — so the fix for "permanently over my plan" is to let
the user move them, not to hide them.

`_bindFloatingDrag` drags by a grip (`.cf-grip`); `.dragged` swaps the anchors for `--cf-x`/`--cf-y`.
Three things are load-bearing. The position is stored as FRACTIONS of the canvas, so it survives a
resize, a column change and a rotation. `_applyFloatingPos` re-clamps on EVERY application, not just on
drop, because the canvas can be a different shape by then. And it is driven from the canvas
ResizeObserver, because `_renderAll` legitimately runs while the card is DETACHED (HA sets config and
hass before appending) and there is no box to clamp against yet.

The box is sized by WIDTH, never by pinning left AND right. A dragged box has to release the right
edge, and the mobile rule used to size it by pinning both with `width: auto` — so dragging collapsed it
to shrink-to-fit, 428px down to 187px. Compression is `@container sle-card` on `.canvas-wrapper`, named
rather than anonymous because `#canvas` becomes a size container itself on a quarter turn and would
otherwise capture those queries.

The grip stops propagation: it sits inside `#canvas`, whose pointerdown currently declines the gesture,
but incidentally rather than by contract. Its Escape swallows too, or one key would both reposition the
panel and clear the selection.

**`max-height: calc(100% - 40px)` on the box is not cosmetic.** `#canvas` clips, and the grip is the
TOPMOST child, so a box taller than the plan loses its own drag handle first — and with it any way to
move the panel off the lights. On an ordinary 1.6:1 plan in a 420px column the box was 321px against a
262px canvas and the grip hit-tested to BODY: the feature was unreachable. It scrolls internally now.
The same reasoning pins an over-tall box to the BOTTOM on restore rather than the top, because the
presets row and power toggle live at the bottom and are what you press.

Three more things the live drag owns: `_applyFloatingPos` bails while `.dragging` (every watched state
change calls `updateLights`, including the ones this card just caused, and it would rewrite the position
from the stored fractions mid-gesture); a second pointer on the grip is ignored rather than replacing
the state; and the origin is seeded through the SAME clamp `pointermove` applies, or an over-tall box
jumped the instant it was grabbed.

The `@container` rules sit AFTER the `@media (max-width: 768px)` block on purpose: container queries add
no specificity, so source order is all that decides which wins when both match.

**Bar height is `color_bar_height`** (px, default 34, clamped 12–120). It feeds `--color-bar-h`, which the
track AND thumb rules both derive from, so the thumb stays proportional at any height.

**The floating controls flip ends.** `_placeFloatingControls` anchors the box to whichever end of the
plan the selection is NOT at (`.at-top` swaps `bottom` for `top`), because overlaid controls that cover
the very lights you just selected are the worst case — and with four stacked bars the box is often
taller than half the canvas, so this is common rather than rare. It averages the selection in SCREEN
percentages via `_toScreenPct`: the box is anchored to the canvas, so on a rotated plan a
plan-bottom light may well be on the screen left and must NOT trigger a flip.

**The model is HSV with V pinned to 100.** HSL cannot express the tint axis -- dropping HSL saturation
goes to grey, not white -- so `hsvToRgb`/`rgbToHsv` are the maths, even though the CSS gradients use
`hsl()` for the fully saturated end, where the two models agree.

**`tint` is 0 at the vivid end and 100 at white**, which is the direction the gradient reads left to
right, so the plain `<input type="range">` plumbing needs no reversing and saturation is simply
`100 - tint`. The bars are ordinary range inputs bound with `_bindSliderGesture`, so they inherit pointer
capture, the vertical-scroll heuristic and the commit-on-release that the brightness and temperature
sliders already use. That is most of why the wheel's magnifier and long-press overlay are gone: a
full-width bar needs no aiming aid, and `_openLargeColorWheel`, `_drawLargeColorWheel`, `_updateMagnifier`
and friends went with it.

`_colorBarsRGB()` reads the two values; `_syncColorBars()` pushes state back into appearance (the preview
swatch, and the tint track's gradient, which starts at the currently chosen hue). `_updateControlValues`
syncs the bars FROM the lights unless `_activeSliderGesture === 'color'` -- a live apply round-trips
through hass and returns as state, so writing it back mid-drag would make the thumb stutter against the
finger. The preview swatch shows the light's ACTUAL colour rather than the bars' reconstruction, because a
dim or warm-white light has a value the bars cannot express with V pinned to 100.

**Two traps, both hit while building this.** Vendor track pseudo-elements need their OWN rules: a browser
that does not recognise one selector in a comma list throws away the WHOLE rule, so pairing
`::-webkit-slider-runnable-track` with `::-moz-range-track` left both engines with no track at all and the
bars rendered blank. And the release commit must not repeat what the trailing live apply already sent --
`_lastLiveWheelRgb` records what actually went out and the commit skips an exact repeat, cleared at
pointerdown so it can never suppress a fresh gesture that merely lands on the same colour.

`_applyColorWheelSelection` / `_applyColorWheelSelectionLive` / `_cancelLiveWheelThrottle` survive
unchanged: they are the shared service-call seam, used by the presets and keyboard paths too, and the
leading+trailing throttle is what keeps a drag to ~7 calls/sec.

## 8. Glow / Walls

Two renderers exist; exactly one is live at a time, decided by the `_fieldActive` getter (`light_field.enabled` + a 2D-canvas feature test).

**Sizes may be plan-relative.** `glow.width`, `glow.length` and `light_field.radius` accept a number (CSS px) or a `'NN%'` string. `_normalizeGlowLength` preserves the `%` form verbatim; `_resolveGlowLength(value, rect)` resolves it at paint time against the canvas WIDTH (not the diagonal or height, so a round pool stays round whatever the plan's aspect). `_normalizeGlowOverrides` must route `length`/`width` through `_normalizeGlowLength` too, not `Number()`: `Number('26%')` is NaN, so per-entity percentages were silently dropped and the light fell back to the card-level size. It passes a null fallback, so an unusable value omits the key rather than inventing a default.

Both renderers resolve: the field in `_getFieldEmitter`, the legacy path in `_updateGlow` via a resolved copy of `gc` — which is why `_updateAllGlows` now measures the canvas rect unconditionally, not just when walls exist. Pixels are inherently width-dependent (56% of the plan at 460px, 19% at 1360px), which is why the editor preview and the dashboard disagreed; percentages are width-invariant. Plain numbers stay px for back-compat; only `light_field.radius` defaults to `'19%'`, being new to this fork.

**They are not two features.** `glow.*` says WHAT each light emits — shape, width, length, direction, spread, start_width, intensity, falloff, gradient_stops, offsets, colour, custom_shape, scale_with_brightness — and the field renderer reads ALL of those; `light_field.*` says HOW that emission is composited (renderer choice, blend, exposure, ambient, soft-shadow samples, quality). Only `glow.blur` and `glow.edge_softness` are field-inert, because it models soft edges with `samples`/`source_radius` instead. `light_field.radius` applies only to lights with no glow config of their own.

The editor therefore presents ONE "Light Projection" section: a single enable switch, a **Renderer** select (Diffused / Classic) writing `light_field.enabled`, a shared Emission block, and a Diffusion block shown only for the field. Two peer sections with two "Enable" switches led users to turn on Glow and never discover that diffusion is what makes wall shadows and colour mixing exact. `cfgGlowBlur`/`cfgGlowEdgeSoftness` are disabled and suffixed "(classic only)" under the field.

**Legacy (default).** `_updateAllGlows()` iterates lights and applies a `light-glow` div with shape, length, color, and optional wall-shadow mask. Wall masks are cached per `(entityId, wallConfigVersion, glow shape/size)`. When `_fieldActive`, `_renderLightsHTML` does not emit the div and `_updateAllGlows` returns immediately.

**Light field (`light_field.enabled`).** One shared `<canvas class="light-field">` inside `#canvas`, between `.grid` and the `.light` markers. `.light-halo` (the icon-only / minimal-ui colour carrier) is gated on `!_fieldActive` alongside `.light-glow` — it is a second projected-light source, and left ungated it painted inside `.light`'s own stacking context (i.e. above the field canvas), double-glowing and escaping every wall. Each `.light` is its own stacking context (its glow sits at `z-index:-1` inside it), which is the structural reason the legacy glows can never merge — one surface fixes it. `_renderLightField()` draws every lit entity with `globalCompositeOperation='lighter'`, so overlapping colours add.

Shadows are exact: `_computeVisibilityPolygon` sweeps rays at every wall endpoint (±epsilon, which lets the polygon round a corner) and every footprint vertex, taking the nearest hit. It runs in a per-light **affine frame** — `screen = L + R(direction)·diag(sx,sy)·local` — in which every glow shape is a unit primitive (disc / trapezoid / rectangle / 72-gon), so one code path covers all eight shapes. Sound because visibility is affine-invariant. `_getFieldEmitter` builds that frame and deliberately mirrors `_updateGlow`'s DOM geometry so existing glow configs render identically; the gradient radius is `SQRT2` in local units to match what CSS `radial-gradient(... farthest-corner)` resolves to.

Frames are quantized to 4px buckets and polygons cached in `_visPolyCache`, keyed on geometry only — colour, brightness alpha and selection never re-solve. `_wallGeomVersion` is an FNV-1a hash of the wall coordinates rather than a counter, because the editor calls `setConfig` on every keystroke. Scheduling is rAF **plus a 250ms setTimeout backstop**: a hidden document may never run the rAF, and the pending-handle guard would otherwise deadlock every later request.

The occluder reach bound is `em.footprintMaxR` (computed once in `_getFieldEmitter`), NOT a hard-coded `SQRT2`: that constant is right for the trapezoid/rectangle footprints but `_normalizeCustomShape` clamps `custom_shape` radii to `[0, 2]`, so a `shape: custom` footprint reaches further and any wall between `SQRT2` and its real radius was culled while the sweep still drew out to it.

Wall edits are identified by GEOMETRY, not by index. A delta carries `from` (the wall's pre-edit coordinates) and the editor trusts `_src` only when the entry at that index still matches — because `_src` is null for anything drawn in the current session (it is assigned only when a saved config comes back through `_normalizeGlowWalls`, and HA's save round trip is async, so several strokes routinely land first). Resolving a null `_src` positionally rewrote the wrong wall, so the card and the saved config diverged and the walls jumped on reload.

`_normalizeGlowWalls()` accepts line segments (`[x1, y1, x2, y2]` / `{x1,y1,x2,y2}`), boxes (`{x, y, width, height}`) and polylines (`{points: [[x,y],...], closed}`), and stamps each output segment with `_src` (raw config index) and `_part` (which edge of a box/polyline).

**Wall drawing.** Editor-session state only, armed by the `spatial-card-wall-mode` window event (a *separate* event from `spatial-card-edit-mode`, whose handler dedupes on `active` and would swallow it). `_onWallPointerDown/Move/Up` run ahead of the normal canvas gestures. **Modifier policy: no modifier DRAWS, `Shift` MODIFIES.** Plain drag always draws, and `_wallStartPoint` latches the stroke's origin onto an exact existing corner within 15px (chain anchor first, then nearest endpoint), so running a wall out of a corner joins with no gap and without nudging that corner. `Shift`+drag is what grabs an endpoint or a wall body. The reverse made the commonest action the hardest: pressing a corner grabbed its handle instead of starting a line from it. Long-press-to-delete (`_armWallHoldDelete`) is armed on BOTH paths — touch has no Shift — and on the draw path it discards the pending draft stroke first, which is safe because that stroke is always the last entry. Edits apply to `_draftWalls` locally first, then emit a `spatial-card-wall-delta` (`add`/`update`/`delete` + `_src`/`_part`) — never a snapshot, since the card's list is the normalizer's output and echoing it back would quadruple the user's list and destroy their boxes. `SpatialLightColorCardEditor._applyWallDelta` explodes a box/polyline only when one of its edges is actually dragged. Wall undo is a separate stack (`_wallHistory`) from position undo.

## 8c. Full-size wall editor

HA's edit-card dialog gives the preview a narrow column (~250px in a typical two-pane layout), which is unusable for tracing a plan, and that dialog's layout cannot be restyled from inside the card's shadow root. So arming wall mode also puts up `.wall-editor-overlay`, carrying the plan at up to 96vw with its real aspect ratio (`_wallEditorAspect`, from the measured image).

It is a **`<dialog>` opened with `showModal()`**, NOT a `position: fixed` div. That distinction is load-bearing: HA's edit-card dialog animates with a `transform`, and a transformed (or `filter`ed, or `contain: paint`) ancestor becomes the containing block for fixed descendants — which pinned the overlay to the size of the little preview card, i.e. exactly the thing it exists to escape (measured 820x188 instead of the viewport). Top-layer elements ignore ancestor containing blocks, overflow and stacking entirely, and `showModal` additionally makes the preview behind inert so it cannot steal the gesture. The UA supplies `display:none` when closed, so only `.wall-editor-overlay[open]` carries the flex layout. Opening goes through `_openWallEditor()`, never a bare `showModal()` during render: `showModal` throws `InvalidStateError: The element is not in a Document` when the tree is detached, and `_renderAll` legitimately runs detached because HA sets config and hass on a preview card BEFORE appending it. So it retries when not connected (rAF **plus** a 120ms timeout, since a hidden document may never run the frame callback) and again from `connectedCallback`; failures warn with the build string instead of being swallowed, and it measures itself afterwards and warns if it ended up under 90% of the viewport width. `SpatialLightColorCard.BUILD` is printed in the console banner so a cached copy is identifiable.

**Right-click deletes a wall (mouse only).** Handled in the POINTERDOWN handlers, not on `contextmenu`: only pointerdown carries both `pointerType` and `button`, so "mouse only" is a fact rather than a guess -- Android's long-press raises `contextmenu` with nothing to distinguish it from a real right-click, and binding there would delete a wall twice over since the hold timer already handles touch. It also fixed a live bug: the overlay stage's pointerdown listener had NO button guard, so a right-click was starting a draw. `_handleWallRightClick` repairs the selection index before removing, since indices shift down past the removal.

**The modal has two modes.** `_wallEditorMode` is `'walls'` or `'lights'`, arriving on the `spatial-card-wall-mode` event's `mode` field and switchable from the header. In lights mode the canvas light handles become the subject: bigger, labelled, and hit-tested by `_hitTestLightOnStage` (they are canvas drawings, not DOM markers, so hit testing is ours). Dragging writes `_config.positions` and commits on pointerup over the EXISTING `spatial-card-positions-changed` channel the editor already listens on, so no new protocol. Positions feed the field's emitter, so a drag clears `_fieldOccluders` and `_visPolyCache`.

**List selection highlights the plan.** The editor's `toggleExpand` broadcasts `spatial-card-highlight-entity`; the card honours it only inside the editor preview and toggles `.light.editor-highlight` (gold, deliberately not the selection colour). `_applyEditorHighlight` re-runs after every `_renderAll`, since that rebuilds the markers.

**Wall inspector.** A tap on a wall in the wall editor selects it (`_selectWall`) and `_syncWallInspector` populates a panel imperatively -- NOT through `_renderAll`, which would destroy and recreate the open `<dialog>` on every selection. The tap gesture was previously wasted: a sub-threshold stroke was discarded and nothing happened, so `_wallDrawState.overWall` records what the press landed on and pointerup selects it. The selection is mirrored onto the static `_wallEditorSelection` because HA replaces the preview card after every config change -- without that, ticking "it's a door" deselected the wall before an entity could be chosen. `_mountWallEntityPicker` uses `ha-entity-picker` when HA has upgraded it (always true, since the wall editor only opens from the card editor) and falls back to a text field.

Door edits ride the ordinary `update` delta with a `door` field; `undefined` means "geometry only, leave the door alone" and `null` clears it. Both the single-update and `update-many` paths now go through `_applyOneWallUpdate` -- writing the single case inline is what silently dropped door config.

**Doors.** A wall with an `entity` only occludes in one state. `_normalizeGlowWalls` stamps `_door: {entity, blocks_when}` onto every emitted segment (so a box/polyline door applies to all its sides), and `_wallBlocks(seg)` decides per frame. Domain semantics are explicit because "open" is spelled differently per domain and a door `binary_sensor` reads `on` when OPEN, so `blocks_when: closed` blocks on state `off`. Unavailable/unknown/missing entities BLOCK -- a plan springing a hole because a sensor dropped off the network is worse than one staying solid.

Three places have to know, or the feature is inert: `_prepareOccluders` skips non-blocking walls AND includes `_wallDoorStateKey()` in its cache key; `_visibilityPolygonCached`'s key includes it too (a door change alters no geometry, so `_wallGeomVersion` alone would serve a stale polygon); and `_isRelevantHassChange` watches `_wallDoorEntities()`, without which `updateLights` never runs on a door change and nothing redraws at all. The legacy mask path filters and keys on it as well. `_drawFieldWalls` draws open doors dashed at reduced alpha.

**Corners are joints.** `_wallJointsAt(point, rect)` collects every wall endpoint within 1.2 screen px of a point, and an endpoint drag moves all of them, so dragging the corner of a traced room does not tear it open. The dragged joint's wall indices go into `_wallDrawState.skip`, which `_snapWallPoint` accepts as a Set so the corner cannot endpoint-snap onto itself. A multi-wall drag commits as ONE `update-many` delta rather than N updates, so the editor writes history once and fires one `config-changed`; `_applyOneWallUpdate` resolves each item's index by geometry at the moment it is applied, which matters because exploding a box mid-batch shifts every later index.

**Teardown must never look like a user close.** `disconnectedCallback` deliberately does NOT call `overlay.close()`: removing the element already drops it from the top layer, and removal does not fire `close`, whereas `close()` DOES. Since HA replaces the preview card after every config change, that turned drawing one wall into a torn-down modal -- draw, save, preview replaced, the OLD card's teardown "closes" its dialog, `_exitWallMode` broadcasts `active:false`, the editor clears its state, and the replacement card asks and is told wall mode is off. A `_wallEditorTeardown` latch guards the `close` handler as well, cleared in `_renderAll` and `connectedCallback` so it cannot go stale and suppress a genuine dismissal.

`_exitWallMode()` is the single exit path, reached by Done, by Escape and by the dialog's own `close` event; the `cancel` handler swallows the FIRST Escape while a run is in progress so it ends the run rather than closing the editor.

`_wallSurface()` is the single seam that makes this work: every wall gesture already operates in canvas PERCENTAGES, so pointing `_wallPointFromEvent` and pointer capture at the overlay stage is enough for the same `_onWallPointerDown/Move/Up` handlers to drive it. `_drawWallEditor` reuses `_renderLightField(canvas, rect)` (parameterised for this) so you draw against the real diffusion, plus `_drawFieldWalls` and light-position dots. Canvases marked `data-css-sized` opt out of `_sizeFieldCanvas`'s inline CSS box pinning, since the overlay canvas is laid out by CSS.

Done (and a second Escape — the first ends a run) leaves wall mode entirely and broadcasts `active: false`, so the editor's switch and the card cannot disagree about whether it is armed.

## 8d. Plan rotation

`plan_rotation` (0/90/180/270, clockwise on screen) is a **view transform**, not a rewrite of the user's
coordinates. That choice is load-bearing, and the alternative was built first and thrown away.

**Why not rewrite the config.** Rotating every coordinate once looks cheaper — no gesture path changes at
all — but it has to enumerate every orientation-bearing value, and three of them are not in the config to
enumerate. `_normalizeGlowConfig` defaults `shape: 'cone'`/`direction: 0`, so `glow: {enabled: true}` — the
commonest glow config there is — carries no `direction` key and would keep pointing screen-down. `positions`
is `{}` in `getStubConfig` and `_initializePositions` invents the rest inside the CARD, so a rewrite in the
editor moves nothing for lights the user never dragged. And `getStubConfig` emits `icon_rotation: 0`, so
"rotate it if present" tilts every glyph on every UI-added card. On top of that, `_normalizeGlowLength`
clamps percents at 400% and inverting a numeric `aspect_ratio` is lossy (`1.6 → 0.63 → 1.59`), both
one-way doors. Under a view transform a missed site is a transient mis-registration that vanishes at 0°;
under a rewrite the same omission permanently corrupts a hand-placed layout.

**THE SEAM is `_wallPointFromEvent`.** It returns the pointer in PLAN coordinates and a PLAN-SPACE rect
(`_planSpaceRect`, dimensions swapped on a quarter turn). Because every wall gesture already worked in
canvas percentages against `pt.rect`, that one change puts wall snapping, `_wallJointsAt`, `_hitTestWall`,
`_hitTestLightOnStage`, the light-stage drags and the whole wall delta protocol into plan space with NO
edits — and keeps px tolerances isotropic on screen. Config therefore never sees a rotated coordinate,
which is why the delta protocol's identify-by-geometry still works.

**Emission rotates at `_getGlowConfig`**, the single resolver all four consumers call — so the legacy glow,
the light field and the wall editor cannot disagree, and defaults the normalizer filled in are covered.
`_getFieldEmitter` must NOT rotate them again. `direction` shares a sign with the plan turn: CSS `rotate()`
is clockwise on screen, so direction 90 points LEFT (the config comment claiming "90=right" is wrong —
measured). Offsets are applied OUTSIDE that rotate in the transform list, so they live in plan axes and
turn as a displacement, not an angle.

**The plan image turns on the existing `.canvas::before` layer**, so the markers, canvases and controls
stacked above it stay put. 180 is a plain `rotate(180deg)`. A quarter turn needs the layer sized to the
canvas' dimensions SWAPPED, and `width: 100cqh; height: 100cqw` under `container-type: size` is the only way
to say "the other axis" in CSS without measuring in JS. Measured: the layer's rotated box covers the canvas
exactly at all four rotations, `container-type: size` does NOT confine `position: fixed` descendants (it is
not the §8c containing-block trap), and the blend group survives so projected light still tints the plan.
`container-type` is applied ONLY on quarter turns, so the unrotated path keeps exactly the layout it had.
`.wall-editor-stage` got the same two-layer treatment — its background moved from the div to a `::before` —
so one set of rules serves both surfaces and they cannot face different ways.

**Three things must know, or the feature is subtly broken.** `_hashWalls` mixes in the rotation, because a
turn changes every wall's SCREEN geometry while leaving config alone and `_visPolyCache`'s only key is that
hash. `_viewAspectRatio` swaps an explicitly configured ratio, and `_applyBackgroundAspect`/`_wallEditorAspect`
swap the ratio probed from the (unrotated) image file — without that the canvas keeps its old shape while
its contents rotate into it, and percentages land sheared rather than turned. `getCardSize` reports the
turned shape so masonry reserves the right rows.

**`_planScale`** multiplies PERCENT-resolved glow sizes by the turned canvas' aspect. Percent resolves
against the canvas WIDTH, which the dashboard column fixes; turning a 2:1 plan leaves that width alone but
draws the plan twice as large, so an unscaled pool would cover half the room it used to. Measured: 120% at
0° needs 240% at 90° to light the same area. Applied at RESOLVE time so the normalizer's 400% cap cannot
clip it. Plain pixel numbers are deliberately not scaled.

**`rotateAngle` rounds AFTER the 360 wrap.** `% 360` re-introduces exactly the float error the rounding
removes (`372.34 % 360` is `12.339999999999975`), so rounding first fails the four-turn identity for 24128
of 36000 two-decimal angles. An integer test angle hides this completely — the regression test sweeps
36000 of them.

**Three leaks adversarial review found, all of the same shape: a site that reads one frame and writes the
other.** `_smoothApplyPositions` wrote raw PLAN percentages into `style.left/top` — screen percentages
everywhere else — so arrow-key nudge, undo, redo and Rearrange teleported every marker on a turned plan,
and because `_onPointerDown` latches `style.left` as the drag origin, the very next grab committed the
teleported value back to config. `_onWallPointerUp`'s tap-vs-draw threshold measured a PLAN-space draft
wall against the raw SCREEN rect, so each axis got the other's extent: on a quarter-turned 3:1 plan it was
3x too strict along one screen axis (discarding deliberate strokes) and 3x too lax along the other
(committing jitter as walls). The test for it asserts the property that matters — the threshold is
ISOTROPIC on screen, 5px horizontal == 5px vertical — not an absolute pixel count. And `_viewAspectRatio`
returns null when the shape comes from `canvas_height` alone, so the box never turned and coordinates
sheared into it; `_applyRotatedBoxFallback` turns it from the WRAPPER's width (reading the canvas' own
width would be circular — it is what we are about to change) and is guarded on `_viewAspectRatio()` being
null, a guard whose first version was missing and squashed a configured 3:1 plan to 77x13.

**The turned box comes from the plan's own ratio, and nothing else.** Two sources supply it and both
already swap: the plan image's intrinsic size (`_applyBackgroundAspect`, applied inline after the async
probe) and an explicit `aspect_ratio` (`_viewAspectRatio`, applied by the stylesheet). With neither, a
quarter turn has no shape to turn, and `_warnIfRotatedWithoutRatio` says so once rather than guessing.

Synthesising a box from `canvas_height` was built and then removed, and the reason is worth keeping.
That ratio is width-derived, so it could not be computed once — it needed a wrapper `ResizeObserver` to
survive HA's detached first render and later column resizes. That observer then fired after the image
probe resolved and **overwrote the perfectly good ratio the plan had already supplied**, rendering a 26:9
plan as 3:4 (`450 / 600`, i.e. `canvas_height / width`). The guard only knew about explicit `aspect_ratio`,
not about the image. An image ratio is width-independent, so once it is the only source the whole observer
disappears and resizes cannot stale it. Guessing a shape was strictly worse than asking for one.

The undo stacks stay valid across a rotation precisely because nothing they snapshot changes.

`.harness/load-card.js` loads the card class under node (stubbed DOM), which is what makes
`.harness/rot-math.test.js` a real unit test of the shipped primitives rather than a copy of the maths.

## 8a. Label legibility over the field

`.light-label` paints in TWO layers: `background-color: var(--label-ground)` (opaque) with `background-image: linear-gradient(var(--label-bg), var(--label-bg))` on top. `background-image` paints above `background-color`, so the theme's tint survives while the label is guaranteed opaque.

This exists because `--label-bg` is structurally translucent in the default `theme_mode: auto`: `--label-bg` → `--surface-elevated` → `color-mix(in srgb, var(--surface-primary) 87%, var(--text-primary))`, and `--surface-primary` is `var(--ha-card-background, ...)`. color-mix's result alpha is the weighted mean of its operands', so a glass theme with `--ha-card-background: rgba(255,255,255,0.08)` yields `0.87*0.08 + 0.13 = 0.1996` — a 20%-opaque label that the projected light reads straight through. `theme.glass: true` does the same thing deliberately (`--label-bg: color-mix(... 70%, transparent)`).

**Dimming never goes on `.light` itself.** Group `opacity` (and `filter`) on the marker composites its ENTIRE subtree, label included, so an opaque label background is powerless against it — an off light at `opacity: 0.55` renders its solid label at 55% and a neighbouring lamp's projected light shows straight through the name. The off / selected-off / unavailable / has-selection states therefore set `--light-dim` and `--light-desat` tokens, consumed by `.light::before`, `::after`, `.light-glow`, `.light-halo` and `.light-icon` — never by `.light-label` or `.light-status-badge`.

`filter` is deliberately NOT applied to the icon by that shared rule: `.light > .light-icon` (two classes) would outrank the icon's own `.light-icon-mdi` outline chain (one class) and wipe it, so icons dim by opacity only and `has-selection` sets a `--light-dim` as well as a `--light-desat` to compensate.

Icon glyphs in icon-only / minimal-ui are tinted `var(--light-color)`, i.e. the light's own colour, so they sit at zero contrast in the middle of that light's own pool. Stacked zero-offset `drop-shadow`s give them a tight dark outline (SVG cannot take `text-stroke`); literal colours, never `var()`-resolved, because iOS clips and caches those.

`--label-ground` is `var(--card-background-color, #141414)` in auto (the opaque sibling token glass themes leave alone) and a fixed hex in the dark/light palettes. Setting `theme.label_background` explicitly emits `--label-ground: transparent`, so a user who deliberately picks a translucent label still gets one.

## 8b. Background image sizing

`_normalizeBackgroundImage` gained `fit`, `rendering` and `auto_aspect`. Default `background-size` is now `contain` (was `cover`, which cropped every plan). With `auto_aspect` (default on) `_applyBackgroundAspect()` measures the image via a static `_imageSizeCache` shared across cards and sets `aspect-ratio` + `height:auto` **inline on `#canvas`** — not through `_renderAll`, so a late image load does not wipe the DOM and any in-flight gesture. It stands down only when the user sets `aspect_ratio` or `auto_aspect: false`. `canvas_height` deliberately does NOT veto it — `getStubConfig` used to stamp `canvas_height: 450` into every UI-added card, so treating it as a veto meant the fix never engaged for the commonest setup, and those users got letterbox bars from the new `contain` default instead of the old crop. `canvas_height` is now the fallback for "no image / probe failed / probe in flight", and `getStubConfig` no longer emits it.

Two hardening notes on the sweep: the angular step is floored at `PI/256` and the emitter frame clamped to 20000px, because `glow.width` is only validated as finite-and-positive and a value like 1e17 drove `2*acos(1 - 0.75/rPx)` to underflow to exactly 0 — an endless loop that hung the browser. And `_parseColorToRGB` now returns null instead of `{r:NaN,...}` for a 6-character non-hex string, which used to reach `addColorStop` as `rgba(NaN,...)` and throw. `_fieldFailed` un-latches on `setConfig` and forces a re-render so the legacy glow it displaced actually resumes.

---

## 9. Key Rendering Flow

```
setConfig(config)
  └─ if hass already set: _renderAll()

set hass(hass)
  ├─ first time: _renderAll()
  └─ otherwise + relevant change: updateLights()

_renderAll()
  ├─ _cancelActiveInteractions()
  ├─ _getControlContext()
  ├─ shadowRoot.innerHTML = template
  ├─ Cache _els.*
  ├─ Populate yamlOutput.textContent
  ├─ _attachEventListeners()
  ├─ _updateControlValues() (initial)
  ├─ updateLights()
  ├─ _refreshEntityIcons()
  ├─ _updateSeparatorVisibility() (rAF)
  └─ _subscribeTemplates() (with generation guard)

updateLights()
  ├─ Per .light: color, on/off, selected, unavailable + badge
  ├─ _getControlContext() + _updateControlValues()
  ├─ _refreshColorPresets()
  ├─ _refreshEntityIcons()
  ├─ _updateCanvasElements()
  ├─ _updateAllGlows()
  └─ _repositionLabels()
```

---

## 10. Class-level constants

- `SpatialLightColorCard.RGB_COLOR_MODES` — `Set` of color modes that mean "user picked an RGB color" (`hs`, `rgb`, `xy`, `rgbw`, `rgbww`).
- `SpatialLightColorCard.COLOR_TOLERANCE = 30` — sRGB Euclidean distance for live-color dedup and active-preset matching.
- `SpatialLightColorCard.TEMP_TOLERANCE = 100` — Kelvin tolerance for temperature dedup and matching.
