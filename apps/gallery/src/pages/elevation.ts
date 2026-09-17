import { pageHeader, sectionTitle } from '../gallery-shared';

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

  sectionTitle(demo, 'Shadows');

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

  sectionTitle(demo, 'Card: rest → hover', 'No shadow at rest; <code>--shadow-2</code> on hover.');

  const cardCell = document.createElement('div');
  cardCell.className = 'elevation-cell';
  const cardSwatch = document.createElement('div');
  cardSwatch.className = 'elevation-swatch is-interactive';
  cardSwatch.textContent = 'hover me';
  cardCell.append(cardSwatch);
  demo.append(cardCell);

  sectionTitle(demo, 'Focus ring', '<code>--shadow-focus</code> on <code>:focus-visible</code> — tab to it.');

  const focusBtn = document.createElement('button');
  focusBtn.type = 'button';
  focusBtn.className = 'elevation-focus-btn';
  focusBtn.textContent = 'Focus me';
  demo.append(focusBtn);
}
