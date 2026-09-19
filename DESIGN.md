---
name: Aryan Shah — Portfolio
description: A black instrument panel for a Solutions Engineer — hairline rules, one blue light, nothing decorative.
colors:
  void-black: "#000000"
  signal-white: "#FFFFFF"
  hairline: "#FFFFFF80"
  half-light: "#FFFFFF80"
  reactor-blue: "#1000C4"
  reactor-deep: "#000062"
  reactor-arc: "#000ECE"
  selection-indigo: "#1D04DB80"
  status-live: "#008000"
  status-paused: "#FFFF00"
  status-archived: "#FF0000"
  github-graphite: "#595959"
  linkedin-blue: "#007BFF"
  instagram-magenta: "#DD2A7B"
  email-silver: "#B9B9B9"
typography:
  display:
    fontFamily: "Manrope, 'Segoe UI', sans-serif"
    fontSize: "9.5rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "normal"
  headline:
    fontFamily: "Manrope, 'Segoe UI', sans-serif"
    fontSize: "2.85rem"
    fontWeight: 500
    lineHeight: 1.6
    letterSpacing: "normal"
  title:
    fontFamily: "Manrope, 'Segoe UI', sans-serif"
    fontSize: "1.7rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  subtitle:
    fontFamily: "Manrope, 'Segoe UI', sans-serif"
    fontSize: "1.425rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  body:
    fontFamily: "Manrope, 'Segoe UI', sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Manrope, 'Segoe UI', sans-serif"
    fontSize: "0.855rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  emphasis:
    fontFamily: "Manrope, 'Segoe UI', sans-serif"
    fontSize: "0.95rem"
    fontWeight: 700
    lineHeight: 1.6
    letterSpacing: "normal"
rounded:
  panel: "5px"
  round: "100%"
spacing:
  hair: "0.25rem"
  xs: "0.4rem"
  sm: "0.5rem"
  md: "0.75rem"
  base: "1rem"
  lg: "1.25rem"
  xl: "1.5rem"
  gutter: "2rem"
  section: "3rem"
components:
  panel:
    backgroundColor: "transparent"
    textColor: "{colors.signal-white}"
    rounded: "{rounded.panel}"
    padding: "2rem"
  panel-hover:
    backgroundColor: "transparent"
    textColor: "{colors.signal-white}"
    rounded: "{rounded.panel}"
  nav-link:
    textColor: "{colors.half-light}"
    typography: "{typography.body}"
  nav-link-hover:
    textColor: "{colors.signal-white}"
    typography: "{typography.body}"
  nav-link-active:
    textColor: "{colors.signal-white}"
    typography: "{typography.body}"
  project-card:
    backgroundColor: "transparent"
    textColor: "{colors.signal-white}"
    rounded: "{rounded.panel}"
    padding: "2rem"
  social-card:
    backgroundColor: "transparent"
    textColor: "{colors.signal-white}"
    rounded: "{rounded.panel}"
    padding: "0.4rem"
    height: "50px"
  status-dot:
    rounded: "{rounded.round}"
    size: "10px"
  timeline-dot:
    backgroundColor: "{colors.void-black}"
    rounded: "{rounded.round}"
    size: "14px"
  back-to-top:
    backgroundColor: "transparent"
    textColor: "{colors.signal-white}"
    rounded: "{rounded.round}"
    size: "3rem"
  icon-toggle:
    backgroundColor: "transparent"
    textColor: "{colors.half-light}"
    size: "22px"
---

# Design System: Aryan Shah — Portfolio

## 1. Overview

**Creative North Star: "The Instrument Panel"**

This is a black cabin at night with one light source. Every surface is a hairline-ruled panel floating on a void, and the only colour in the entire system is a slow electric-blue reactor glowing behind everything at a distance. Nothing is filled, nothing is shadowed, nothing is decorated. The system reads the way a well-designed cockpit reads: dense with information, absolutely legible, and completely uninterested in impressing you on first glance.

The interaction model follows from the metaphor. Instruments sit at rest in half-light — every link, card, icon, and social tile defaults to 50% opacity — and come up to full brightness the moment you touch them. That single gesture, `opacity: 0.5 → 1` over `0.3s ease-out`, is essentially the entire interaction vocabulary of the site. There are no fills, no colour shifts, no scale bounces. Attention is a light coming on.

