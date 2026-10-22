/**
 * Every CSS color function html2canvas 1.4 can't parse. `color(srgb ...)` is
 * what Chrome resolves any `color-mix(in srgb, ...)` to; `lab()`/`lch()`
 * (and `color(display-p3 ...)`) only appear when authored, but fail the same.
 */
const UNSUPPORTED_COLOR = /\b(?:okl(?:ch|ab)|l(?:ab|ch)|color)\([^)]*\)/gi;
const HAS_UNSUPPORTED_COLOR = /\b(?:okl(?:ch|ab)|l(?:ab|ch)|color)\(/i;

/**
 * Internal to `SnapshotService.capture()` — wired up via
 * `CaptureOptions.neutralizeColors`, run from html2canvas's `onclone`, not
 * meant to be called directly. Kept in its own module (rather than inlined)
 * so it stays independently unit testable and `colorjs.io` stays an
 * on-demand import.
 *
 * html2canvas can't parse the modern CSS color functions that
 * `getComputedStyle` resolves a growing share of real-world CSS to —
 * Tailwind v4's default palette (`oklch()`), any `color-mix()`
 * (`color(srgb ...)`) — independent of how the color was originally
 * authored. A base/reset rule commonly inherits onto virtually every element
 * too, so this can show up on dozens of computed properties per node, not
 * just background/text.
 *
 * Runs on html2canvas's clone, never the live page: nothing visible changes,
 * nothing needs restoring, and the clone was already taken synchronously, so
 * the on-demand import here can't race the caller tearing `el` down. Only
 * `el`'s subtree is walked, plus the clone's `<html>`/`<body>` — html2canvas
 * renders nothing outside `el` but reads those two for the default
 * background, and a computed style already carries anything inherited from
 * further up.
 *
 * Every computed property whose value contains an unsupported function is
 * rewritten to an inline `hsl()` equivalent (custom properties are skipped —
 * they're inert until something resolves them with `var()`), set
 * `!important` so it wins over an `!important` rule in the page's own
 * stylesheets too.
 *
 * Also suppresses `transition`/`animation` on each element first. Writing a
 * new color is itself a style change — on an element with e.g.
 * `transition: color 150ms`, that starts a transition, and html2canvas's read
 * of the computed value straight afterward lands mid-transition rather than
 * on the value just set. Chrome interpolates color transitions in oklab, so
 * the symptom is indistinguishable from this function having done nothing.
 */
export async function neutralizeColors(clonedDocument: Document, clonedElement: HTMLElement): Promise<void> {
  const { default: Color } = await import('colorjs.io');
  const view = clonedDocument.defaultView ?? window;
  const elements = new Set<HTMLElement>([
    clonedDocument.documentElement,
    clonedDocument.body,
    clonedElement,
    ...Array.from(clonedElement.querySelectorAll<HTMLElement>('*')),
  ]);

  for (const element of elements) {
    // An SVG/MathML descendant has a `style` too; a bare Element (rare) doesn't.
    if (!element?.style) continue;
    element.style.setProperty('transition', 'none', 'important');
    element.style.setProperty('animation', 'none', 'important');

    const computed = view.getComputedStyle(element);

    for (let i = 0; i < computed.length; i++) {
      const property = computed[i];
      if (property.startsWith('--')) continue;

      const value = computed.getPropertyValue(property);
      if (!HAS_UNSUPPORTED_COLOR.test(value)) continue;

      const replaced = value.replace(UNSUPPORTED_COLOR, (match) => toHslString(Color, match) ?? match);
      if (replaced !== value) element.style.setProperty(property, replaced, 'important');
    }
  }
}

function toHslString(ColorCtor: typeof import('colorjs.io').default, cssColor: string): string | null {
  try {
    // Into sRGB gamut first: a wide-gamut color (display-p3, most of oklch)
    // otherwise comes back as an hsl() with out-of-range saturation/lightness.
    const color = new ColorCtor(cssColor).to('srgb').toGamut();
    const [h, s, l] = color.hsl;
    const alpha = color.alpha ?? 1;
    return alpha < 1 ? `hsla(${h || 0}, ${s}%, ${l}%, ${alpha})` : `hsl(${h || 0}, ${s}%, ${l}%)`;
  } catch {
    return null;
  }
}
