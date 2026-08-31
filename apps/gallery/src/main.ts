import { router } from './router';
import { pages } from './pages';
import './pages/dashboard';

const sideNav = document.getElementById('side-nav')!;
const pageRoot = document.getElementById('page-root')!;

const linkEls = new Map<string, HTMLAnchorElement>();
for (const page of pages) {
  const a = document.createElement('a');
  a.href = page.path;
  a.textContent = page.label;
  a.setAttribute('data-navigo', '');
  sideNav.append(a);
  linkEls.set(page.path, a);
}

function setActiveLink(path: string) {
  linkEls.forEach((a, p) => a.classList.toggle('active', p === path));
}

for (const page of pages) {
  router.on(page.path, async () => {
    setActiveLink(page.path);
    pageRoot.innerHTML = '';
    const mod = await page.load();
    mod.render(pageRoot);
  });
}

router.on('/', () => router.navigate(pages[0].path));
router.notFound(() => router.navigate(pages[0].path));

router.resolve();
