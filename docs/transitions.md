# Navigation transition experiments

Branch `transition-lab`. Compare them at `/transition-lab`. Production
navigation is unchanged: no visitor sees a transition unless they opt in from
the lab ("Use while browsing"), and the lab's frames opt in only for
themselves.

## The model: full page loads, animated by the browser

The site stays a multi-page Astro build. There is no client router and
`ClientRouter` is not used: every link is a normal navigation that loads the
next HTML page.

The browser's **cross-document View Transition API** animates between those
pages:

1. Both pages opt in with `@view-transition { navigation: auto; }`.
2. On a same-origin navigation the browser snapshots the old page.
3. The new page loads and renders. Before its first frame it fires
   `pagereveal`, carrying a `ViewTransition` object.
4. The browser shows the old snapshot (`::view-transition-old(root)`) and the
   new live page (`::view-transition-new(root)`) as layers that CSS or the Web
   Animations API can animate.

The navigation is not delayed for decoration: the new page has already loaded
when the animation starts, and its scripts (starfield, video, scroll
triggers) are running underneath. The browser skips the transition if the new
page takes more than about four seconds to render.

## Where the code lives

| File | Role |
|---|---|
| `src/components/ViewTransitionExperiment.astro` | Inline head script and transition CSS. It decides whether to opt in, then registers `pagereveal`, which picks and draws the effect. It must run in `<head>`: `pagereveal` fires before deferred module scripts run. |
| `src/scripts/vt-experiment.ts` | Old-page side. Records the clicked element's position, names the project title for the morph, and blocks a second click while a navigation is in flight. |
| `src/scripts/vt-origin.ts` | The hand-off record, kept in sessionStorage per frame and read once by the next page. |
| `src/scripts/universe-star-field.ts` | Records a clicked planet's screen position and radius for the zoom. |
| `src/scripts/nav-indicators.ts` | Themed tab indicators; "themed" mode only. |
| `src/pages/transition-lab/index.astro` | The comparison page. |

## When a transition is allowed

The head script opts the page in only if **all** of these hold:

- **An experiment is chosen.** Either `window.name` is `vt:<mode>` (the lab's
  frames), or localStorage `aditi-vt` holds a mode ("Use while browsing").
- **The browser supports it.** `CSSViewTransitionRule` and `onpagereveal` must
  both exist.
- **Reduced motion is off.** `prefers-reduced-motion: reduce` means no
  opt-in, so pages load plainly. The CSS also strips every transition
  animation under reduced motion.
- **The page is not excluded.** Excluded paths:
  - `/services/*`, which starts Stripe checkout, including `/services/success`
  - `/admin/*`
  - `/quick/*`
  - `/dream-journal/*`

  An excluded page never opts in, so navigating to it or away from it is
  always a plain load.

If any check fails, nothing is injected and links behave exactly as they do on
`main`.

## The effects

The effects are drawn with the Web Animations API on the snapshot
pseudo-elements, for example
`document.documentElement.animate(frames, { pseudoElement: '::view-transition-new(root)' })`.
GSAP is not used: none of the effects needs a timeline that WAAPI can't express.

| Effect | Used for | How it's drawn |
|---|---|---|
| **portal** | Portal mode; Orbit tab clicks in themed mode | `clip-path: circle()` on the new page grows from the clicked tab's centre and radius to the farthest screen corner. The old page dims. 600 ms. |
| **portal-back** | Back in portal mode, and in themed Orbit | The old snapshot is raised above the new page and its circle shrinks into the centre. 460 ms. |
| **wave** | Wave mode; Flow tab clicks in themed mode | The new page is clipped to a polygon with a wavy edge: two sine waves in 20 steps down the screen. Fifteen keyframes move the edge across with a sine ease, and the phase shifts so the crest rolls. Left to right; Back runs right to left. 760 ms. |
| **morph** | A project title clicked on `/projects` (morph and themed modes) | Shared element. On click, the title's `<span>` gets `view-transition-name: project-title`; on arrival, `pagereveal` gives the same name to the project page's `<h1 id="project-title">`. The browser animates one box into the other (`::view-transition-group(project-title)`, 520 ms) and crossfades the rest of the page. |
| **zoom** | A planet clicked in themed Orbit | The old snapshot scales ×5 around the planet's screen centre and fades. The new page grows out of a circle the size of the planet, settling from 1.12× to 1×. 680 ms. |
| **fade** | Fallback: Forward with no click record, Back in morph mode, or a morph whose title isn't found | Plain 180–260 ms crossfade. |

### Choosing the effect

`pagereveal` reads three things:

- **The click record.** Its kind is `tab`, `planet`, `project` or `link`, with
  a position and radius. It is ignored if older than 6 seconds, and removed as
  soon as it's read.
- **`navigation.activation.navigationType`.** `traverse` means Back or
  Forward. Comparing `activation.entry.index` with `activation.from.index`
  tells the two apart.
- **The new page's theme.**

### Things worth knowing

- **Shared names are set per navigation, not in markup.** With the names
  always on, a portal or wave would draw the project titles above the moving
  edge. Named only for the clicked title, they exist on both pages only during
  a project-to-page morph.
- **`<link rel="expect" href="#project-title" blocking="render">`** on project
  pages holds the first frame until the heading is parsed, so the morph always
  finds it.
- **Pages restored from the back/forward cache** still fire `pagereveal`, so
  Back animates. The click latch and any leftover shared name are cleared on
  `pageshow`.
- **Double clicks.** A second click within 2.5 s of a link click is
  cancelled, so a navigation can't restart mid-transition. Planet clicks
  already had their own latch in the starfield.
- **The canvas and video.** The new page's starfield canvas and Flow video can
  be captured before their first frame. The incoming snapshot may show the
  plain background for a moment, and the stars or water appear as the
  transition ends.
- **Clicks during the transition.** While it runs, clicks go to the transition
  layer, which is one reason the effects stay under 0.8 s.

## Themed tab indicators

These are active only in themed mode (`html[data-vt="themed"]`).

- **Orbit:** a small amber dot with a circling moon glides with a slight
  overshoot to the hovered tab, and rests under the active one.
- **Flow:** an aqua wavy underline whose wave pattern flows continuously. On
  a fine pointer it eases towards the cursor within the hovered tab, and it
  returns under the active tab on leave. On touch it stays hidden.

## Browser support

| Browser | Result |
|---|---|
| Chrome, Edge 126+ | Everything, including Back and Forward told apart |
| Safari 18.2+ | Transitions play. Back is told apart from Forward only in versions with the Navigation API (26.2+); earlier ones play the forward effect on Back. |
| Firefox | Cross-document transitions aren't supported, so links navigate plainly. |
| Any browser with reduced motion on | Plain navigation |

The transitions rely on:

- `@view-transition` (cross-document)
- the `pagereveal` and `pageswap` events
- `Element.animate()` with the `pseudoElement` option
- `clip-path: circle()` and `polygon()`
- the Navigation API's `activation`, optional, for Back and Forward
- `<link rel="expect">`, optional: Chrome 124+, ignored elsewhere

## Hosting note

The lab frames the site in iframes, so `public/_headers` now sends
`X-Frame-Options: SAMEORIGIN` and `frame-ancestors 'self'` (previously
`DENY` and `'none'`). Other sites still can't frame it. Revert this if the
lab is dropped.

## Choosing one for production

Once a mode is chosen:

1. Replace the mode lookup (`window.name` or localStorage) with the chosen
   mode.
2. Keep the support, reduced-motion and exclusion checks.
3. Delete the unused effects.
4. Remove `/transition-lab`, and restore the frame headers.
