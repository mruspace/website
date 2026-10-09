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

export function initThemeToggle(): void {
  for (const group of document.querySelectorAll<HTMLElement>('.theme-switch')) {
    const buttons = [...group.querySelectorAll<HTMLButtonElement>('[data-theme-set]')];
    const sync = (choice: ThemeChoice) => {
      for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.themeSet === choice));
    };
    sync(readTheme());
    for (const b of buttons) {
      b.addEventListener('click', () => {
        const choice = (b.dataset.themeSet as ThemeChoice) ?? 'auto';
        writeTheme(choice);
        applyTheme(choice);
        sync(choice);
      });
    }
    group.hidden = false;
  }
}
