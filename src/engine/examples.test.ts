/**
 * The worked examples from SPEC §2.4, verbatim: 3 players on 10×10.
 * Seat order Amani → Bo → Chen. Amani takes the full classic fleet; Bo takes
 * battleship, cruiser and submarine; Chen takes only a destroyer.
 */
import { describe, expect, it } from 'vitest';
import { legalCalls, reduce } from './game.ts';
import { ALL_CLASSIC, at, call, navalRules, pid, resolved, seat, ship, startedGame } from './test-utils.ts';

const seats = [seat('Amani', ALL_CLASSIC), seat('Bo', ['battleship', 'cruiser', 'submarine']), seat('Chen', ['destroyer'])];

// Layouts consistent with the example: Bo's cruiser covers D4–D5, his
// battleship covers E5 but not E4; Chen's destroyer is D4–D5; Amani has
// nothing on D4, D5, E4 or E5.
const layouts = {
  Amani: [
    ship('carrier', 'A1', 'alongRow'),
    ship('battleship', 'B1', 'alongRow'),
    ship('cruiser', 'H1', 'alongRow'),
    ship('submarine', 'I1', 'alongRow'),
    ship('destroyer', 'J1', 'alongRow'),
  ],
  Bo: [ship('cruiser', 'D3', 'alongRow'), ship('battleship', 'E5', 'alongRow'), ship('submarine', 'A8', 'alongRow')],
  Chen: [ship('destroyer', 'D4', 'alongRow')],
};

describe('§2.4 worked examples', () => {
  const s0 = startedGame(seats, layouts, 'Amani');

  const t1 = call(s0, 'Amani', 'D4');
  const t2 = call(t1.state, 'Bo', 'D5');

  it('turn 1: Amani calls D4 — miss / hit: cruiser / hit: destroyer', () => {
    expect(resolved(t1.events)).toEqual(['Amani:D4:miss', 'Bo:D4:hit:cruiser', 'Chen:D4:hit:destroyer']);
    expect(t1.state.seats[t1.state.current]?.id).toBe('Bo');
  });

  it('turn 2: Bo calls D5, hitting his own cruiser to sink Chen’s destroyer; Chen goes nuclear', () => {
    expect(resolved(t2.events)).toEqual(['Amani:D5:miss', 'Bo:D5:hit:cruiser', 'Chen:D5:hit:destroyer']);
    expect(t2.events).toContainEqual({
      kind: 'shipSunk',
      turn: 2,
      board: 'Chen',
      ship: 'destroyer',
      cells: [at('D4'), at('D5')],
    });
    expect(t2.events).toContainEqual({ kind: 'wentNuclear', turn: 2, player: 'Chen' });
    expect(t2.state.phase).toBe('playing');
  });

  it('turn 3: Chen’s bomb at J10 is illegal (off the board) and does not use the turn', () => {
    const r = reduce(t2.state, { kind: 'call', player: pid('Chen'), at: at('J10') });
    expect(r).toEqual({ ok: false, error: 'bombOffBoard' });
    expect(t2.state.seats[t2.state.current]?.id).toBe('Chen');
  });

  it('turn 3 (retry): Chen bombs D4; D4 and D5 were called, so only E4 and E5 resolve; Chen’s board is no target', () => {
    const t3 = call(t2.state, 'Chen', 'D4');
    expect(t3.events[0]).toEqual({
      kind: 'shotCalled',
      turn: 3,
      by: 'Chen',
      at: at('D4'),
      shape: 'bomb',
      cells: [at('D4'), at('D5'), at('E4'), at('E5')],
    });
    expect(resolved(t3.events)).toEqual(['Amani:E4:miss', 'Amani:E5:miss', 'Bo:E4:miss', 'Bo:E5:hit:battleship']);
    expect(t3.state.seats[t3.state.current]?.id).toBe('Amani');
  });

  it('a nuclear player’s legal calls are bomb corners that fit on the board', () => {
    const corners = legalCalls(t2.state, pid('Chen'));
    expect(corners.every((c) => c.row <= 8 && c.col <= 8)).toBe(true);
    expect(corners).toContainEqual(at('D4'));
    expect(corners).not.toContainEqual(at('J10'));
  });
});

describe('§2.4 end of the game', () => {
  // Chen is already nuclear; Amani and Bo each have one unhit square left.
  const endSeats = [seat('Amani', ['destroyer']), seat('Bo', ['destroyer']), seat('Chen', ['destroyer'])];

  function playTo(amaniDestroyer: string) {
    const s0 = startedGame(
      endSeats,
      {
        Amani: [ship('destroyer', amaniDestroyer, 'alongRow')],
        Bo: [ship('destroyer', 'G6', 'alongRow')],
        Chen: [ship('destroyer', 'J9', 'alongRow')],
      },
      'Amani',
    );
    let s = call(s0, 'Amani', 'J9').state; // hits Chen
    s = call(s, 'Bo', 'J10').state; // sinks Chen: Chen goes nuclear
    s = call(s, 'Chen', 'C2').state; // a bomb into open water
    return s;
  }

  it('Bo’s last square is G7: Amani calls G7, Bo goes nuclear, Amani is the last fleet standing', () => {
    // (The spec's sentence says both are at G7 here, which contradicts the next
    // example; we read it as Bo's last square being G7 and Amani's elsewhere.)
    let s = playTo('A1'); // Amani: A1–A2
    s = call(s, 'Amani', 'A2').state; // Amani hits her own A2; her last square is A1
    s = call(s, 'Bo', 'G6').state; // Bo hits his own G6; his last square is G7
    s = call(s, 'Chen', 'E1').state;
    const end = call(s, 'Amani', 'G7');
    expect(end.events).toContainEqual({ kind: 'wentNuclear', turn: 7, player: 'Bo' });
    expect(end.events.at(-1)).toEqual({ kind: 'gameOver', turn: 7, result: { kind: 'lastFleet', player: 'Amani' } });
    expect(end.state.phase).toBe('over');
  });

  it('if Amani’s last square were also G7, both go nuclear and there is no last fleet', () => {
    let s = playTo('G7'); // Amani: G7–G8
    s = call(s, 'Amani', 'G8').state; // her last square is G7
    s = call(s, 'Bo', 'G6').state; // his last square is G7
    s = call(s, 'Chen', 'E1').state;
    const end = call(s, 'Amani', 'G7');
    expect(end.events.at(-1)).toEqual({
      kind: 'gameOver',
      turn: 7,
      result: { kind: 'allNuclear', lastToSink: ['Amani', 'Bo'] },
    });
  });
});

