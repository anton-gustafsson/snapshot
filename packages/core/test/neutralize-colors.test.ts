// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { neutralizeColors } from '../src/neutralize-colors';

/**
 * jsdom's own CSS engine resolves `oklch()`/`oklab()` straight to `rgb()` at
 * computed-style time — the opposite of the real-browser behavior this
 * function exists to work around — so these tests stub `getComputedStyle`
 * per element instead of relying on jsdom to reproduce it. The real,
 * browser-accurate round trip is covered by the Cypress suite against a real
 * browser (see the repo README on why capture() itself is tested there, not
 * here).
 */
function stubComputedStyle(overrides: Map<Element, Record<string, string>>) {
  const real = window.getComputedStyle.bind(window);
  const spy = vi.spyOn(window, 'getComputedStyle').mockImplementation((el, ...rest) => {
    const props = overrides.get(el);
    if (!props) return real(el, ...rest);
    const entries = Object.entries(props);
    const decl = {
      length: entries.length,
      getPropertyValue: (prop: string) => props[prop] ?? '',
      [Symbol.iterator]: function* () {
        for (const [key] of entries) yield key;
      },
    };
    entries.forEach(([key], i) => ((decl as unknown as Record<number, string>)[i] = key));
    return decl as unknown as CSSStyleDeclaration;
  });
  return spy;
}

afterEach(() => {
  vi.restoreAllMocks();
});

// jsdom's cssstyle canonicalizes any inline color value it's given — hsl()
// included — back to rgb() on read-back, so these assertions check "no
// longer oklab/oklch, and is some legacy notation", not the exact hsl()
// this function itself writes (which is what the real DOM would keep).
const isNeutralized = (value: string) => !/(okl(ch|ab)|color)\(/.test(value) && /^rgb/.test(value);

describe('neutralizeColors', () => {
  it('rewrites a resolved oklch()/oklab() color to a legacy inline color, !important', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    stubComputedStyle(
      new Map([[el, { color: 'oklch(0.704 0.191 22.216)', 'background-color': 'oklab(0.94 0.000871558 0.00996195)' }]]),
    );

    await neutralizeColors(document, el);

    expect(isNeutralized(el.style.getPropertyValue('color'))).toBe(true);
    expect(el.style.getPropertyPriority('color')).toBe('important');
    expect(isNeutralized(el.style.getPropertyValue('background-color'))).toBe(true);

    document.body.removeChild(el);
  });

  it('walks descendants, not just the root', async () => {
    const root = document.createElement('div');
    const child = document.createElement('span');
    root.appendChild(child);
    document.body.appendChild(root);
    stubComputedStyle(
      new Map<Element, Record<string, string>>([
        [root, {}],
        [child, { color: 'oklch(0.55 0.19 275)' }],
      ]),
    );

    await neutralizeColors(document, root);

    expect(isNeutralized(child.style.getPropertyValue('color'))).toBe(true);

    document.body.removeChild(root);
  });

  it('leaves ordinary colors, and custom properties, alone', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    stubComputedStyle(new Map([[el, { color: 'rgb(255, 0, 0)', '--brand': 'oklch(0.55 0.19 275)' }]]));

    await neutralizeColors(document, el);

    expect(el.style.getPropertyPriority('color')).toBe('');
    expect(el.style.getPropertyValue('--brand')).toBe('');

    document.body.removeChild(el);
  });

  it('rewrites color(srgb ...), what Chrome resolves color-mix() to', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    stubComputedStyle(new Map([[el, { 'border-color': 'color(srgb 0.1 0.2 0.3 / 0.12)' }]]));

    await neutralizeColors(document, el);

    expect(isNeutralized(el.style.getPropertyValue('border-color'))).toBe(true);

    document.body.removeChild(el);
  });

  it("walks only el's subtree plus <html>/<body>, not siblings", async () => {
    const el = document.createElement('div');
    const sibling = document.createElement('div');
    document.body.append(el, sibling);
    const oklch = { color: 'oklch(0.704 0.191 22.216)' };
    stubComputedStyle(new Map([[el, oklch], [sibling, oklch], [document.body, oklch]]));

    await neutralizeColors(document, el);

    expect(isNeutralized(el.style.getPropertyValue('color'))).toBe(true);
    expect(isNeutralized(document.body.style.getPropertyValue('color'))).toBe(true);
    expect(sibling.style.getPropertyValue('color')).toBe('');

    el.remove();
    sibling.remove();
    document.body.removeAttribute('style');
  });

  it('suppresses transition/animation, so the rewrite does not start one', async () => {
    // A `transition` on the element itself makes writing a new color start
    // one — html2canvas's read straight after would then land mid-transition,
    // which Chrome interpolates through oklab regardless of the color this
    // function just wrote. jsdom doesn't run real transitions, so this only
    // asserts the inline suppression, not the timing bug itself.
    const el = document.createElement('div');
    el.style.setProperty('transition', 'color 150ms', 'important');
    document.body.appendChild(el);
    stubComputedStyle(new Map([[el, { color: 'oklch(0.704 0.191 22.216)' }]]));

    await neutralizeColors(document, el);
    expect(el.style.getPropertyValue('transition')).toBe('none');
    expect(el.style.getPropertyValue('animation')).toBe('none');

    document.body.removeChild(el);
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');
  });
});