This system explicitly rejects the four things PRODUCT.md names. It is not a **generic template portfolio** — there is no theme vocabulary here, no purchased section grammar, and the structural units (the vertical rotated-text call-to-action rail, the dual counter-scrolling tech marquees, the perf-mode reactor kill switch) do not exist in any starter kit. It is not **SaaS landing-page grammar** — there are no hero metric blocks, no gradient blobs, no tracked uppercase eyebrows, no `01 / 02 / 03` markers. It is not a **scroll-jacked showreel** — Lenis smooths the scroll but never hijacks it, and reveals fire once and stay put. It is not a **dev-resume wall** — skills appear as a moving marquee at half-light, never as a badge grid or a proficiency bar.

**Key Characteristics:**

- Pure `#000000` substrate. Not near-black, not charcoal, not a tinted neutral.
- Exactly one border weight: `1px`, via `--border-px`. Every rule in the system is a hairline.
- Exactly one corner radius: `5px`, via `panel`. Circles (`100%`) only for dots and the back-to-top.
- One typeface, Manrope variable, carrying the whole hierarchy on weight and size alone.
- A single base unit of `0.95rem` from which every type size in the codebase is derived.
- Zero shadows. Depth is opacity and blur, never elevation.
- Colour lives behind the content plane, never on it.
- A user-facing performance switch that degrades the whole system gracefully.

## 2. Colors: The Reactor Palette

A monochrome instrument surface lit from behind by a single saturated blue that the interface itself is never allowed to touch.

### Primary

- **Reactor Blue** (`#1000C4`): The core of the WebGL shader sphere. This is the brand colour and it appears in exactly one place — the animated gradient plane fixed behind all content at `z-index: 0`, rendered at `brightness: 0.6` with grain on. It is never a button fill, never a text colour, never a border.
- **Reactor Arc** (`#000ECE`): The shader's highlight pole. Slightly brighter and cooler than the core; it produces the moving bright edge of the sphere.
- **Reactor Deep** (`#000062`): The shader's shadow pole. Where the sphere falls off into the void, this is the last blue before black.

### Secondary

- **Selection Indigo** (`#1D04DB` at 50% alpha): The `::selection` highlight. The only moment the reactor colour crosses onto the content plane — and it only does so because the user asked for it by dragging. Treat this as a deliberate exception, not a precedent.

### Neutral

- **Void Black** (`#000000`): The body substrate and the fallback background when the shader is off. True black, no tint. In low-perf mode this is the entire background, and the design must still hold.
- **Signal White** (`#FFFFFF`): Primary ink and the source of every border, rule, and icon in the system. Exposed as both `--primary-color` and as decomposed `--primary-r/g/b` channels so opacity can be varied per-component without new tokens.
- **Half-Light** (`#FFFFFF` at 50% alpha): The universal resting state. Body links, nav links, tech-stack chips, the perf toggle, and the back-to-top all sit here until hovered. Also the default border colour (`--border-color`).
- **Quarter-Light** (`#FFFFFF` at 25–35% alpha): Structural rules that should recede — the experience timeline spine at 35%, the role indent rule at 25%, the section separator lines at 30%.

### Tertiary (functional only)

- **Status Live** (`green`), **Status Paused** (`yellow`), **Status Archived** (`red`): 10px dots on project cards and the pulsing 14px dot on the current role in the experience timeline. These exist purely to encode state.
- **Functional accents** — Cyan (`#00B7C3`), Green (`#3FB950`), Violet (`#C77DFF`), Amber (`#E3B341`), Red (`#FF7B72`), exposed as `--accent-cyan` … `--accent-red`. One accent vocabulary shared by the two places in the blog that need to encode a category: callout severity (`--alert-note` … `--alert-caution` alias straight onto them) and code syntax tokens. Every one is deliberately clear of the reactor's indigo band so the Blue Stays Behind Glass rule holds, and all five clear 4.5:1 against the shader as painted (`brightness: 0.6`) — the worst case is Violet at 5.89:1. They never appear on prose, a heading, a fill, or a control.
- **Platform marks** — GitHub Graphite (`#595959`), LinkedIn Blue (`#007BFF`), Instagram Magenta (`#DD2A7B`), Email Silver (`#B9B9B9`): borrowed identity colours confined to the square icon tile inside each social card. They belong to those platforms, not to this system; never pull them outward into the interface.

