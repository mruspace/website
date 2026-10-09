// The quorum demo on Home and the 3 / 2 / 1 table on How it works.
// Mode names, bar widths and notes from the Home artboard.
export type Alive = 3 | 2 | 1;

export interface QuorumState {
  mode: string;
  width: string;
  note: string;
}

export const TMR: Record<Alive, QuorumState> = {
  3: { mode: 'Vote', width: '92%', note: 'Two of three must agree. One bad result is outvoted.' },
  2: { mode: 'Compare', width: '88%', note: 'Both must agree. A mismatch loses that result.' },
  1: { mode: 'Stopped', width: '0%', note: 'No majority possible. Halts for good.' },
};

export const MRU: Record<Alive, QuorumState> = {
  3: { mode: 'Vote', width: '92%', note: 'Same decision as TMR.' },
  2: {
    mode: 'Compare',
    width: '88%',
    note: 'Same decision as TMR. On a mismatch, a known-answer test finds the faulty processor.',
  },
  1: { mode: 'Self-check', width: '46%', note: 'Computes twice, delivers on a match. Half rate.' },
};

// How it works, "Same hardware. Two designs."
export const TABLE: { left: string; tmr: string; mru: string; hl?: boolean }[] = [
  { left: '3', tmr: 'Vote. One bad result is outvoted.', mru: 'Vote. One bad result is outvoted.' },
  { left: '2', tmr: 'Compare. A mismatch loses the result.', mru: 'Compare. A known-answer test finds the bad one.' },
  {
    left: '1',
    tmr: 'Stopped, for good.',
    mru: 'Still working, at half speed. It computes twice and checks itself.',
    hl: true,
  },
];
