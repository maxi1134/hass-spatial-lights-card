Made because controlling dozens of lightbulbs became otherwise impossible: it required infinite scrolling to find the right light or group.

This card allows arbitrary positioning and instant selection and control of dozens of lights on a 2D canvas.

[![Open your Home Assistant instance and open this repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Mihonarium&repository=hass-spatial-lights-card)

<img width="880" alt="Drag to select a group of lights on the floor plan, then recolor, dim, or switch them together" src="docs/demo.gif" />


# Spatial Lights Card for Home Assistant

The Spatial Lights Card lets you place many Home Assistant lights on a 2D canvas, for example, corresponding to their physical locations, making it easy to control arbitrary groups of entities with very few taps and little attention.

You can drag to draw a rectangle around lights, which you'll immediately be able to control as a group. You can toggle individual lights

Very useful when you have a lot of lights, and searching for the one you need by name and icon is tiresome; you can position the lights in a layout that corresponds to the physical room layout, making it easy to select the light you need. You can add a background image, e.g., with the room layout.


---

## What this fork adds

This is a fork of [Mihonarium/hass-spatial-lights-card](https://github.com/Mihonarium/hass-spatial-lights-card)
with a focus on making the plan itself do the work: real light on the floor
plan, walls that stop it, and controls that stay out of the way.

| | |
| --- | --- |
| **[Light diffusion](#light-diffusion-light_field)** | Every light paints onto one shared surface, so overlapping pools genuinely mix instead of stacking. Red over blue gives magenta, not two circles. |
| **[Walls and shadows](#glow-walls)** | Draw walls on the plan and light stops at them, with exact shadows solved by ray-casting — it wraps around a wall's end precisely where geometry says it should. |
| **[Doors](#doors--walls-that-open)** | A wall can be tied to a `binary_sensor`, so it blocks light only while the door is shut. |
| **[Uncropped plans](#background-image)** | The canvas adopts your plan's own aspect ratio, so nothing is cropped, stretched or letterboxed at any card width. |
| **[Rotating the plan](#-rotating-the-plan)** | Turn the whole layout 90/180/270°: lights, zones, walls, image and emission directions together. Non-destructive — nothing you placed is rewritten. |
| **[The full-size editor](#-the-full-size-editor)** | Draw walls and place lights on a near-fullscreen plan instead of a 250px preview pane. |
| **[Colour bars](#colour-bars)** | The colour wheel is replaced by four full-width bars: brightness, saturation, hue, temperature. Easier to aim than a 128px circle. |
| **[Draggable controls](#overlaid-controls)** | Overlaid controls can be dragged anywhere on the plan, remember where you put them, and compress on narrow cards. |
| **[Script buttons](#script-buttons)** | Run any script, scene or service against the lights you have selected, from a button in the controls. |

Plus: plan-relative (`%`) glow sizes so a plan looks the same at every card
width, a configurable control-bar height, and light labels that stay legible
over projected light.

---

## Table of Contents

1. [What this fork adds](#what-this-fork-adds)
2. [Features](#features)
3. [Installation](#installation)
4. [Quick Start](#-quick-start)
5. [Usage](#-usage) — Selecting, toggling, colour bars, sliders, presets, moving lights, keyboard shortcuts
6. [Configuration Reference](#-all-configuration-options)
7. [Custom Colors & Backgrounds](#-custom-colors--backgrounds)
8. [Effect Presets](#-effect-presets) — Quick-apply named light effects with filtering
9. [Adaptive Lighting](#-adaptive-lighting) — Hand selected lights back to the Adaptive Lighting integration
10. [Glow Effects](#-glow-effects) — Light diffusion, shapes, walls, doors, custom polar shapes, per-entity overrides
11. [Rotating the Plan](#-rotating-the-plan) — Quarter turns of the whole layout
12. [The Full-Size Editor](#-the-full-size-editor) — Draw walls and place lights on a big plan
13. [Canvas Elements](#canvas-elements) — Links, sensors, and template elements on the canvas
14. [Custom CSS](#-custom-css) — Global and per-entity style customization
15. [Visual Layout Options](#-visual-options)
16. [Theming](#-theming)
17. [Troubleshooting](#troubleshooting)

---

## Features

- Interactive 2D layout to position lights exactly where they are in a room.
- Multi-select and batch control color, brightness, and temperature.
- Support for Scenes, Switches, Binary Sensors, and Input Booleans with customizable display colors.
- Background image support (URL, size, blend modes).
- Optional default entity for whole-room adjustments.
- Toggleable floating/below controls to match your dashboard style.
- Glow effects with multiple shapes (cone, round, oval, beam, spotlight, bar, custom polar) and wall occlusion.
- Light diffusion: additive colour mixing on one shared surface, with exact ray-cast shadows.
- Drawable walls, and doors that stop blocking light when an entity says they are open.
- Plan rotation in quarter turns, applied as a view transform so your coordinates are never rewritten.
- A full-size editor for drawing walls and placing lights.
- Four full-width control bars (brightness, saturation, hue, temperature) at a configurable height.
- Overlaid controls you can drag, that remember their position and compress on narrow cards.
- Script buttons that run a script, scene or service against the current selection.
- Canvas elements: place sensor readouts, navigation links, and text labels alongside your lights.
- Icon rotation, mirroring, and per-entity style customization.
- Effect presets: quick-apply named effects (e.g., colorloop, fireplace) with per-preset light restrictions and filtering.
- Custom CSS injection for full visual control.

---

## Installation

### Via HACS (Recommended)
1. [![Open your Home Assistant instance and open this repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Mihonarium&repository=hass-spatial-lights-card)
2. Install the card and reload your browser when prompted.

### Manual Installation

```bash
# Copy file
cp hass-spatial-lights-card.js /config/www/

# Add to resources: open Settings → Dashboards → (three dots) → Resources to add via UI. Alternatively, add the following to configuration.yaml:
resources:
  - url: /local/hass-spatial-lights-card.js
    type: module

```

---

## 🎯 Quick Start

1. Install the resource using one of the methods above.
2. Edit a dashboard.
3. Choose **Add card → Spatial Lights Color Card**.

**You're all set!** 🎉

---

## 🎨 Usage

### Selecting Lights

| Action | Desktop | Mobile |
|--------|---------|--------|
| Select a single light | Click | Tap |
| Add/remove from selection | Shift+Click, Ctrl+Click, or Cmd+Click | — |
| Select area (marquee) | Click and drag on empty canvas | Drag on empty canvas (a near-vertical drag scrolls instead — start at an angle, or hold ~0.3 s first) |
| Add area to selection | Shift/Ctrl/Cmd + drag on empty canvas | — |
| Select all lights | Ctrl+A / Cmd+A | — |
| Deselect all | Click/tap empty canvas, or press Escape | Tap empty canvas |

When lights are selected, the colour bars, brightness slider, and temperature slider control all selected lights as a group. If you have a **default entity** configured, the controls affect that entity when nothing is selected.

> **Note:** On touch devices the card shares the canvas with page scrolling: a drag on empty canvas that starts **near-vertically** (within ~22° of straight up/down) scrolls the dashboard, while any other drag draws the selection box — and once the box has started, it can travel in any direction without being interrupted. For a deliberately vertical box, hold your finger still for a moment first (a short vibration confirms it), then drag. Pinch-zoom always works. Set `canvas_touch_scroll: false` to reserve every canvas touch for selection instead.

### Toggling Lights On/Off

| Action | Desktop | Mobile |
|--------|---------|--------|
| Toggle a light | Double-click | Double-tap |
| Toggle a switch/scene | Double-click (or single click if `switch_single_tap` is on) | Double-tap (or single tap if `switch_single_tap` is on) |
| Turn the whole selection on/off | Power button below the bars | Power button below the bars |

> **Note:** If `switch_single_tap` is enabled, switches and scenes activate immediately on a single tap/click instead of being selected.

The **power button** sits at the start of the presets row — under the sliders on desktop, beside the colour bars on mobile — so the sliders keep their full width. It acts on whatever the sliders control: the selected lights, or the default entity when nothing is selected. It is filled when every one of them is on (pressing turns them all off), outlined when only some are on (pressing turns the rest on), and neutral when all are off. Hide it with `show_power_button: false`.

### Opening Light Details

| Action | Desktop | Mobile |
|--------|---------|--------|
| Open more-info panel | Long-click (~650 ms) or right-click | Long-press (~500 ms) |

The more-info panel is the standard Home Assistant entity dialog where you can see attributes, history, and settings.

### Colour bars

The controls are four stacked full-width bars:

1. **Brightness** — the bar is filled with the colour the lights are showing
   right now; sliding left to right sets the brightness.
2. **Tint** — the pure hue on the left running to white on the right.
3. **Hue** — the full spectrum.
4. **Temperature** — warm on the left, cool on the right.

- **Tap/click** anywhere along a bar to jump straight to that value.
- **Drag** to sweep; the lights follow live, throttled to about seven updates a
  second so a long drag doesn't flood the connection.
- **Arrow keys** step whichever bar has focus.
- **Height** is configurable: `color_bar_height` (px, default 34), or the
  **Control Bar Height** slider in the editor's **Display** section.
- On mobile, starting a vertical scroll on a bar releases it so the page can
  scroll, rather than the bar swallowing the gesture.

These four replaced the colour wheel and the separate brightness and
temperature sliders. There is no magnifier or full-screen picker any more
either: a bar running the full width of the controls has nothing left to aim
at. The numeric readouts (the brightness percentage and the Kelvin value) went
with the old sliders — ask if you want them back.

### Script buttons

Add buttons to the controls that run a script against the lights you have
selected:

```yaml
script_buttons:
  - script.flash_lights            # shorthand: icon and label are derived
  - script: script.wind_down
    name: Wind down
    icon: mdi:weather-night
  - script: scene.turn_on          # scenes are activated through scene.turn_on
    name: Movie
    icon: mdi:movie
    pass_entities: false           # do not send the selection...
    data:
      entity_id: scene.movie_night # ...send the scene instead
```

The script receives the entities as `entity_id`, so a script like this gets
exactly the lights you had selected:

```yaml
flash_lights:
  fields:
    entity_id:
      selector: {entity: {multiple: true}}
  sequence:
    - service: light.turn_on
      target: {entity_id: "{{ entity_id }}" }
      data: {flash: short}
```

| key | default | meaning |
| --- | --- | --- |
| `script` | required | Any callable `domain.service`. Home Assistant gives every script its own service (`script.my_script`), so scripts can be named directly; scenes and automations are activated through `scene.turn_on` / `automation.trigger` with the entity in `data`. `service:` works as an alias for this key. |
| `name` | from the service id | Button label and tooltip. |
| `icon` | `mdi:script-text-play` | Any mdi icon. |
| `target_key` | `entity_id` | The variable name the entities arrive under. |
| `data` | none | Fixed arguments merged into the call. |
| `pass_entities` | `true` | Set `false` to send no entities at all. |

With nothing selected the button falls back to `default_entity`, and failing
that to every entity on the card (not only lights) — the same widening the
effect presets use. Unavailable entities are dropped before the call, and if
nothing is left the button does nothing.

They can also be managed in the visual editor: the **Presets** section has a
**Script Buttons** list with an entity picker for your `script.*` and `scene.*`
entities, so you never have to touch YAML for this.

### Overlaid controls

With `controls_below: false` the controls float over the plan.

- **Drag them** by the grip at the top to put them wherever suits your plan.
  The position is remembered per card, in your browser, and survives
  reloads and resizes.
- **Keyboard**: focus the grip and use the arrow keys to nudge it (hold Shift
  for bigger steps), or Escape to go back to automatic placement.
- **Double-click the grip** to go back to automatic placement.
- Left alone, they anchor to whichever end the selection is **not** at —
  select a light near the bottom and they move to the top.
- They **compress** on a narrow card, shrinking their padding and wrapping
  the presets rather than spilling past the plan.

Setting `default_entity` keeps them on screen permanently, since it names the
light they act on when nothing is selected. If that puts them in your way,
drag them.

### Color Presets & Live Colors

- **Click/tap** a preset circle to apply that color to all selected lights.
- **Hover** over a preset (desktop) to temporarily highlight which lights on the canvas currently have that color.
- **Long-press** a preset (~300 ms, mobile) to highlight which lights have that color. Release to clear the highlight.
- When all selected lights share the same color as a preset, that preset shows a subtle active ring indicator.
- **Live colors** (when `show_live_colors` is enabled) show the colors currently in use by your lights, automatically deduplicated.
- **Live temperatures** appear as a separate group. A thin vertical separator line divides color presets from temperature presets when they are on the same row.

### Moving Lights on the Canvas

Lights are **locked** by default. To reposition them:

1. Open the card editor (pencil icon on the dashboard).
2. Toggle **Edit Positions** in the card settings.
3. Drag lights to their new positions on the preview — changes flow into the editor automatically; press **Save** to persist them.

| Action | Desktop | Mobile |
|--------|---------|--------|
| Move a light | Drag | Drag |
| Snap to grid | Hold **Alt** while dragging | — |
| Nudge selected lights | Arrow keys (moves 0.5% per press) | — |
| Fine nudge | Alt + Arrow keys (moves 1% per press) | — |
| Undo move | Ctrl+Z / Cmd+Z | — |
| Redo move | Ctrl+Y / Cmd+Shift+Z | — |

Position history stores up to 50 steps.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+A / Cmd+A | Select all lights |
| Escape | Deselect all / close colour bars / close dialogs |
| Ctrl+Z / Cmd+Z | Undo position change |
| Ctrl+Y / Cmd+Shift+Z | Redo position change |
| Arrow keys | Nudge selected lights (when positions unlocked) |
| Alt + Arrow keys | Fine-nudge selected lights |
| Enter | Activate the focused light, preset or canvas element |
| Space | Toggle the focused entity on/off, or activate a focused preset |

### Desktop vs Mobile Differences

- **Layout:** the controls are a single stacked column at every width — four full-width bars, then the power button and presets. They compress (padding, gaps, preset wrapping) as the card narrows.
- **Preset highlighting:** On desktop, hovering over a preset highlights matching lights. On mobile, you need to long-press (~300 ms) the preset.
- **Light size:** On mobile, light circles are capped at 50 px regardless of the configured `light_size`.
- **Floating controls:** On desktop, floating controls are centered. On mobile, they stretch edge-to-edge with padding.
- **Multi-select modifiers** (Shift/Ctrl/Cmd) are only available on desktop.

### 💡 Tips

1. Click/tap empty space on the canvas to deselect all lights.
2. Add a **Default Entity** containing all of a room's lights to control the whole room when nothing is selected.
3. Add **color presets** to quickly apply favorite colors with a single tap.
4. Enable **live colors** to see and reuse colors already present in the room.
5. Hover over a preset (or long-press on mobile) to see which lights currently have that color.
6. Use **Ctrl+A** to quickly select all lights for batch adjustments.
7. Right-click (or long-press on mobile) any light to open its full detail panel.

---

## 📋 All Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `title` | string | `""` | Card title. When empty, the header is hidden entirely. |
| `entities` | list | **required** | Entities (lights, switches, input_booleans, scenes) to display. |
| `positions` | map | `{}` | Per-entity x/y positions from 0–100 (percentage). |
| `canvas_height` | number | `450` | Canvas height in pixels. Used when no background image supplies a ratio (and as the fallback while the image loads). Ignored when `aspect_ratio` is set or auto-aspect is active. |
| `aspect_ratio` | string | `null` | Optional `"W:H"` (e.g. `"16:9"`, `"1200x800"`). The canvas derives its height from its width so positions stay glued to a floor-plan background at any card width. Usually unnecessary — a background image supplies its own ratio. |
| `light_field` | map/bool | `{enabled: false}` | Shared-canvas light diffusion: colours merge additively and walls cast real shadows. See [Light Diffusion](#light-diffusion-light_field). |
| `plan_rotation` | number | `0` | Quarter turn of the whole layout: `0`, `90`, `180` or `270`, clockwise. A view setting — your coordinates are never rewritten. See [Rotating the Plan](#-rotating-the-plan). |
| `grid_size` | number | `25` | Grid spacing in pixels when snapping. |
| `label_mode` | string | `"smart"` | Light label style: `smart` (compact abbreviation), `full` (alias `friendly_name`), `initials`, `entity_id`, `none`. |
| `canvas_touch_scroll` | boolean | `true` | Vertical touch swipes on the canvas scroll the page (marquee needs a sideways drag). Set `false` to reserve all canvas touches for selection. |
| `theme_mode` | string | `"auto"` | `auto` follows your HA theme (including glass themes), `dark` keeps the card's original dark palette, `light` is a fixed light palette. |
| `theme` | map | `{}` | Fine-grained appearance overrides — see [Theming](#-theming). |
| `label_overrides` | map | `{}` | Map entity_id → custom label. |
| `color_overrides` | map | `{}` | Map entity_id → colour string, or object with `state_on` / `state_off` (`on` / `off` are accepted as aliases). |
| `switch_on_color` | string | `"#ffa500"` | Default color for active switches. |
| `switch_off_color` | string | `"#3a3a3a"` | Default color for inactive switches. |
| `scene_color` | string | `"#6366f1"` | Default color for scenes. |
| `always_show_controls` | boolean | `false` | Show the controls even when nothing is selected. (`default_entity` also keeps them up.) |
| `color_bar_height` | number | `34` | Height of the four control bars, in px. Clamped to 12–120. |
| `script_buttons` | list | `[]` | Buttons in the controls that run a script, scene or service against the selection. See [Script buttons](#script-buttons). |
| `show_power_button` | boolean | `true` | Round on/off button at the start of the presets row (under the sliders on desktop, beside the colour bars on mobile) that toggles the selected lights (or the default entity) as a group. Filled = all on (press turns off); outlined = some on (press turns the rest on). |
| `minimal_ui` | boolean | `false` | Hides light circles; shows only icons. Automatically enables `icon_only_mode`. |
| `controls_below` | boolean | `true` | Render controls below (`true`) or floating over (`false`). |
| `default_entity` | string | `null` | Light the controls act on when nothing is selected; also keeps them on screen. Drag them by their grip if they are in the way. |
| `switch_single_tap` | boolean | `false` | Toggle switches/scenes with a single tap instead of selecting them. |
| `show_entity_icons` | boolean | `true` | Show MDI icons inside the light circles. |
| `icon_style` | string | `"mdi"` | Icon style (`mdi` or `emoji`). |
| `light_size` | number | `56` | Size of light circles in pixels. On mobile (≤768 px viewport), the rendered size is capped at 50 px regardless of this value. |
| `icon_only_mode` | boolean | `false` | Display lights as icons only (no filled circles). |
| `icon_rotation` | number | `0` | Global icon rotation in degrees (0–360). |
| `icon_rotation_overrides` | map | `{}` | Per-entity icon rotation overrides (e.g., `light.lamp: 90`). |
| `icon_mirror` | string | `"none"` | Global icon mirroring: `none`, `horizontal`, `vertical`, or `both`. |
| `icon_mirror_overrides` | map | `{}` | Per-entity icon mirror overrides (e.g., `light.lamp: "horizontal"`). |
| `size_overrides` | map | `{}` | Per-entity size overrides (e.g., `light.lamp: 40`). |
| `icon_only_overrides` | map | `{}` | Per-entity icon-only mode overrides (e.g., `light.lamp: true`). |
| `background_image` | string/map | `null` | URL string, or object `{url, fit, size, position, repeat, blend_mode, opacity, rendering, auto_aspect}`. `opacity` accepts 0–1; `repeat` takes any CSS `background-repeat`. See [Background Image](#background-image) for `fit`, `rendering` and `auto_aspect`. |
| `color_presets` | list | `[]` | Hex color strings to show as quick-select circles (e.g., `["#ff0000", "#00ff00"]`). |
| `show_live_colors` | boolean | `false` | Show the current colors of your lights as additional preset circles. |
| `effect_presets` | list | `[]` | Named effect presets with icons and optional light restrictions (see [Effect Presets](#-effect-presets)). |
| `effect_filter_default` | string | `"any"` | Effect visibility when nothing selected: `any` (show if any light supports it) or `all` (only if all lights support it). |
| `effect_filter_selected` | string | `"all"` | Effect visibility when lights are selected: `any` or `all`. |
| `adaptive_lighting` | boolean/map | `false` | Adaptive-lighting toggle button among the effect presets; needs the [Adaptive Lighting](https://github.com/basnijholt/adaptive-lighting) integration. `true` enables it (switch auto-detected); a map with `enabled: true` pins the switch and tunes the call (see [Adaptive Lighting](#-adaptive-lighting)). |
| `binary_sensor_on_color` | string | `"#4caf50"` | Default color for binary sensors in the `on` state. |
| `binary_sensor_off_color` | string | `"#2a2a2a"` | Default color for binary sensors in the `off` state. |
| `temperature_min` | number | `null` | Override minimum Kelvin for temperature slider. |
| `temperature_max` | number | `null` | Override maximum Kelvin for temperature slider. |
| `temperature_range` | list/map | `null` | Alternate spelling for the two above. Accepts either `[min, max]` (e.g. `[2200, 6500]`) or `{min: 2200, max: 6500}`. If both forms are provided, the explicit `temperature_min`/`temperature_max` win. |
| `glow` | map | `{}` | Glow effect configuration (see [Glow Effects](#-glow-effects) section). |
| `glow_overrides` | map | `{}` | Per-entity glow overrides (e.g., `light.lamp: {direction: 180}`). |
| `glow_walls` | list | `[]` | Line segments or boxes that block glow expansion (see [Glow Walls](#glow-walls)). |
| `canvas_elements` | list | `[]` | Non-entity elements on the canvas (links, sensors, templates). See [Canvas Elements](#canvas-elements). |
| `custom_css` | string | `""` | Custom CSS injected into the card's shadow DOM. |
| `style_overrides` | map | `{}` | Per-entity inline CSS style overrides (e.g., `light.lamp: "filter: blur(2px);"`). |

> ℹ️ **Label modes:** `smart` **abbreviates** the friendly name to 2–3 letters ("Kitchen Ceiling Light" — KC), disambiguating trailing numbers and direction words. Use `full` if you want the whole friendly name, and `label_overrides` for individual entities. Override individual entities with `label_overrides`.

---

## 🖌 Custom Colors & Backgrounds

### Global Colors
Customize the default appearance of non-light entities by setting the Switch On Color, Switch Off Color, and Scene Color.
<!--```yaml
switch_on_color: "#00ff00"
switch_off_color: "#ff0000"
scene_color: "#55aaff"
```-->


### Color Presets

Add quick-select color circles next to the colour bars so you can apply frequently used colors with a single tap.
<!--```yaml
color_presets:
  - "#ff0000"
  - "#00ff00"
  - "#0000ff"
  - "#ff8800"
  - "#e040fb"
```-->
<img height="171" alt="image" src="https://github.com/user-attachments/assets/e045c141-7206-4d0d-a8ad-af676cd2b2aa" />

<br/><br/>

Enable **Show Live Colors** to also display the current colors of your lights as preset circles. When hovering a preset (or long-pressing on mobile), the lights that currently have that color are highlighted on the canvas. If all controlled lights share the same color, the matching preset shows a subtle ring indicator.

<!--```yaml
color_presets:
  - "#ff0000"
  - "#00ff00"
show_live_colors: true
```-->

### Individual Overrides

Have a switch or some other entity that you want to have a specific color when it's on/off?

<img width="41" height="40" alt="image" src="https://github.com/user-attachments/assets/19080d4d-49a9-4f0a-9ead-47c25f61027b" />

Use Color Overrides. You can provide a single color (applied when "on") or specific colors for both states. (Above is the override with #02fae9 for state_on.)

<!--```yaml
color_overrides:
  # Simple string = On color
  scene.movie_night: "#a855f7"
  switch.kitchen_fan: "#00ff00"

  # Object = Specific state colors
  switch.hallway:
    state_on: "#ffffff"
    state_off: "#444444"
```-->

### Background Image
Add a floorplan or texture behind your lights.
```yaml
background_image:
  url: "/local/floorplan.png"
```

That is the whole configuration for a floor plan. The canvas measures the image
and adopts its aspect ratio, so the plan fills the canvas **exactly** — never
cropped, never letterboxed, never squashed — and a light placed over the sofa on
desktop stays over the sofa on a phone.

| Key | Default | Meaning |
|-----|---------|---------|
| `url` | — | Image URL (`/local/...`, `/api/image/serve/...`, or absolute) |
| `auto_aspect` | `true` | Canvas takes the image's intrinsic aspect ratio (overridden only by `aspect_ratio`) |
| `fit` | `contain` | `contain`, `cover` (crops), `stretch` (or `fill`, distorts), `native` (or `auto`, the image's own pixel size) |
| `rendering` | `auto` | CSS `image-rendering` — use `pixelated` for hand-drawn or low-resolution plans |
| `size` | — | Raw CSS `background-size`; overrides `fit` when set |
| `position` / `repeat` / `blend_mode` / `opacity` | CSS defaults | Passed straight through |

Auto-aspect steps aside as soon as you pin the geometry yourself — set
`aspect_ratio`, or `auto_aspect: false`:

```yaml
# Pin the geometry yourself instead
background_image:
  url: "/local/floorplan.png"
  auto_aspect: false
canvas_height: 520
```

`canvas_height` does **not** override auto-aspect; it is the fallback for when
there is no plan image, or the image fails to load. (Cards added through the UI
used to always carry a `canvas_height`, which would have meant the fix never
engaged for them.)

> **Upgrading:** if you previously matched `aspect_ratio` to your image by hand,
> nothing changes. If you did not, your canvas now takes the plan's ratio rather
> than a fixed height, so the whole plan becomes visible and your light
> positions land on the plan features their percentages always referred to —
> under the old `cover` default the plan was cropped, so they didn't. Set
> `auto_aspect: false` and `fit: cover` to keep the previous look exactly.

### Light Size
Customize the size of light circles globally or per-entity.

<!--```yaml
# Global size (default is 56px)
light_size: 40

# Per-entity sizes
size_overrides:
  light.ceiling: 70    # Make ceiling light larger
  light.accent: 30     # Make accent light smaller
```-->

### Icon-Only Mode

Display lights as icons without the filled circle background. Icons show the light's color when on and remain visible (dimmed) when off.

Also experiment with Minimal UI.

<!--```yaml
# Enable for all lights
icon_only_mode: true

# Or per-entity
icon_only_overrides:
  light.ceiling: true      # Icon-only for ceiling
  switch.fan: true         # Icon-only for fan switch
  light.floor_lamp: false  # Keep filled circle for floor lamp
```-->

When icon-only mode is enabled:
- Icons are colored based on the light's state
- A subtle border ring shows the light's color when on
- Off lights remain visible with a dimmed appearance
- Great for cleaner layouts or when using background images

---

## ✨ Effect Presets

Add quick-apply buttons for named light effects (e.g., colorloop, fireplace, candle). Each preset shows as a labeled icon button alongside color presets.

### Basic Usage

```yaml
effect_presets:
  - effect: colorloop
    icon: mdi:palette
  - effect: fireplace
    icon: mdi:fireplace
```

### Preset Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `effect` | string | **required** | The effect name (must match the light's `effect_list`). |
| `icon` | string | `"mdi:auto-fix"` | MDI icon displayed on the button. |
| `lights` | list | `[]` (all) | Restrict this effect to specific entities. When empty, the effect applies to all canvas entities that support it. |
| `filter_default` | string | `""` (use global) | Per-preset override for visibility when nothing is selected: `any`, `all`, or empty to use the global `effect_filter_default`. |
| `filter_selected` | string | `""` (use global) | Per-preset override for visibility when lights are selected: `any`, `all`, or empty to use the global `effect_filter_selected`. |

### Filtering Logic

Effect presets are only shown when relevant. Two global settings control visibility:

- **`effect_filter_default`** (default: `any`): When nothing is selected, show the effect if **any** canvas entity supports it.
- **`effect_filter_selected`** (default: `all`): When lights are selected, show the effect only if **all** selected lights support it.

Each preset can override the global mode with its own `filter_default` / `filter_selected`.

### Light Restrictions

Use `lights` to restrict which entities an effect applies to. This is useful when an effect is only available on certain lights:

```yaml
effect_presets:
  - effect: colorloop
    icon: mdi:palette
    lights:
      - light.led_strip_1
      - light.led_strip_2
    filter_default: any
  - effect: fireplace
    icon: mdi:fireplace
    lights:
      - light.table_lamp
    filter_default: all
    filter_selected: all
```

- **Visibility**: A preset with a `lights` restriction is only shown when at least one restricted light is in the current pool (all entities when nothing selected, or the selected lights).
- **Applying**: When clicked, the effect is applied to the intersection of the selected lights and the restriction. With no selection, it applies to all restricted lights.

### Active Indicator

When all controlled lights share the same active effect, the matching preset button shows a ring indicator — the same behavior as color presets.

Effect presets can be configured in the visual editor's **Presets** section.

---

## 🌗 Adaptive Lighting

If you run the [Adaptive Lighting](https://github.com/basnijholt/adaptive-lighting) custom integration (HACS), the card can show an extra effect-style **toggle button** that hands the selected lights to adaptive control — brightness and color temperature follow the sun — or pauses it again.

**Requires the integration**: the card itself doesn't compute sun-based brightness; it drives the integration's services. Enable the button with `adaptive_lighting: true` (or the switch in the visual editor's **Presets** section, which also tells you which Adaptive Lighting switches it found). The `switch.adaptive_lighting_*` main switch is auto-detected, so that one line is all you need when you have a single Adaptive Lighting configuration.

**What a press does** (to the selected lights, or all card lights when nothing is selected):

- **Not adapted → enable.** Calls `adaptive_lighting.set_manual_control` with `manual_control: false` for the pressed lights that the switch manages — Adaptive Lighting marks a light "manually controlled" and stops adapting it the moment you touch its brightness or color (e.g. with this card's sliders); this un-marks them so continuous adaptation resumes. Then calls `adaptive_lighting.apply` so the current adaptive brightness/color land immediately — including on lights the switch doesn't manage, which get a one-shot adaptation.
- **Adapted (button lit) → pause.** Calls `adaptive_lighting.set_manual_control` with `manual_control: true`, so the lights hold their current values and Adaptive Lighting leaves them alone — the same thing it does by itself when you adjust a light by hand. Press again to resume; turning a light off and on also hands it back to Adaptive Lighting.

**Lit state**: the button shows the ring indicator when every targeted light is currently under adaptive control (switch on, light managed, not marked manually controlled) — that is also when a press pauses instead of enables. Hovering (or long-pressing on touch) highlights the card lights being adapted right now.

### Configuration

```yaml
adaptive_lighting: true   # that's it for the common case
```

All options:

```yaml
adaptive_lighting:
  enabled: true              # required to show the button
  switch: switch.adaptive_lighting_living_room  # pin a switch; auto-detected when omitted
  name: Adaptive             # button label/tooltip
  icon: mdi:theme-light-dark # button icon
  turn_on_lights: false      # apply also turns on lights that are off
  transition: 2              # seconds, passed to adaptive_lighting.apply
  adapt_brightness: true     # let apply adjust brightness
  adapt_color: true          # let apply adjust color temperature
  prefer_rgb_color: false    # prefer RGB over color temp when applying
  clear_manual_control: true # false = enabling is a one-shot apply that doesn't un-pause the lights
```

**Multiple Adaptive Lighting configurations**: with several main switches and no `switch:` configured, the card picks the switch managing the most of the card's lights (read from the switch's `configuration` attribute). If none of them overlaps, the button is hidden — set `switch:` explicitly.

The visual editor exposes the essentials under **Presets → Adaptive Lighting button** (on/off, switch, turn-on-lights); the remaining options are YAML-only.

---

## 💡 Glow Effects

Add beautiful, customizable glow effects behind your light entities. Glows respond to entity state — they light up when the entity is on and dim when off. Glow works with lights, switches, binary sensors, and input booleans.

### Basic Usage

Enable glow in the visual editor's **Light Projection** section, or in YAML:

```yaml
glow:
  enabled: true
```

### Glow Shapes

| Shape | Description |
|-------|-------------|
| `cone` | Directional cone emanating from the entity (default). |
| `semicone` | Cone that starts with a configurable width instead of a point. Use `start_width` to control. |
| `round` | Circular radial glow centered on the entity. |
| `oval` | Elliptical glow, rotatable with `direction`. |
| `beam` | Narrow directional beam (minimal spread). |
| `spotlight` | Wide directional cone with inherent edge softness. |
| `bar` | Rectangular linear gradient. |
| `custom` | Arbitrary shape defined by polar coordinates (see [Custom Shapes](#custom-shapes)). |

### Glow Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable glow for all entities. |
| `shape` | string | `"cone"` | Glow shape (see table above). |
| `direction` | number | `0` | Direction in degrees, clockwise from down: 0 = down, 90 = **left**, 180 = up, 270 = **right**. (The shape is drawn pointing down and rotated clockwise, so 90 lands on the left.) |
| `length` | number or `'NN%'` | `80` | Glow length/diameter in pixels. |
| `width` | number or `'NN%'` | `60` | Glow width in pixels. |
| `intensity` | number | `0.7` | Maximum opacity (0–1). |
| `blur` | number | `12` | Blur radius in pixels for soft edges. |
| `offset_x` | number | `0` | Horizontal offset from entity center (px). |
| `offset_y` | number | `0` | Vertical offset from entity center (px). |
| `spread` | number | `1.5` | Far-end width multiplier (1 = no spread). |
| `start_width` | number | `0` (`0.35` for `semicone`) | Origin width fraction (0–1). 0 = pointed, 1 = full width. `semicone` substitutes 0.35 when this is 0 — a semicone with a pointed origin is just a cone. |
| `edge_softness` | number | `0` | Edge feathering (0–1). Higher values produce softer, more organic edges. |
| `falloff` | string | `"smooth"` | Gradient curve: `smooth`, `linear`, `exponential`, `sharp`, or `uniform`. |
| `scale_with_brightness` | boolean | `true` | Scale glow opacity with entity brightness. |
| `color` | string | `null` | Override glow color. `null` = use entity's current color. |
| `gradient_stops` | list | `null` | Custom gradient: `[[position%, opacity], ...]` (min 2 stops). |
| `custom_shape` | list | `null` | Polar coordinates for `custom` shape (see below). |

### Example Configurations

**Soft round glow:**
```yaml
glow:
  enabled: true
  shape: round
  intensity: 0.5
  blur: 20
  edge_softness: 0.8
  falloff: smooth
```

**Directional cone pointing left:**
```yaml
glow:
  enabled: true
  shape: cone
  direction: 90
  length: 120
  width: 80
  spread: 2.0
```

**Semicone (starts wide, expands further):**
```yaml
glow:
  enabled: true
  shape: semicone
  start_width: 0.4
  direction: 0
  length: 100
```

### Custom Shapes

Define arbitrary glow shapes using polar coordinates. Each point is `[angle_degrees, radius]` where:
- **Angle**: 0° = down, 90° = right, 180° = up, 270° = left (clockwise)
- **Radius**: 0 = center, 1 = full extent (can go up to 2)

Points are cosine-interpolated for smooth curves. Minimum 3 points required.

```yaml
glow:
  enabled: true
  shape: custom
  edge_softness: 0.6
  custom_shape:
    - [0, 1.0]     # Full extent downward
    - [90, 0.5]    # Half extent to the right
    - [180, 0.3]   # Short upward
    - [270, 0.5]   # Half extent to the left
```

### Falloff Modes

| Mode | Description |
|------|-------------|
| `smooth` | Smooth hermite curve (default). Natural-looking falloff. |
| `linear` | Linear gradient from full opacity to zero. |
| `exponential` | Rapid falloff near the edges, concentrated near the center. |
| `sharp` | Hard center with abrupt edge transition. |
| `uniform` | Solid color fill with no gradient (use `edge_softness` for soft edges). |

### Per-Entity Glow Overrides

Override glow settings per entity using `glow_overrides`. Any parameter from the glow config can be overridden:

```yaml
glow:
  enabled: true
  shape: cone
  direction: 0

glow_overrides:
  light.ceiling:
    shape: round
    intensity: 0.9
  light.wall_sconce:
    direction: 90      # Points left (clockwise from down)
    length: 150
  light.floor_lamp:
    enabled: false      # Disable glow for this entity
```

Per-entity glow overrides for shape, direction, and intensity can also be configured in the visual editor by expanding each entity's settings.

### Light Diffusion (`light_field`)

**`glow` and `light_field` are not two separate features**, and the editor
presents them as one **Light Projection** section with a *Renderer* choice:

| | says what | keys |
|---|---|---|
| `glow` | **what each light emits** — shape, size, direction, spread, intensity, falloff, colour | shared by both renderers |
| `light_field` | **how that emission is composited** — renderer, blending, exposure, ambient, soft shadows, quality | diffused renderer only |

Switching renderer changes nothing about your `glow` config; the diffused
renderer reads all of it. The only two glow keys it ignores are `blur` and
`edge_softness` (it models soft edges with `samples`/`source_radius` instead),
and the editor greys those out as *classic only*. `light_field.radius` applies
only to lights that have no `glow` config of their own.

The classic renderer gives each light its own DOM element, so where two glows
overlap the topmost simply wins and the colours never mix — and each light's
wall shadow is confined to its own glow box, so a wall cannot shadow a
*neighbouring* light's spill.

`light_field` replaces them with a single shared canvas layered over the plan.
Every light is painted onto that one surface additively, so **overlapping lights
merge like real light** — a red pool crossing a blue pool is genuinely magenta
and genuinely brighter — and `glow_walls` become true occluders that **cast
shadows**, computed as exact visibility polygons rather than approximated with a
bitmap mask.

```yaml
light_field: true      # shorthand for {enabled: true}
```

That single line is enough: every light diffuses its own colour across the plan,
and any walls you have configured block it.

```yaml
light_field:
  enabled: true
  over_plan: normal    # how the layer blends with the plan
  exposure: 1.0        # global brightness of the diffusion
  radius: 190          # px reach for lights with no glow config of their own
  samples: 5           # soft shadows: 1 = hard edges, 3/5/9 = penumbra
  source_radius: 8     # px emitter size, only used when samples > 1
  ambient: 0.15        # a wide, faint second wash
```

| Key | Default | Meaning |
|-----|---------|---------|
| `enabled` | `false` | Master switch. Off = today's per-light glow elements, unchanged |
| `over_plan` | `normal` | `normal`, `screen`, `multiply`, `plus-lighter`, `overlay`, `soft-light`, `hard-light` |
| `blend` | `lighter` | How lights accumulate with *each other*: `lighter` (additive) or `screen` |
| `exposure` | `1.0` | 0–4 multiplier on the layer's alpha |
| `radius` | `'19%'` | Reach for a light with no `glow` config. A percentage of the canvas, or a plain number for CSS px |
| `falloff` | `smooth` | Same curves as `glow.falloff` |
| `samples` | `1` | `1`, `3`, `5`, `9` — area-light samples for soft shadows |
| `source_radius` | `6` | px emitter radius; only meaningful when `samples > 1` |
| `ambient` | `0` | 0–1 second, wider, low-intensity pass |
| `ambient_reach` | `2.5` | Reach multiplier for that pass |
| `quality` | `auto` | `auto`, `low`, `medium`, `high` — backing-store resolution |
| `max_pixels` | `2600000` | Backing-store budget in device pixels |
| `show_walls` | `auto` | `auto` (only while drawing), `always` (also on the live dashboard), `never` |
| `wall_color` / `wall_width` | theme / `2` | Appearance of the drawn wall outline |

**Choosing `over_plan`.** `normal` reads correctly on any plan and is the
default. `screen` suits dark blueprints (it is a no-op over white). `multiply`
suits white plans and is the most physically literal — a white floor under a red
bulb really does look red — but it crushes a dark plan toward black.

#### Sizes: percent vs pixels

`glow.width`, `glow.length` and `light_field.radius` accept **either** a plain
number (CSS pixels) or a **percentage of the canvas** (`'26%'`).

Use percentages. A pixel reach covers a different share of the plan at every
card width, so the same config renders differently in the editor preview, on a
phone and on a monitor — light positions and walls are already percentages, so
only the reach was width-dependent. Measured, one config at three widths:

| | 460 px canvas | 990 px | 1360 px |
|---|---|---|---|
| `width: 300` (px) | 56% of the plan | 26% | 19% |
| `width: '26%'` | 22% | 22% | 22% |

```yaml
glow:
  enabled: true
  shape: round
  width: 26%     # instead of 300
  length: 26%
```

Plain numbers still mean pixels, so nothing changes until you switch. Only
`light_field.radius` defaults to a percentage, since it is new here and has no
existing configs to preserve.

**Existing `glow` config still applies.** When a light has `glow` enabled, the
field uses its shape, size, direction, colour and falloff, so cones, beams and
ovals all diffuse and cast shadows through the new renderer. Lights without any
glow config diffuse as a plain round pool of `radius`.

Two glow keys are deliberately ignored by the field: `blur` and
`edge_softness`. Both existed to fake soft edges on a hard-edged DOM element —
the field's shadow edges are real geometry, and softening them is what
`samples` / `source_radius` do (a penumbra that widens with distance from the
wall, as it should). Set `samples: 1` for crisp shadow edges.

Cost is modest: 12 lights against 30 wall segments with 5-sample soft shadows
measures ~6.5 ms for a full solve and ~1.1 ms once the visibility polygons are
cached (they are keyed on geometry only, so colour and brightness changes never
re-solve). The card falls back to the classic renderer if a 2D canvas is
unavailable.

### Glow Walls

Glow walls are invisible line segments or boxes that block glow from expanding in certain directions — like physical walls in a room. They use 2D ray-casting to create realistic shadow masks.

**Line segment** (x1, y1 → x2, y2 in canvas percentage coordinates):
```yaml
glow_walls:
  - [10, 50, 90, 50]       # Horizontal line across the middle
  - {x1: 50, y1: 10, x2: 50, y2: 90}  # Vertical line (object form)
```

**Box** (expands to 4 line segments):
```yaml
glow_walls:
  - {x: 20, y: 20, width: 60, height: 60}  # Rectangular wall
```

**Polyline** (a run of connected points — what the wall editor writes when you
trace a room, and the tidiest way to hand-author one):
```yaml
glow_walls:
  - points: [[10, 10], [90, 10], [90, 60], [10, 60]]
    closed: true          # join the last point back to the first
```
Each adjacent pair becomes a segment, so a closed polyline of four points is a
room. Doors apply to the whole run, not to one edge.

Coordinates use the same 0–100% coordinate system as entity positions. You can mix all three forms:
```yaml
glow_walls:
  - [0, 50, 40, 50]                       # Left wall segment
  - [60, 50, 100, 50]                     # Right wall segment
  - {x: 30, y: 70, width: 40, height: 30} # Bottom room box
```

Glow walls can also be configured in the visual editor's **Walls** section, which shows a count (e.g. "Walls (6)").

> **Seeing your walls afterwards.** Walls are invisible on a live dashboard by
> default — they are occluders, not decoration. Set `light_field.show_walls:
> always` to draw them permanently. That works even with `light_field` disabled
> (i.e. using the classic per-light glow), so you can always check the geometry
> you drew:
> ```yaml
> light_field:
>   show_walls: always
> ```

#### Doors — walls that open

Give a wall an `entity` and it only blocks light in one state, so an open door
lets light spill into the next room:

```yaml
glow_walls:
  - { x1: 40, y1: 20, x2: 40, y2: 45, entity: binary_sensor.hallway_door }
```

A wall with no `entity` is permanent, as before.

| Key | Default | Meaning |
|-----|---------|---------|
| `entity` | — | The entity that gates this wall. Any domain. |
| `blocks_when` | `closed` | `closed` blocks while the entity reads closed/off; `open` inverts it |

**What counts as open**, per domain:

| Domain | Open when |
|---|---|
| `binary_sensor` (door, window, garage, opening) | state is `on` — a door sensor reads `on` when the door *is* open |
| `switch`, `input_boolean`, `light` | state is `on` |
| `cover` | state is `open` or `opening`, or `current_position > 0` |

So `blocks_when: closed` (the default) means the wall blocks light when the
door is shut — which is what you almost always want, and is why the default
isn't simply "blocks when off".

An **unavailable, unknown or missing** entity blocks. A wall is the safe
assumption: a plan that silently springs a hole because a sensor dropped off
the network is worse than one that stays solid.

Doors work on boxes and polylines too — the entity applies to every side. And
in the wall editor an open door is drawn as a dashed line, so you can see the
geometry without mistaking it for something that blocks.

The quickest way to make a door is inside the wall editor itself: **tap the
wall** and the inspector below the plan shows *It's a door*, an entity picker
and a *blocks when* selector, plus the live verdict. The selected wall is
highlighted in gold, so on a plan with dozens of walls you can see exactly
which one you're editing &mdash; far easier than finding it in a list.

The editor form's per-wall panel has the same **Door sensor** picker and
**Blocks when** selector, and tells you the current verdict — *"Currently off — blocking
light."* — so you can check the wiring without leaving the dialog.


---

## 🧭 Rotating the Plan

**Positions → Rotate plan** turns the whole layout a quarter at a time, so you
can try your floor plan the other way round without re-placing anything.
Lights, zones, walls, the plan image and the direction each light throws its
light all turn together.

It is a **view** setting, not a rewrite. Everything you placed — `positions`,
`canvas_elements`, `glow_walls`, `aspect_ratio` — stays exactly as you authored
it, and the card applies the turn when it paints. So going back to 0° restores
your layout precisely, and no arithmetic slip can scramble work you placed by
hand.

```yaml
plan_rotation: 90     # 0 | 90 | 180 | 270, clockwise. Default 0.
```

Two things change shape, unavoidably, on a quarter turn:

- **The card.** A wide plan becomes a tall one. In a fixed-width dashboard
  column a 2:1 plan gets roughly four times taller, and the editor preview
  will need scrolling — the full-size editor (below) is the comfortable way to
  work while rotated.
- **Nothing else.** Percent glow sizes are rescaled so a light still covers the
  same part of the room; plain pixel sizes are left alone, because a pixel is a
  pixel.

The turn needs a ratio to turn: your plan image supplies one automatically. If
you have no background image (or `auto_aspect: false`), set `aspect_ratio` to
the plan's unrotated `W:H` and every orientation lines up — the card logs a
warning naming this if it is missing.

Icons keep their own upright orientation — `icon_rotation` is not touched, the
same way map labels stay level when you turn a map.


---

## 🖼 The Full-Size Editor

Both wall drawing and light placement happen in the same modal, which
opens at nearly the full viewport. The card editor gives its preview a
narrow column, and tracing a floor plan or nudging a light in a 250px-wide
pane is miserable; this is the comfortable way to do either.

Open it from the card editor, from either end:

- **Walls → Draw walls on the plan → Open editor**
- **Positions → Place lights on the plan → Open editor**

A **Walls / Lights** switch in its header moves between the two modes without
closing it. **Done** (or a second `Esc`) closes it and keeps your work;
**Cancel** closes it and puts the plan back exactly as it was when you opened
the editor — every wall drawn, moved or deleted, and every light placed, in
both modes.

It sizes itself to your plan: at most 95% of the viewport in either
direction, as tall as will fit, and only as wide as the plan's own shape
needs — so a portrait plan gets a portrait editor rather than a narrow strip
in the middle of a wide empty one.

### Drawing walls

Typing four numbers per wall is a poor way to lay out a floor plan, so the
editor gives you a real drawing surface. The **Walls** section shows a count,
e.g. "Walls (6)", so you can tell at a glance whether you have any.

| Gesture | Result |
|---------|--------|
| Drag | Draw a wall. Starting on an existing corner **attaches to it exactly**, so a run joins with no gap |
| `Esc` | End the run (the next drag starts a fresh wall) |
| **`Shift`**-drag a corner | Move that corner &mdash; **every wall meeting there moves with it**, so a traced room stays closed |
| **`Shift`**-drag a wall's body | Move the whole wall |
| **Tap** a wall | Select it &mdash; the inspector below the plan turns it into a door and picks the entity |
| **Right-click** a wall (mouse only) | Remove it |
| Long-press a wall, or hover + `Delete` | Remove it |
| Hold `Alt` | Ignore snapping |
| `Ctrl`/`Cmd` + `Z` | Undo the last wall edit |

Plain dragging always **draws**; `Shift` is what modifies existing geometry.
That way running a new wall out of a corner — the thing you do dozens of times
while tracing a plan — needs no modifier, and does not nudge the corner it
attaches to. Adjusting a corner is the occasional action, so it takes the key.

Snapping is **on** while drawing — endpoint-to-endpoint first, then 45° angles,
then the grid. That polarity is deliberately the opposite of dragging lights
(where `Alt` *enables* snap): an unclosed corner is invisible while you draw it
and obvious later, when light leaks through the gap.

Walls you draw are written back to `glow_walls` as ordinary line segments, so
they stay editable as YAML. A `box` you drag an edge of is expanded into its four
segments at that point, since its sides can then move independently.

---


### Placing lights

The same full-size editor also places lights: **Positions → Open editor**, or
switch to **Lights** in its header. Drag a light to move it, tap one to see
which entity it is, hold `Alt` to ignore the grid. Walls stay visible as
reference, because placing a light means placing it relative to a room.

Selecting a light in the editor's **Entities** list also highlights it on the
plan in gold — on a plan with twenty lights, a list row tells you nothing about
where it is.


---

## Canvas Elements

Place non-entity elements on the canvas alongside your lights. Useful for navigation links, sensor readouts, or custom labels.

Three element types are supported:

| Type | Description |
|------|-------------|
| `link` | An icon button with configurable tap/hold/double-tap actions. |
| `sensor` | Displays an entity's state value (with optional prefix/suffix) and icon. |
| `template` | Renders a Home Assistant Jinja template **live** (subscribed via `render_template`), with an optional icon. |

### Element Properties

Every element also accepts an optional `id`. One is generated (`canvas_el_0`, ...) if
you leave it out, but setting your own keeps a stable handle for the element when
you reorder the list — which is what the drag-to-reposition editing writes back to.

All element types share these properties:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `type` | string | **required** | `link`, `sensor`, or `template`. |
| `position` | map | `{x: 50, y: 50}` | Position on canvas in percentage coordinates. |
| `label` | string | `null` | Text label displayed on the element. |
| `show_background` | boolean | `true` | Show a background behind the element. |
| `tap_action` | map | `null` | Action on tap (see below). |
| `hold_action` | map | `null` | Action on long-press. |
| `double_tap_action` | map | `null` | Action on double-tap. |
| `style` | map | `{}` | Styling: `color`, `font_size`, `font_weight`, `opacity`, `background`, `border_radius`, `letter_spacing`, `text_shadow`. |

**Link** elements also accept `icon` (default `"mdi:link"`) and `size` (default `40`).

**Sensor** elements also accept `entity` (required), `prefix`, `suffix` (default: entity's `unit_of_measurement`), `show_icon` (default `true`), and `icon` (default: entity's icon).

**Template** elements also accept `content` — a Jinja template string, re-rendered live whenever its inputs change — and `icon`:

```yaml
- type: template
  position: {x: 50, y: 20}
  content: "{{ states('sensor.living_room_temperature') }}°C"
  icon: mdi:thermometer
```

### Actions

Actions follow the standard Home Assistant format:

| Action | Description |
|--------|-------------|
| `more-info` | Open the entity's more-info dialog. |
| `toggle` | Toggle the entity. |
| `navigate` | Navigate to a path (`navigation_path`). |
| `url` | Open a URL (`url_path`). |
| `call-service` | Call a service (`service`, `service_data`/`data`). |
| `none` | Do nothing. |

### Example

```yaml
canvas_elements:
  - type: sensor
    entity: sensor.living_room_temperature
    position: {x: 80, y: 10}
    suffix: "°C"
  - type: link
    icon: mdi:floor-plan
    label: "Kitchen"
    position: {x: 95, y: 50}
    tap_action:
      action: navigate
      navigation_path: /lovelace/kitchen
  - type: template
    content: "Living Room"
    position: {x: 50, y: 5}
    style:
      font_size: 16
      opacity: 0.6
```

Canvas elements can be configured in the visual editor's **Canvas Elements** section.

---

## 🔧 Custom CSS

### Global Custom CSS

Inject arbitrary CSS into the card's shadow DOM for full control over the card's appearance:

```yaml
custom_css: |
  .light-glow {
    mix-blend-mode: screen;
  }
  .canvas {
    border-radius: 16px;
  }
```

### Per-Entity Style Overrides

Apply inline CSS to individual entity containers:

```yaml
style_overrides:
  light.accent: "filter: drop-shadow(0 0 8px gold);"
  light.ceiling: "opacity: 0.8; transform: scale(1.2);"
```

Both can be configured in the visual editor — global CSS in the **Custom CSS** section, and per-entity styles in each entity's expanded settings panel.

---

## 🎨 Visual Options

### Controls Below the Canvas (Default)
<!--```yaml
controls_below: true
always_show_controls: true
```-->
- Controls remain visible below the layout for quick access.
- Ideal when you never want controls to cover the floor plan.

### Floating Controls
<!--```yaml
controls_below: false
```-->
- Controls appear over the canvas when lights are selected.
- Minimal overlay that hides automatically when nothing is selected.

---

## 🎭 Theming

By default (`theme_mode: auto`) the card follows your dashboard's Home Assistant theme: card background, text and accent colors, dividers, and corner radius all come from the theme — including translucent "glass" themes, where the canvas stays transparent so the blurred card background shows through. Use `theme_mode: dark` to keep the card's original fixed dark look regardless of theme, or `theme_mode: light` for a fixed light palette.

Everything can be fine-tuned under `theme:` (also available in the visual editor's **Appearance** section):

```yaml
theme_mode: auto
theme:
  accent_color: "#22c1a3"        # selection rings, focus outlines, slider fill
  card_background: "#101418"     # ha-card + default canvas background
  canvas_background: "transparent"
  controls_background: "rgba(30,34,40,0.8)"
  slider_track: "#2a2e34"
  text_color: "#f5f7fa"
  secondary_text_color: "rgba(245,247,250,0.7)"
  border_color: "rgba(255,255,255,0.14)"
  grid_color: "rgba(255,255,255,0.05)"
  label_background: "rgba(20,22,26,0.75)"
  label_text: "#ffffff"
  border_radius: 20              # px
  glass: true                    # frosted, blurred control panels + header
  glass_blur: 18                 # px, default 16
```

All color values accept any CSS color. Every key is optional — leave one out to inherit it from the active theme. For a "Liquid Glass" look on a glass-themed dashboard, `theme_mode: auto` plus `theme: { glass: true }` is usually all you need.

---

## Troubleshooting

### Controls not showing?
- Select at least one light.
- Or enable Always Show Controls.
- Or configure the Default Entity to control something when nothing is selected.

### Lights not visible on load?
- Reload the dashboard after updating the card.

### Labels hard to read over the light?

They shouldn't be — light is always painted behind the names and icons, and
labels carry an opaque backing so nothing can bleed through them. If you have
deliberately set a translucent `theme.label_background`, that choice is
honoured as-is, so the light *will* show through it; remove it (or give it a
solid colour) to get the opaque backing back.

### Floor plan looks blurry or soft?

Almost always the source image is being **upscaled**. The card is as wide as its
dashboard column, and on a 2x display a full-width card renders a plan at
2000-3000 device pixels across — a 1000px-wide source has to be stretched to
fill that, and no CSS setting can invent the missing detail.

Open the browser console: the card measures your plan and tells you the exact
width you need, e.g.

```
[spatial-lights-card] Plan image is being upscaled 4.1x and will look soft:
source is 400x250, but this card renders it at 1640px wide
(820 CSS px x 2 device pixel ratio). Use a source at least 1640px wide...
```

What to do, in order of how much it helps:

1. **Use a bigger source.** Export the plan at the width the warning names, or
   wider. An SVG floor plan is better still — it is resolution-independent and
   stays sharp at any card width.
2. **Check what Home Assistant is actually serving.** A URL like
   `/api/image/serve/<id>/512x512` is a *downscaled variant* — HA generates
   several sizes on upload and that path pins you to a small one. Put the
   full-resolution file in `config/www/` and reference it as `/local/plan.png`
   instead.
3. **For line art, turn off smoothing:**
   ```yaml
   background_image:
     url: /local/plan.png
     rendering: crisp-edges   # or: pixelated
   ```
   This keeps edges hard rather than interpolated. It sharpens line drawings and
   hurts photographs, so it is not the default.
4. **Make the card narrower** (fewer grid columns), so less upscaling is needed.

JPEG artifacts are a separate matter — if the plan was saved as a low-quality
JPEG, re-export it as PNG or SVG.

### Other issues?
- [Submit the issue on GitHub](https://github.com/Mihonarium/hass-spatial-lights-card/issues/new).

---

## About the design
The design was somewhat inspired by the Philips Hue light controls, and thinking hard about how to improve over it. I liked about the Philips Hue app the ability to easily grab many lights and make them arbitrary colors, including multiple lights at the same time; and make many lights the same color. However, picking the specific light was still fairly difficult if you have a lot of lights.

This card solves all of the problems: identifying lights by their position in the physical space is much easier than identifying them by their position on the colour bars or finding them by name.

This allows very fast and easy setting of arbitrary groups of lights to specific color/temperature/brightness; there’s a mode that shows existing colors and presets to easily sync arbitrary lights to the same color.

Its current state is an enormous improvement over the default ways to have smart home dashboards, which usually have 1D lists with individual controls for each light (and each pre-defined light group) which either take space or need to be opened and are also hard to find if you have a lot of lights.

The card allows placing lights and other entities on a 2D canvas to easily control arbitrary lights/groups of lights (that's always a nightmare once you have dozens of devices).

Lights can be placed corresponding to their physical location and can be selected in arbitrary groups by dragging a selection box over them.

The card also supports switches (they can be toggled by a double or a single tap, depending on a setting) and binary sensors (it can display on/off states with arbitrary colors).

It also has color presets (for quickly setting lights to a specific color) and a live color mode (for quickly setting lights to a color that some lights in the card already have).

This card made turning dozens of lights to nice colors in arbitrary ways much easier.

## ToDo
- [ ] Think about adding arbitrary templates/HTML
- [x] Color effects (not just colors) among presets (with icons?)
- [ ] Add a setting for toggling lights with a single tap
- [ ] Toggling selected lights in a (double-?) tap (somewhere? on a button?)
- [ ] Think about a way to toggle groups of lights/the default entity?
- [ ] Possibly remove the global wall occlusion and do local walls for specific lights instead
- [ ] A mode to avoid accidental clicks on all lights? (e.g., requiring confirmation or long tap to open the wheel to set anything)

