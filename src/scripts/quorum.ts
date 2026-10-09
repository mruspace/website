// The Home quorum demo. State: how many processors are alive (3, 2 or 1).
type Alive = 3 | 2 | 1;
interface State {
  mode: string;
  width: string;
  note: string;
}
type States = Record<'tmr' | 'mru', Record<Alive, State>>;

export function initQuorum(): void {
  for (const root of document.querySelectorAll<HTMLElement>('[data-quorum]')) {
    const states = JSON.parse(root.dataset.states ?? '{}') as States;
    const procs = [...root.querySelectorAll<HTMLElement>('[data-proc]')];
    const brk = root.querySelector<HTMLButtonElement>('[data-q-break]');
    const reset = root.querySelector<HTMLButtonElement>('[data-q-reset]');
    let alive: Alive = 3;

    const render = () => {
      procs.forEach((p, i) => p.classList.toggle('dead', i >= alive));
      for (const key of ['tmr', 'mru'] as const) {
        const cell = root.querySelector<HTMLElement>(`[data-q="${key}"]`);
        if (!cell) continue;
        const s = states[key][alive];
        cell.querySelector('[data-q-mode]')!.textContent = s.mode;
        cell.querySelector<HTMLElement>('[data-q-bar]')!.style.width = s.width;
        cell.querySelector('[data-q-note]')!.textContent = s.note;
        if (key === 'tmr') cell.classList.toggle('stopped', alive === 1);
      }
      // As on the canvas, the button goes away when one processor is left.
      if (brk) brk.hidden = alive === 1;
      root.dataset.alive = String(alive);
    };

    brk?.addEventListener('click', () => {
      alive = Math.max(1, alive - 1) as Alive;
      render();
      if (alive === 1) reset?.focus();
    });
    reset?.addEventListener('click', () => {
      alive = 3;
      render();
    });
    render();
  }
}