describe('playing it out (playOut)', () => {
  const endSeats = [seat('Amani', ['destroyer']), seat('Bo', ['destroyer']), seat('Chen', ['destroyer'])];
  const rules = navalRules({ playOut: true });

  /** Same game as above: after turn 7 Amani (last square A1) is the last fleet standing. */
  function toLastFleet() {
    let s = startedGame(
      endSeats,
      {
        Amani: [ship('destroyer', 'A1', 'alongRow')],
        Bo: [ship('destroyer', 'G6', 'alongRow')],
        Chen: [ship('destroyer', 'J9', 'alongRow')],
      },
      'Amani',
      rules,
    );
    for (const [who, sq] of [['Amani', 'J9'], ['Bo', 'J10'], ['Chen', 'C2'], ['Amani', 'A2'], ['Bo', 'G6'], ['Chen', 'E1']] as const) {
      s = call(s, who, sq).state;
    }
    return call(s, 'Amani', 'G7');
  }

  it('announces the last fleet standing and keeps playing', () => {
    const t7 = toLastFleet();
    expect(t7.events).toContainEqual({ kind: 'lastFleetStanding', turn: 7, player: 'Amani' });
    expect(t7.events.some((e) => e.kind === 'gameOver')).toBe(false);
    expect(t7.state.phase).toBe('playing');
    expect(t7.state.standing).toEqual({ player: 'Amani', turn: 7 });
    // Everyone keeps their turn: Bo (now nuclear) bombs next.
    expect(t7.state.seats[t7.state.current]?.id).toBe('Bo');
  });

  it('the last fleet can only call squares on its own board', () => {
    let s = toLastFleet().state;
    s = call(s, 'Bo', 'E5').state;
    s = call(s, 'Chen', 'F5').state;
    const legal = legalCalls(s, pid('Amani'));
    expect(legal).toContainEqual(at('A1'));
    expect(legal).not.toContainEqual(at('A2'));
  });

  it('ends when the last fleet sinks, crediting how long it held out', () => {
    let s = toLastFleet().state;
    const end = call(s, 'Bo', 'A1'); // Bo's bomb covers A1: Amani's last square
    expect(end.events).toContainEqual({ kind: 'wentNuclear', turn: 8, player: 'Amani' });
    expect(end.events.at(-1)).toEqual({ kind: 'gameOver', turn: 8, result: { kind: 'playedOut', player: 'Amani', standingFrom: 7 } });
    s = end.state;
    expect(s.phase).toBe('over');
  });

  it('the table can end it early: the last fleet standing wins as before', () => {
    const r = reduce(toLastFleet().state, { kind: 'endGame' });
    if (!r.ok) throw new Error(r.error);
    expect(r.value.events).toEqual([{ kind: 'gameOver', turn: 7, result: { kind: 'lastFleet', player: 'Amani' } }]);
    expect(r.value.state.phase).toBe('over');
  });

  it('endGame is only allowed once a last fleet is standing', () => {
    const s0 = startedGame(endSeats, {}, 'Amani', rules);
    expect(reduce(s0, { kind: 'endGame' })).toEqual({ ok: false, error: 'wrongPhase' });
  });
});

describe('§2.4 selfFire: false (engine and simulation only)', () => {
  const rules = navalRules({ selfFire: false });
  const s0 = startedGame(seats, layouts, 'Amani', rules);
  const t1 = call(s0, 'Amani', 'D4');

  it('turn 1: Amani’s own board is not shot', () => {
    expect(resolved(t1.events)).toEqual(['Bo:D4:hit:cruiser', 'Chen:D4:hit:destroyer']);
  });

  it('a later single call at D4 is legal: it resolves on Amani’s board and is alreadyShot on the others', () => {
    // Bo calls D4 on turn 2. His own board isn't a target without selfFire.
    const t2 = call(t1.state, 'Bo', 'D4');
    expect(resolved(t2.events)).toEqual(['Amani:D4:miss', 'Chen:D4:alreadyShot']);
  });

  it('a square called on every target board is illegal', () => {
    const t2 = call(t1.state, 'Bo', 'D4');
    const r = reduce(t2.state, { kind: 'call', player: pid('Chen'), at: at('D4') });
    // Chen's targets are Amani's and Bo's boards, and D4 is now shot on both.
    expect(r).toEqual({ ok: false, error: 'noUnshotTarget' });
  });
});