### Named Rules

**The Blue Stays Behind Glass Rule.** Reactor Blue exists only on the shader plane and in `::selection`. It must never appear as a button background, a heading colour, a border, a link state, or a gradient on the content plane. The entire tension of the design is a monochrome instrument floating over a coloured light it never touches. The moment blue crosses onto a surface, the metaphor collapses and the page becomes an ordinary dark-mode site with an accent colour.

**The Two-State Rule.** Every interactive element has exactly two visual states: resting at 50% opacity, and active at 100%. Not three, not a colour shift, not a background fill. If a component needs a third state, it needs a rethink, not a new token.

**The Black Is Black Rule.** The substrate is `#000000` and nothing else. No `#0a0a0a`, no `#111`, no warm-tinted near-black, no "softer on the eyes" charcoal. The shader needs true black to read as a light source rather than a panel.

## 3. Typography

**Display Font:** Manrope (variable, 200–800), fallback `"Segoe UI", sans-serif`
**Body Font:** Manrope — the same family, at different weights
**Label/Mono Font:** None. There is no monospace in this system.

**Character:** One humanist-geometric variable sans doing all the work. Manrope's slightly squared bowls and tall x-height keep dense technical content legible at small sizes, while its 500 weight at display sizes reads as engineered rather than fashionable. The system deliberately declines a second family: a display/body pair would introduce a voice this brand does not have. Hierarchy comes from size and weight alone, which is exactly the discipline an instrument panel implies. The choice of a single family here is a committed decision, not a default — do not "improve" it by adding a serif or a mono.

### The 0.95 Base Unit

Every single font-size in this codebase is a multiple of the `0.95rem` body size. This is the system's most distinctive and least obvious property, and it is exact:

| Multiplier | Size       | Where                              |
| ---------- | ---------- | ---------------------------------- |
| ×0.4       | `0.38rem`  | Tooltip description                |
| ×0.6       | `0.57rem`  | Rotated rail label (small variant) |
| ×0.8       | `0.76rem`  | Card body below 1180px             |
| ×0.9       | `0.855rem` | Experience labels, role location   |
| ×1         | `0.95rem`  | Body, nav links, rail labels       |
| ×1.2       | `1.14rem`  | Hero role line                     |
| ×1.4       | `1.33rem`  | Card title below 1180px            |
| ×1.5       | `1.425rem` | `h4`, social and CV icons          |
| ×1.79      | `1.7rem`   | `h3`, company name                 |
| ×2         | `1.9rem`   | Hero `h1`                          |
| ×2.5       | `2.375rem` | `h2`                               |
| ×3         | `2.85rem`  | `h1`                               |
| ×8         | `7.6rem`   | Contact display below 768px        |
| ×10        | `9.5rem`   | Contact display                    |

New sizes must land on this grid. Pick a multiplier, not a pixel value.

### Hierarchy

- **Display** (500, `9.5rem` / `7.6rem` mobile, line-height 1): The contact section's oversized wordmark. The single loudest gesture on the site, and it appears exactly once — at the very end, as the sign-off. Its scale is the whole reason the rest of the page can stay quiet.
- **Headline** (500, `2.85rem`): The base `h1`. Section-level, used at full scale for standalone titles.
- **Hero** (500, `1.9rem`): The `h1` override inside `.introduction`. Deliberately _smaller_ than the base `h1` — the hero panel is dense and bordered, and a full-scale headline would break the panel's composure.
- **Title** (400, `1.7rem`): `h3` and the experience company name. Weight drops to 400 here; from this level down, hierarchy is carried by size alone.
- **Subtitle** (400, `1.425rem`): `h4`.
- **Body** (400, `0.95rem`, line-height 1.6): All prose. Note that the global `line-height: 1.6` is already the light-on-dark compensation this system needs; do not reduce it.
- **Label** (400, `0.855rem`, 70–80% opacity): Experience field labels, dates, locations. Recessed by opacity, never by a smaller weight.
- **Emphasis** (700, `0.95rem`): The `.highlight` class. Keyword emphasis inside prose is carried by weight — never by colour, and never by the gradient treatment. This is the one place the variable font's upper range gets used, and it works in both performance modes.

