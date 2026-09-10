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

**Renderers:** `_renderControlsFloating(visible, controlContext)` and `_renderControlsBelow(controlContext)`. Both emit the same children: a 256×256 mini color wheel canvas, two `<input type="range">` sliders (brightness 0-255, temperature in `tempRange.min..max`), and a `.presets-row` = power toggle (`_renderPowerToggle`, gated by `show_power_button`) + `.power-separator` + `.presets-area`. The row carries `.has-presets` (set at render and kept in sync by `_refreshColorPresets`); without it the separator and the empty presets area are `display: none`, leaving just the toggle.

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
- `_updateControlValues(controlContext)` — full sync to averaged state, plus capability gating via `_getControlCapabilities()` (toggles `disabled` attribute on sliders, `.disabled` on color wheel, `.no-rgb-support`/`.no-temp-support`/`.no-brightness-support` on the controls container). The temperature slider's warm-to-cool gradient is a static CSS background — it's a visual affordance, not a precise color readout.

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

## 7. Color Wheel

`drawColorWheel()` (mini, 256×256) and `_drawLargeColorWheel()` (overlay, 512×512) render an HSV-ish wheel pixel-by-pixel using `lightness = 0.45 + (1 - sat) * 0.35`. Both are cached by size key on the canvas; the mini wheel auto-redraws via `ResizeObserver`.

**Hit testing:** `_getColorWheelColorAtEvent(e)` and `_getLargeWheelColorAtEvent(e)` use `getImageData(1×1)` with bounds clamped to `[0, canvas.width-1]` × `[0, canvas.height-1]` (Firefox throws `IndexSizeError` at the right/bottom edge otherwise).

**Long-press → large wheel:** A long-press on the mini wheel opens the overlay (`_openLargeColorWheel`). The synthetic click that fires when the user releases the long-press is suppressed via `_largeColorWheelSuppressClick`, which is cleared on the next document `pointerup` (in the next frame, so the synthetic click sees the flag).

---

## 8. Glow / Walls

Two renderers exist; exactly one is live at a time, decided by the `_fieldActive` getter (`light_field.enabled` + a 2D-canvas feature test).

**Sizes may be plan-relative.** `glow.width`, `glow.length` and `light_field.radius` accept a number (CSS px) or a `'NN%'` string. `_normalizeGlowLength` preserves the `%` form verbatim; `_resolveGlowLength(value, rect)` resolves it at paint time against the canvas WIDTH (not the diagonal or height, so a round pool stays round whatever the plan's aspect). Both renderers resolve: the field in `_getFieldEmitter`, the legacy path in `_updateGlow` via a resolved copy of `gc` — which is why `_updateAllGlows` now measures the canvas rect unconditionally, not just when walls exist. Pixels are inherently width-dependent (56% of the plan at 460px, 19% at 1360px), which is why the editor preview and the dashboard disagreed; percentages are width-invariant. Plain numbers stay px for back-compat; only `light_field.radius` defaults to `'19%'`, being new to this fork.

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

**Teardown must never look like a user close.** `disconnectedCallback` deliberately does NOT call `overlay.close()`: removing the element already drops it from the top layer, and removal does not fire `close`, whereas `close()` DOES. Since HA replaces the preview card after every config change, that turned drawing one wall into a torn-down modal -- draw, save, preview replaced, the OLD card's teardown "closes" its dialog, `_exitWallMode` broadcasts `active:false`, the editor clears its state, and the replacement card asks and is told wall mode is off. A `_wallEditorTeardown` latch guards the `close` handler as well, cleared in `_renderAll` and `connectedCallback` so it cannot go stale and suppress a genuine dismissal.

`_exitWallMode()` is the single exit path, reached by Done, by Escape and by the dialog's own `close` event; the `cancel` handler swallows the FIRST Escape while a run is in progress so it ends the run rather than closing the editor.

`_wallSurface()` is the single seam that makes this work: every wall gesture already operates in canvas PERCENTAGES, so pointing `_wallPointFromEvent` and pointer capture at the overlay stage is enough for the same `_onWallPointerDown/Move/Up` handlers to drive it. `_drawWallEditor` reuses `_renderLightField(canvas, rect)` (parameterised for this) so you draw against the real diffusion, plus `_drawFieldWalls` and light-position dots. Canvases marked `data-css-sized` opt out of `_sizeFieldCanvas`'s inline CSS box pinning, since the overlay canvas is laid out by CSS.

Done (and a second Escape — the first ends a run) leaves wall mode entirely and broadcasts `active: false`, so the editor's switch and the card cannot disagree about whether it is armed.

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
  ├─ ResizeObserver on color wheel
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
