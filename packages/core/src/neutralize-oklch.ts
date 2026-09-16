const OKLCH_PATTERN = /okl(?:ch|ab)\([^)]*\)/gi;

/**
 * html2canvas can't parse the CSS `oklch()`/`oklab()` color functions that
 * `getComputedStyle` resolves a growing share of real-world CSS to —
 * Tailwind v4's default palette among others — independent of how the color
 * was originally authored. A base/reset rule commonly inherits onto
 * virtually every element too, so this can show up on dozens of computed
 * properties per node, not just background/text. A color mid-CSS-transition
 * also computes to a literal `oklab(...)` (the browser interpolates colors
 * in that space), so anything animating a color at capture time needs the
 * same treatment.
 *
 * Call this on the *live* document, before `capture()` — not just on the
 * element being captured. html2canvas clones the whole document (for
 * correct ancestor stacking/background), not only the target element, so a
 * descendant can still inherit or otherwise resolve through an ancestor this
 * call never touched if `root` is scoped too narrowly; `document.documentElement`
 * is the safe default. Restore once the capture settles — this rewrites
 * real inline styles on the live page, visibly if left in place.
 *
 * Walks the subtree, rewrites every computed property whose value contains
 * `oklch(...)`/`oklab(...)` to an inline `hsl()` equivalent (custom
 * properties are skipped — they're inert until something resolves them with
 * `var()`), set `!important` so it wins over an `!important` rule in the
 * page's own stylesheets too, and returns a callback that restores the
 * original inline styles.
 *
 * Also suppresses `transition`/`animation` on every element first. Writing
 * a new color below is itself a style change — on an element with e.g.
 * `transition: color 150ms`, that starts a transition, and a read of the
 * computed value straight afterward (by html2canvas, or by any other code
 * running after this returns) lands mid-transition rather than on the value
 * just set. Chrome interpolates color transitions in oklab by default, so
 * the symptom is indistinguishable from this function having done nothing
 * at all: the computed color comes back as an oklab() this can't parse
 * either, on a value that was never authored as oklab anywhere.
 *
 * `colorjs.io` is imported on demand (like html2canvas in `capture()`) so
 * a consumer that never calls this doesn't pay for it in their initial
 * bundle. `await`s once, up front — the DOM walk and every write below it
 * is still one synchronous pass, which the transition/animation
 * suppression above depends on.
 */
export async function neutralizeOklchColors(root: HTMLElement): Promise<() => void> {
  const { default: Color } = await import('colorjs.io');
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
  const restores: Array<() => void> = [];

  for (const element of elements) {
    for (const prop of ['transition', 'animation'] as const) {
      const previousValue = element.style.getPropertyValue(prop);
      const previousPriority = element.style.getPropertyPriority(prop);
      element.style.setProperty(prop, 'none', 'important');
      restores.push(() => {
        if (previousValue) element.style.setProperty(prop, previousValue, previousPriority);
        else element.style.removeProperty(prop);
      });
    }

    const computed = getComputedStyle(element);

    for (let i = 0; i < computed.length; i++) {
      const property = computed[i];
      if (property.startsWith('--')) continue;

      const value = computed.getPropertyValue(property);
      if (!value.includes('oklch(') && !value.includes('oklab(')) continue;

      const replaced = value.replace(OKLCH_PATTERN, (match) => toHslString(Color, match) ?? match);
      if (replaced === value) continue;

      const previousValue = element.style.getPropertyValue(property);
      const previousPriority = element.style.getPropertyPriority(property);
      element.style.setProperty(property, replaced, 'important');
      restores.push(() => {
        if (previousValue) {
          element.style.setProperty(property, previousValue, previousPriority);
        } else {
          element.style.removeProperty(property);
        }
      });
    }
  }

  return () => restores.forEach((restore) => restore());
}

function toHslString(ColorCtor: typeof import('colorjs.io').default, cssColor: string): string | null {
  try {
    const color = new ColorCtor(cssColor);
    const [h, s, l] = color.hsl;
    const alpha = color.alpha ?? 1;
    return alpha < 1 ? `hsla(${h}, ${s}%, ${l}%, ${alpha})` : `hsl(${h}, ${s}%, ${l}%)`;
  } catch {
    return null;
  }
}