### Named Rules

**The Weight-Not-Colour Rule.** Emphasis in prose is `font-weight: 700` and nothing else. No accent-coloured keywords, no underlines, no highlight backgrounds. `.highlight` is the entire mechanism.

**The One Loud Moment Rule.** `9.5rem` display type appears exactly once on the site, in the contact sign-off. If a second element wants that scale, one of them is wrong.

## 4. Elevation

**This system has no shadows.** Not a single `box-shadow` exists in the codebase, and none should be added. On a true-black substrate a shadow is invisible by definition; simulating depth with a lighter halo would read as glassmorphism, which this system bans.

Depth is expressed through three mechanisms instead:

1. **Opacity as distance.** A hairline at 25% alpha is further away than one at 50%, which is further than one at 80%. The experience timeline uses this literally: the spine sits at 35%, the role indent rule at 25%, and the active dot border at 80%.
2. **Backdrop blur as glass.** `backdrop-filter: blur(10px)` on the scrolled navbar and `blur(1px)` on the CV caption. This is the only "material" effect in the system, it is applied to exactly two surfaces, and both are functional (legibility over moving content) rather than decorative. Both are stripped in low-perf mode.
3. **The parallax plane.** The shader is `position: fixed` at `z-index: 0` while all content sits at `z-index: 1` and scrolls over it. The content is unambiguously in front because the background does not move with it. This is the only true depth cue in the system and it does all the heavy lifting.

### Named Rules

**The No-Shadow Rule.** Zero `box-shadow` declarations. If an element needs to separate from its surroundings, raise its border opacity or give it more space. Never add a shadow, a glow, or a lighter background panel.

**The Two Glass Surfaces Rule.** `backdrop-filter` appears on the scrolled navbar and the CV caption. That is the complete list. Every additional blurred surface pushes the system toward the glassmorphism it bans, and costs a GPU layer that low-perf mode then has to unwind.

## 5. Components

The component character across the board: **hairline-outlined containers at rest in half-light, brightening on contact.** Nothing is filled. Nothing is elevated. Everything is a rectangle drawn in one-pixel white on black with a 5px corner.

### Panels / Cards

- **Corner Style:** `5px` (`{rounded.panel}`) — universal, no exceptions.
- **Background:** `transparent`. The shader shows through. Never give a card a solid or tinted fill.
- **Border:** `1px solid rgba(255,255,255,0.5)` at rest → `rgba(255,255,255,1)` on hover. Written via the decomposed `--primary-r/g/b` channels so the alpha is the only thing that changes.
- **Shadow Strategy:** None. See Elevation.
- **Internal Padding:** `2rem` on content panels (`.introduction`, `.blurLayer`), `0.7rem` on narrow rails, `0.4rem` on social tiles.
- **Transition:** `border 0.3s ease-out`.
- **Mobile:** the hero panel drops its border and padding entirely below 768px. On a small screen the frame is noise; the content is the panel.

### Navigation

- **Style:** Fixed, full-width, `4rem` tall (`--navbar-height`), `z-index: 1000`. Fully transparent at scroll position 0; transitions to `backdrop-filter: blur(10px)` once scrolled. Entrance animation slides it down from `-100%` over `1s ease-out` on load.
- **Typography:** Body (`0.95rem`, weight 400).
- **States:** rest `opacity: 0.5` → hover `1` → active `1`, over `0.3s ease-out`. Within the one-pager the active section is driven by an `IntersectionObserver` scroll-spy at a `-50%` viewport margin (`lib/navbar.ts`); on the blog routes the Blog item is active by pathname.
- **Items:** About · Experience · Projects · Blog · Contact, driven by the `NAV_ITEMS` array in `data/nav.ts`. A `section` item is a plain in-page anchor while on `/` and becomes a link to `/#section` from any other route; a `route` item is its own page. Reordering the nav means reordering that array — nothing is positioned by markup structure.
- **Mobile:** below 768px, labels are replaced by 20px icons (User / SuitcaseSimple / Package / AddressBook / Notebook). Both are rendered and swapped by CSS, so the markup stays static; the icon carries a visually-hidden label so it is never an unnamed link.
- **Note:** active state is signalled by opacity alone, which is a colour-independence gap against the WCAG AA target in PRODUCT.md. It needs a second signal that is not a rule or an underline — those were tried and rejected as visual noise in a nav this quiet.
- **Note:** the `nav`, `ul`, and `li` rules in `Navbar.css` are scoped to `.navbar` — they are global stylesheets, and bare element selectors there style every list and `<nav>` in the app.

