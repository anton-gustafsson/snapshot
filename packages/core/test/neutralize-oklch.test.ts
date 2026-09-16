// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { neutralizeOklchColors } from '../src/neutralize-oklch';

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
const isNeutralized = (value: string) => !/okl(ch|ab)\(/.test(value) && /^rgb/.test(value);

describe('neutralizeOklchColors', () => {
  it('rewrites a resolved oklch()/oklab() color to a legacy inline color, !important', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    stubComputedStyle(
      new Map([[el, { color: 'oklch(0.704 0.191 22.216)', 'background-color': 'oklab(0.94 0.000871558 0.00996195)' }]]),
    );

    await neutralizeOklchColors(el);

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

    await neutralizeOklchColors(root);

    expect(isNeutralized(child.style.getPropertyValue('color'))).toBe(true);

    document.body.removeChild(root);
  });

  it('leaves ordinary colors, and custom properties, alone', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    stubComputedStyle(new Map([[el, { color: 'rgb(255, 0, 0)', '--brand': 'oklch(0.55 0.19 275)' }]]));

    await neutralizeOklchColors(el);

    expect(el.style.getPropertyPriority('color')).toBe('');
    expect(el.style.getPropertyValue('--brand')).toBe('');

    document.body.removeChild(el);
  });

  it('restore puts back a pre-existing inline value, or clears one that had none', async () => {
    const el = document.createElement('div');
    el.style.setProperty('color', 'red'); // pre-existing inline value
    document.body.appendChild(el);
    stubComputedStyle(new Map([[el, { color: 'oklch(0.704 0.191 22.216)' }]]));

    const restore = await neutralizeOklchColors(el);
    expect(isNeutralized(el.style.getPropertyValue('color'))).toBe(true);

    restore();
    expect(el.style.getPropertyValue('color')).toBe('red');

    document.body.removeChild(el);
  });

  it('suppresses transition/animation on every element, and restores them', async () => {
    // A `transition` on the element itself makes writing a new color start
    // one — a read straight after would then land mid-transition, which
    // Chrome interpolates through oklab regardless of the rgb() this
    // function just wrote. See the JSDoc for the full story; jsdom doesn't
    // run real transitions, so this only asserts the inline suppression and
    // its restore, not the timing bug itself.
    const el = document.createElement('div');
    el.style.setProperty('transition', 'color 150ms', 'important');
    document.body.appendChild(el);
    stubComputedStyle(new Map([[el, { color: 'oklch(0.704 0.191 22.216)' }]]));

    const restore = await neutralizeOklchColors(el);
    expect(el.style.getPropertyValue('transition')).toBe('none');
    expect(el.style.getPropertyValue('animation')).toBe('none');

    restore();
    expect(el.style.getPropertyValue('transition')).toBe('color 150ms');
    expect(el.style.getPropertyValue('animation')).toBe('');

    document.body.removeChild(el);
  });
});
