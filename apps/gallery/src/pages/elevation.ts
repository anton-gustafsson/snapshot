import { DASHBOARDS, makeNavList, pageHeader } from '../gallery-shared';

export const path = '/elevation';
export const label = 'Elevation';

export function render(container: HTMLElement) {
  const demo = document.createElement('div');
  demo.className = 'elevation-demo';
  container.append(demo);

  pageHeader(
    demo,
    'Elevation',
    'Shadow tiers, a rest→hover card, and a focus ring — all <code>currentColor</code>-tinted so they adapt to ' +
      "this page's theme instead of a fixed color. Tokens (<code>--shadow-1</code> etc.) are scoped to this page only, not global.",
  );

  const h3Shadows = document.createElement('h3');
  h3Shadows.textContent = 'Shadows';
  demo.append(h3Shadows);

  const row = document.createElement('div');
  row.className = 'elevation-row';
  for (const token of ['--shadow-1', '--shadow-2', '--shadow-3', '--shadow-overlay']) {
    const cell = document.createElement('div');
    cell.className = 'elevation-cell';
    const swatch = document.createElement('div');
    swatch.className = 'elevation-swatch';
    swatch.style.boxShadow = `var(${token})`;
    swatch.textContent = token;
    const caption = document.createElement('p');
    caption.className = 'overlay-caption';
    caption.textContent = token;
    cell.append(swatch, caption);
    row.append(cell);
  }
  demo.append(row);

  const h3Card = document.createElement('h3');
  h3Card.textContent = 'Card: rest → hover';
  demo.append(h3Card);
  const cardP = document.createElement('p');
  cardP.innerHTML = 'No shadow at rest; <code>--shadow-2</code> on hover.';
  demo.append(cardP);

  const cardCell = document.createElement('div');
  cardCell.className = 'elevation-cell';
  const cardSwatch = document.createElement('div');
  cardSwatch.className = 'elevation-swatch is-interactive';
  cardSwatch.textContent = 'hover me';
  cardCell.append(cardSwatch);
  demo.append(cardCell);

  const h3Focus = document.createElement('h3');
  h3Focus.textContent = 'Focus ring';
  demo.append(h3Focus);
  const focusP = document.createElement('p');
  focusP.innerHTML = '<code>--shadow-focus</code> on <code>:focus-visible</code> — tab to it.';
  demo.append(focusP);

  const focusBtn = document.createElement('button');
  focusBtn.type = 'button';
  focusBtn.className = 'elevation-focus-btn';
  focusBtn.textContent = 'Focus me';
  demo.append(focusBtn);

  const h3Overlay = document.createElement('h3');
  h3Overlay.textContent = 'Image overlays';
  demo.append(h3Overlay);
  const overlayP = document.createElement('p');
  overlayP.innerHTML =
    "Same idea applied to <code>&lt;snapshot-nav-list&gt;</code>'s existing <code>overlay-tint</code>/<code>overlay-opacity</code>, plus " +
    '<code>--snapshot-nav-list-overlay-margin</code>/<code>--snapshot-nav-list-overlay-radius</code> (both set to <code>6px</code>/<code>8px</code> here) floating the caption into a rounded chip instead of a flush strip.';
  demo.append(overlayP);

  const overlayRow = document.createElement('div');
  overlayRow.className = 'overlay-row';
  const overlaySteps: Array<{ tint: 'light' | 'dark' | 'none'; opacity: number; blur: number; caption: string }> = [
    { tint: 'none', opacity: 0, blur: 40, caption: 'blur' },
    { tint: 'none', opacity: 0, blur: 0, caption: 'clear' },
    { tint: 'light', opacity: 0.05, blur: 0, caption: 'white-5' },
    { tint: 'light', opacity: 0.1, blur: 0, caption: 'white-10' },
    { tint: 'light', opacity: 0.25, blur: 0, caption: 'white-25' },
    { tint: 'light', opacity: 0.5, blur: 0, caption: 'white-50' },
    { tint: 'light', opacity: 1, blur: 0, caption: 'white-100' },
    { tint: 'dark', opacity: 0.05, blur: 0, caption: 'black-5' },
    { tint: 'dark', opacity: 0.1, blur: 0, caption: 'black-10' },
    { tint: 'dark', opacity: 0.25, blur: 0, caption: 'black-25' },
  ];
  for (const step of overlaySteps) {
    const cell = document.createElement('div');
    cell.className = 'overlay-cell';
    const caption = document.createElement('p');
    caption.className = 'overlay-caption';
    caption.textContent = step.caption;
    const navList = makeNavList([DASHBOARDS[0]], {
      variant: 'icon-only',
      'overlay-tint': step.tint,
      'overlay-opacity': String(step.opacity),
      'overlay-blur': String(step.blur),
    });
    navList.style.setProperty('--snapshot-nav-list-overlay-margin', '6px');
    navList.style.setProperty('--snapshot-nav-list-overlay-radius', '8px');
    cell.append(caption, navList);
    overlayRow.append(cell);
  }
  demo.append(overlayRow);
}