### Project Card

- **Character:** A transparent hairline rectangle whose description holds its space at rest and fades in on contact (`opacity 0 → 1` over `0.3s ease-out`), so hovering a card never reflows the grid around it. The card is the demo's front door; the whole point is that it is clickable through to a live, self-hosted build under `public/`.
- **Title:** `1.5rem`, line-height `1.25`.
- **Status:** a 10px dot pinned at `top: 1rem; left: 1rem` — green live, yellow paused, red archived. Colour-only encoding; needs a text or shape companion for AA.
- **Links:** `1.4rem` Boxicons row, `1rem` gap, centred.

### Blog

- **Character:** The one component family that is not a section of the one-pager. `/blog` is a single column of hairline post cards; `/blog/<slug>` is a `720px` reading column. Both keep the outlined-container grammar — nothing is filled, nothing is elevated — and both are left-aligned, overriding the site's centred default because prose is not a poster.
- **Authoring:** posts are markdown. `src/content/blog/<folder>/index.md` plus an optional `assets/` folder beside it; the content collection's `glob()` loader picks both up at build time, so publishing is adding a folder. The slug is the frontmatter title lowercased with dashes, so it is never typed twice.
- **Post card:** `2rem` padding (`1.5rem` below 768px), `5px` radius, `1px` border 50% → 100% on hover. Title `1.7rem` (`1.425rem` mobile), summary at 70% opacity, date / reading time / tags as `0.855rem` labels at 50%. Tags are plain middot-separated text — never pills, never a badge grid.
- **Post page:** `h1` at `2.85rem` (`1.9rem` below 768px), a single `0.855rem` meta line, body at `0.95rem`. In-body headings step down `1.7 / 1.425 / 1.14rem`, and the markdown's own top-level `# title` is dropped so it is not printed twice.
- **Alerts:** GitHub alert blockquotes (`> [!NOTE]`) become a hairline panel tinted by severity — the functional alert hue on the 1px border at 80% and on the `0.855rem` weight-700 label, over a transparent body. The word carries the meaning and the hue reinforces it, so the callout survives being read in greyscale. No fill: a tinted background would occlude the shader and break the Transparent Container Rule.
- **Heading permalinks:** every heading in a post body gets an id slugged from its own text (repeats get `-1`, `-2`, … like GitHub), assigned by a rehype plugin so the numbering is document-ordered and deterministic. A `#` marker sits at `opacity: 0` and comes up to `1` on heading hover or keyboard focus; under `@media (hover: none)` it stays visible at half-light, since touch has no hover to reveal it. The click is routed through `lib/scroll.ts` rather than left to the browser, so both perf modes land the heading at the same 96px offset. **Do not add `scroll-margin-top` to a heading** — `html` already carries `scroll-padding-top: 6rem`, and the two stack, parking the target 192px down.
- **Collapsed sections:** `<details>` renders as a hairline panel whose summary sits at 50% and brightens on contact, marked `+` / `−` rather than a native disclosure triangle. The summary is pulled out to the panel edges with negative margins and re-padded, so the entire collapsed box is the hit target instead of just the label row.
- **Code:** still Manrope. Code blocks and inline code use `white-space: pre` and tabular figures inside a hairline panel at `0.855rem`, with the fence's language as the panel label — a monospace face would be the second typeface this system refuses.
- **Syntax highlighting:** Prism grammars via `refractor`, applied by a rehype plugin **at build time** so no grammar is shipped to the browser, with a theme built from the functional accent set: keywords violet, strings green, numbers amber, functions and types cyan, comments white at 60% italic, punctuation at 70%, everything else at 85%. Four hues total — a stock editor theme would drag a dozen unrelated colours onto a monochrome page. Any token class without a rule inherits the base colour, so an unknown grammar degrades to plain text instead of vanishing. Grammars are registered explicitly in `lib/markdown/highlight-code.ts`; adding a language means adding an import there.
- **Copy control:** a `1.14rem` icon button sitting opposite the language label in the code panel's caption row (`justify-content: space-between`). Rest `0.5` → `1` on contact and while copied. Feedback is a copy/check icon cross-fade over `0.3s ease-out`, both icons stacked in one grid cell so the button never changes width; the check scales `0.6 → 1` on the way in, and `prefers-reduced-motion: reduce` drops the scale for a straight cross-fade. The state also carries an `aria-live` "Copied", so the animation is never the only signal.
- **Motion:** entrance reveals only, on the system's single reveal token (`8px` over `0.4s ease-out`). There is no always-on animation in the blog, so low-perf mode has nothing to unwind.

