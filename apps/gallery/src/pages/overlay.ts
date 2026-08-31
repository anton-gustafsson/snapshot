import { DASHBOARDS, makeNavList, pageHeader } from '../gallery-shared';

export const path = '/overlay';
export const label = 'Overlay tint';

export function render(container: HTMLElement) {
  pageHeader(container, 'Overlay tint', 'Controls the scrim behind the title so it stays legible over any image.');

  const row = document.createElement('div');
  row.className = 'overlay-row';
  for (const tint of ['dark', 'light', 'none'] as const) {
    const wrap = document.createElement('div');
    wrap.className = 'overlay-cell';
    const caption = document.createElement('p');
    caption.className = 'overlay-caption';
    caption.textContent = `overlay-tint="${tint}"`;
    wrap.append(caption, makeNavList([DASHBOARDS[0]], { variant: 'icon-only', 'overlay-tint': tint }));
    row.append(wrap);
  }
  container.append(row);

  const h3 = document.createElement('h3');
  h3.textContent = 'Try it';
  const p = document.createElement('p');
  p.innerHTML =
    'Live-adjust <code>overlay-tint</code>, <code>overlay-opacity</code>, and <code>overlay-blur</code> on one tile.';
  container.append(h3, p);

  const controls = document.createElement('div');
  controls.className = 'overlay-controls';
  controls.innerHTML = `
    <label>
      Tint
      <select id="overlay-tint-control">
        <option value="dark" selected>dark</option>
        <option value="light">light</option>
        <option value="none">none</option>
      </select>
    </label>
    <label>
      Opacity <span id="overlay-opacity-value">0.35</span>
      <input id="overlay-opacity-control" type="range" min="0" max="1" step="0.05" value="0.35" />
    </label>
    <label>
      Blur <span id="overlay-blur-value">0px</span>
      <input id="overlay-blur-control" type="range" min="0" max="20" step="1" value="0" />
    </label>
  `;
  container.append(controls);

  const interactiveOverlay = makeNavList([DASHBOARDS[0]], { variant: 'icon-only', 'overlay-opacity': '0.35' });
  container.append(interactiveOverlay);

  const tintControl = controls.querySelector<HTMLSelectElement>('#overlay-tint-control')!;
  const opacityControl = controls.querySelector<HTMLInputElement>('#overlay-opacity-control')!;
  const opacityValue = controls.querySelector('#overlay-opacity-value')!;
  const blurControl = controls.querySelector<HTMLInputElement>('#overlay-blur-control')!;
  const blurValue = controls.querySelector('#overlay-blur-value')!;

  tintControl.addEventListener('change', () => {
    interactiveOverlay.setAttribute('overlay-tint', tintControl.value);
  });
  opacityControl.addEventListener('input', () => {
    interactiveOverlay.setAttribute('overlay-opacity', opacityControl.value);
    opacityValue.textContent = opacityControl.value;
  });
  blurControl.addEventListener('input', () => {
    interactiveOverlay.setAttribute('overlay-blur', blurControl.value);
    blurValue.textContent = `${blurControl.value}px`;
  });
}
