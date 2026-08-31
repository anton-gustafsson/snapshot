import { snapshotService } from 'snapshot-core';
import { router } from '../router';
import { DASHBOARDS } from '../gallery-shared';
import { captureTargets } from '../gallery-registry';

const WIDGET_COLORS = ['#6c5ce7', '#00b894', '#0984e3', '#fdcb6e', '#e17055', '#ff5a1f', '#00cec9', '#d63031'];
const WIDGET_LABELS = ['Revenue', 'Users', 'Latency', 'Errors', 'Conversion', 'Uptime', 'Signups', 'Churn'];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateWidgets(grid: HTMLElement) {
  grid.innerHTML = '';
  const count = randomInt(4, 9);
  for (let i = 0; i < count; i++) {
    const widget = document.createElement('div');
    widget.className = 'dash-widget';
    widget.style.gridColumn = `span ${randomInt(1, 3)}`;
    widget.style.gridRow = `span ${randomInt(1, 2)}`;
    widget.style.background = WIDGET_COLORS[randomInt(0, WIDGET_COLORS.length - 1)];
    const label = document.createElement('span');
    label.className = 'dash-widget-label';
    label.textContent = WIDGET_LABELS[randomInt(0, WIDGET_LABELS.length - 1)];
    const value = document.createElement('span');
    value.className = 'dash-widget-value';
    value.textContent = String(randomInt(10, 999));
    widget.append(label, value);
    grid.append(widget);
  }
}

// Set by the route handler on entry, read by the leave hook on exit — this
// module registers exactly one route, so one mutable "current capture
// target" is simpler than threading state through navigo's handler args.
let captureTarget: HTMLElement | null = null;
let captureId: string | null = null;
let captureService = snapshotService;

router.on(
  '/dashboard/:page/:id',
  (match) => {
    const pageKey = match?.data?.page ?? '';
    const id = match?.data?.id ?? '';
    const target = captureTargets.get(pageKey);

    captureId = id;
    captureService = target?.service ?? snapshotService;

    const item = DASHBOARDS.find((d) => d.id === id);

    const root = document.getElementById('page-root')!;
    root.innerHTML = '';

    const back = document.createElement('a');
    back.href = target?.backPath ?? '/icon-grid';
    back.setAttribute('data-navigo', '');
    back.className = 'dashboard-back';
    back.textContent = `← Back to ${target?.backLabel ?? 'gallery'}`;
    root.append(back);

    const h2 = document.createElement('h2');
    h2.textContent = item?.label ?? id;
    root.append(h2);

    const p = document.createElement('p');
    p.textContent = 'Auto-generated on every visit — different size, content, and colors each time. Leaving this page captures it as the card thumbnail.';
    root.append(p);

    const regenBtn = document.createElement('button');
    regenBtn.type = 'button';
    regenBtn.textContent = 'Regenerate';
    root.append(regenBtn);

    const grid = document.createElement('div');
    grid.className = 'dashboard-grid';
    root.append(grid);

    generateWidgets(grid);
    regenBtn.addEventListener('click', () => generateWidgets(grid));

    captureTarget = grid;
  },
  {
    leave: (done) => {
      const target = captureTarget;
      const id = captureId;
      const service = captureService;
      captureTarget = null;
      captureId = null;
      if (!target || !id) {
        done();
        return;
      }
      service
        .capture(target, id)
        .catch((err) => console.error(`Failed to capture dashboard "${id}"`, err))
        .finally(() => done());
    },
  },
);
