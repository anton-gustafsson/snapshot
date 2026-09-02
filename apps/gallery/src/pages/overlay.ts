import { DASHBOARDS, captionedRow, makeNavList, pageHeader, sectionTitle } from '../gallery-shared';

export const path = '/overlay';
export const label = 'Overlay tint';

export function render(container: HTMLElement) {
  pageHeader(container, 'Overlay tint', 'Controls the scrim behind the title so it stays legible over any image.');

  captionedRow(
    container,
    ['dark', 'light', 'none'] as const,
    (tint) => `overlay-tint="${tint}"`,
    (tint) => makeNavList([DASHBOARDS[0]], { variant: 'tile', 'overlay-tint': tint }),
  );

  sectionTitle(
    container,
    'Try it',
    'Live-adjust <code>overlay-tint</code>, <code>text-overlay-opacity</code>, <code>image-overlay-opacity</code>, and <code>overlay-blur</code> on one tile. Text and image tint are independent — keep the image clear (opacity 0) while the caption background pops.',
  );

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
      Text opacity <span id="text-overlay-opacity-value">0.35</span>
      <input id="text-overlay-opacity-control" type="range" min="0" max="1" step="0.05" value="0.35" />
    </label>
    <label>
      Image opacity <span id="image-overlay-opacity-value">0</span>
      <input id="image-overlay-opacity-control" type="range" min="0" max="1" step="0.05" value="0" />
    </label>
    <label>
      Blur <span id="overlay-blur-value">0px</span>
      <input id="overlay-blur-control" type="range" min="0" max="20" step="1" value="0" />
    </label>
  `;
  container.append(controls);

  const interactiveOverlay = makeNavList([DASHBOARDS[0]], {
    variant: 'tile',
    'overlay-tint': 'dark',
    'text-overlay-opacity': '0.35',
    'image-overlay-opacity': '0',
  });
  container.append(interactiveOverlay);

  const tintControl = controls.querySelector<HTMLSelectElement>('#overlay-tint-control')!;
  const textOpacityControl = controls.querySelector<HTMLInputElement>('#text-overlay-opacity-control')!;
  const textOpacityValue = controls.querySelector('#text-overlay-opacity-value')!;
  const imageOpacityControl = controls.querySelector<HTMLInputElement>('#image-overlay-opacity-control')!;
  const imageOpacityValue = controls.querySelector('#image-overlay-opacity-value')!;
  const blurControl = controls.querySelector<HTMLInputElement>('#overlay-blur-control')!;
  const blurValue = controls.querySelector('#overlay-blur-value')!;

  tintControl.addEventListener('change', () => {
    interactiveOverlay.setAttribute('overlay-tint', tintControl.value);
  });
  textOpacityControl.addEventListener('input', () => {
    interactiveOverlay.setAttribute('text-overlay-opacity', textOpacityControl.value);
    textOpacityValue.textContent = textOpacityControl.value;
  });
  imageOpacityControl.addEventListener('input', () => {
    interactiveOverlay.setAttribute('image-overlay-opacity', imageOpacityControl.value);
    imageOpacityValue.textContent = imageOpacityControl.value;
  });
  blurControl.addEventListener('input', () => {
    interactiveOverlay.setAttribute('overlay-blur', blurControl.value);
    blurValue.textContent = `${blurControl.value}px`;
  });
}