### Vertical Rail (signature component)

- **Character:** The site's most distinctive structural element. A narrow full-height hairline rectangle with its label set in `writing-mode: vertical-rl` and a chevron pinned at the bottom, used as a call-to-action rail beside the hero and the projects grid ("Contact me!", "View more projects"). It gives the layout a vertical edge that no template ships with, and it costs almost no horizontal space.
- **Shape:** `5px` radius, `1px` border at 50% → 100% on hover, `0.7rem` padding (`0.2rem` in the compact variant).
- **Label:** `0.95rem` vertical (`0.57rem` in the compact variant).
- **Accessibility note:** it is an `<a>`, so it is keyboard-reachable and reads as a link.

### Tech-Stack Marquee

- **Character:** Two counter-scrolling rows of technology chips behind a horizontal fade mask, running `70s` forward and `43s` reverse on `linear infinite`. The mismatched durations are deliberate — they never resync, so the composition never repeats.
- **Chip:** no border, no fill; a square logo tile plus a nowrap label at `opacity: 0.5`, rising to `1` on hover.
- **Mask:** `linear-gradient(90deg, transparent 0%, black 20%, black 80%, transparent 100%)` on both axes of the row.
- **Logos:** inverted to white via `filter: invert(var(--invertHover))` so third-party brand marks conform to the monochrome surface.

### Experience Timeline

- **Spine:** a `1px` vertical gradient rule at `left: 12px`, holding 35% alpha and fading to transparent over its final `1.5rem`.
- **Dot:** 14px circle, `1px` border at 80% alpha, filled with `--bg-color` so the spine is visually interrupted rather than crossed.
- **Active dot:** filled green with two `::before`/`::after` rings pulsing `scale(1) → scale(3.2)` over `2.4s`, offset by `1.2s`. Disabled entirely in low-perf mode.
- **Role indent:** `border-left: 1px solid rgba(255,255,255,0.25)`. This is the one permitted left-border in the system, and it is permitted **only** because it is a 1px structural indent rule on a nested list — not a coloured accent stripe. Do not thicken it and do not colour it.

### Social Card

- **Shape:** `50px` tall, auto width, `5px` radius, `1px` border 50% → 100%, plus `scale: 1.1` on hover (suppressed below 1180px).
- **Icon tile:** square `aspect-ratio: 1/1` filled with the platform's own brand colour, `1.425rem` white glyph.

### Perf-Mode Toggle (signature component)

- **Character:** A 22px bolt icon in the navbar that switches the entire site between `data-perf="high"` and `data-perf="low"`, persisted to `localStorage` and applied pre-paint by an inline script in `layouts/BaseLayout.astro` so there is no flash. Low mode unmounts the WebGL shader, tears down the Lenis RAF loop, and strips every marquee, pulse, gradient shimmer, and backdrop-filter via CSS attribute selectors.
- **Why it is a design component, not a settings control:** it is the clearest single expression of PRODUCT.md's principle that _the machine is part of the message_. Treat it as first-class surface, and make sure every new always-on animation gets a `html[data-perf="low"]` off-switch in the same commit.

### Named Rules

**The Transparent Container Rule.** Containers are outlined, never filled. `background-color` on a card or panel is a bug — it occludes the shader and breaks the floating-instrument metaphor.

**The One Easing Rule.** Every state transition is `0.3s ease-out` (`--state-duration`). Entrance reveals are `0.4s ease-out` over `8px` (`--reveal-duration` / `--reveal-distance`), stepped by `40ms` (`--reveal-stagger`) when several land together. There is no third duration and no other easing curve in the system.

