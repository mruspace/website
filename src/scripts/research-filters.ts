// Research log filters. Each filter is a real link (?kind=…); without JS the
// page lists every entry. With JS, the list filters in place.
export function initResearchFilters(): void {
  const nav = document.querySelector<HTMLElement>('[data-filters]');
  const log = document.querySelector<HTMLElement>('[data-log]');
  const empty = document.querySelector<HTMLElement>('[data-empty]');
  if (!nav || !log) return;
  const links = [...nav.querySelectorAll<HTMLAnchorElement>('a[data-kind]')];
  const rows = [...log.querySelectorAll<HTMLElement>('a.entry')];

  const apply = (kind: string) => {
    let shown = 0;
    for (const r of rows) {
      const on = !kind || r.dataset.kind === kind;
      r.hidden = !on;
      if (on) shown++;
    }
    for (const l of links) {
      const on = (l.dataset.kind ?? '') === kind;
      l.classList.toggle('on', on);
      if (on) l.setAttribute('aria-current', 'true');
      else l.removeAttribute('aria-current');
    }
    if (empty) empty.hidden = shown > 0;
  };

  for (const l of links) {
    l.addEventListener('click', (ev) => {
      ev.preventDefault();
      const kind = l.dataset.kind ?? '';
      const url = new URL(location.href);
      if (kind) url.searchParams.set('kind', kind);
      else url.searchParams.delete('kind');
      history.replaceState(null, '', url);
      apply(kind);
    });
  }
  apply(new URL(location.href).searchParams.get('kind') ?? '');
}
