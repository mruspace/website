// The theme toggle. The choice is a per-viewer convenience kept in
// localStorage; every access is wrapped, because storage can be blocked.
// The inline script in the page head applies the stored choice before paint.

export type ThemeChoice = 'light' | 'dark' | 'auto';
const KEY = 'mru-theme';

export function readTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

function writeTheme(choice: ThemeChoice): void {
  try {
    if (choice === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    /* storage blocked: the choice lasts for this page only */
  }
}

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}

const ORDER: ThemeChoice[] = ['auto', 'light', 'dark'];
const LABEL: Record<ThemeChoice, string> = { auto: 'Auto', light: 'Light', dark: 'Dark' };

export function initThemeToggle(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-theme-cycle]')) {
    if (button.dataset.ready) continue;
    button.dataset.ready = '1';
    const label = button.querySelector<HTMLElement>('[data-theme-label]');
    let choice = readTheme();
    const show = () => {
      if (label) label.textContent = LABEL[choice];
      button.setAttribute('aria-label', `Theme: ${LABEL[choice]}. Change theme`);
    };
    show();
    button.addEventListener('click', () => {
      choice = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length]!;
      writeTheme(choice);
      applyTheme(choice);
      // Keep every copy of the button (footer, docs menu) in step.
      for (const other of document.querySelectorAll<HTMLElement>('[data-theme-label]'))
        other.textContent = LABEL[choice];
      show();
    });
    button.hidden = false;
  }
}