## 6. Do's and Don'ts

### Do:

- **Do** keep the substrate at exactly `#000000` and let the shader be the only light source.
- **Do** derive every new font-size as a multiple of the `0.95rem` base unit. Pick a multiplier from the table in §3, not a pixel value.
- **Do** use `1px` (`var(--border-px)`) for every rule, border, and divider. One weight, no exceptions.
- **Do** use `5px` (`{rounded.panel}`) for every rectangle and `100%` for every dot.
- **Do** express state with the two-state opacity gesture: `0.5` at rest, `1` on contact, `0.3s ease-out`.
- **Do** use the decomposed `--primary-r/g/b` channels when a component needs a custom alpha, rather than adding a new colour token.
- **Do** pair every new always-on animation with a `html[data-perf="low"]` override in the same change.
- **Do** add a `@media (prefers-reduced-motion: reduce)` block alongside it — the perf toggle is a preference, the media query is an accessibility requirement, and PRODUCT.md targets WCAG 2.1 AA. Both now exist and live together in `styles/motion.css`: the `html[data-perf="low"]` overrides and the reduced-motion block sit side by side so neither can be added without the other being obvious.
- **Do** rely on the single global `:focus-visible` treatment in `styles/base.css` (`1px` outline, `4px` offset, full opacity) and never reset `outline` in a component. A blanket `outline: none` leaves a control focusable with nothing to show for it, which is why none remain in `src/`.
- **Do** ship interactive elements as real `<a>` and `<button>` elements. The logo, the back-to-top control, the three vertical rails, the bio and role toggles, and the technology category controls are all native elements — there is no `div` with a click handler left in the codebase.
- **Do** verify half-light text against the _brightest frame of the moving shader_, not against flat black. `#FFFFFF` at 50% over the reactor's bright pole is materially worse than the same white over `#000000`, and the shader is the real backdrop.
- **Do** give the project status dots a non-colour companion (label or shape). Colour-only encoding fails AA.

### Don't:

- **Don't** use `background-clip: text` with a gradient. Gradient text is an absolute ban. The `.gradient-animation` treatment currently on the name in the hero is exactly this pattern and should be replaced with solid `Signal White` plus weight; the low-perf branch already renders it that way and reads better.
- **Don't** let Reactor Blue onto the content plane. No blue buttons, no blue headings, no blue borders, no blue gradients. It lives behind the glass.
- **Don't** add a `box-shadow` anywhere. Zero exist; keep it that way.
- **Don't** add a third blurred surface. The scrolled navbar and the CV caption are the complete list.
- **Don't** fill a card or panel with a background colour. Containers are outlines.
- **Don't** use `border-left` or `border-right` above `1px` as a coloured accent stripe. The experience role indent is a 1px structural rule and is the only left-border permitted.
- **Don't** add a second typeface. Manrope carries the whole hierarchy on weight and size deliberately; a display serif or a mono would be costume.
- **Don't** ship the **generic template portfolio** look — Framer / Notion / Astro-theme section grammar, stock hero layouts, or any component that looks like it came with a starter kit. This is PRODUCT.md's primary anti-reference and the site's entire premise is that it was built, not bought.
- **Don't** import **SaaS landing-page grammar**: hero metric blocks, gradient blobs, three identical rounded-icon feature cards, tiny uppercase tracked eyebrows above section headings, or `01 / 02 / 03` numbered section markers.
- **Don't** build a **scroll-jacked showreel**. Lenis smooths the scroll; it must never seize it. Reveals fire once and stay put, and no reveal may gate content visibility — if the transition never fires, the section must still be there.
- **Don't** build a **dev-resume wall**: badge grids, skill percentage bars, or exhaustive technology lists. Skills belong in the half-light marquee, and claims belong behind a link to something running.
- **Don't** signal an active navigation item or a project status with colour or opacity alone.
- **Don't** introduce a warm or tinted neutral anywhere. The surfaces of this system are `#000000` and `#FFFFFF` at varying alpha, and that austerity is the point. The functional hues in §2 Tertiary are the sole exception: they encode state on a dot or a callout border, and they never become a neutral.
