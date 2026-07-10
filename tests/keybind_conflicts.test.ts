import { describe, expect, it } from 'vitest';
import { BIND_ACTIONS, Keybinds } from '../src/game/keybinds';
import {
  type ControllerBindRow,
  computeKeybindConflicts,
  describeEviction,
  type KeyboardBindRow,
} from '../src/ui/keybind_conflicts';

// keybind_conflicts is a PURE core (no DOM, no i18n runtime, deterministic): it computes
// the conflict / unbound / duplicate state from plain data mirroring the real Keybinds
// (one code on at most one action, up to two codes per action) and the controller button
// map. The rail, the inline row cues, and the top-of-pane banner all read this one
// result. There is no IWorld, so the Sim/ClientWorld parity row is N/A.

const kbRow = (
  id: string,
  codes: (string | null)[],
  opts: { category?: string; allowShared?: boolean } = {},
): KeyboardBindRow => ({
  id,
  category: opts.category ?? 'Interface',
  codes,
  allowShared: opts.allowShared,
});

const padRow = (button: number, action: string, label = `#${button}`): ControllerBindRow => ({
  button,
  action,
  label,
});

// Minimal localStorage stub so the real Keybinds class (localStorage-backed) loads its
// defaults and persists in-memory during the integration test.
function installStorage(): void {
  const map = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

// Adapter: the plain KeyboardBindRow shape the pure core consumes, read off a live
// Keybinds instance exactly as the P4 wiring will.
function rowsOf(kb: Keybinds): KeyboardBindRow[] {
  return BIND_ACTIONS.map((a) => ({
    id: a.id,
    category: a.category,
    codes: [kb.codeAt(a.id, 0), kb.codeAt(a.id, 1)],
    allowShared: a.allowShared,
  }));
}

describe('computeKeybindConflicts: empty and clean tables', () => {
  it('empty tables produce no warnings', () => {
    const r = computeKeybindConflicts([], []);
    expect(r.unbound).toEqual([]);
    expect(r.duplicateCodes).toEqual([]);
    expect(r.controllerDuplicates).toEqual([]);
    expect(r.keyboardWarning).toBe(false);
    expect(r.controllerWarning).toBe(false);
    expect(r.anyWarning).toBe(false);
  });

  it('a fully bound, duplicate-free table warns nowhere', () => {
    const r = computeKeybindConflicts(
      [kbRow('a', ['KeyA', null]), kbRow('b', ['KeyB', 'KeyC'])],
      [padRow(0, 'jump'), padRow(1, 'interact')],
    );
    expect(r.anyWarning).toBe(false);
  });
});

describe('computeKeybindConflicts: keyboard unbound detection', () => {
  it('flags an action with no codes as unbound, in input order', () => {
    const r = computeKeybindConflicts(
      [kbRow('a', ['KeyA', null]), kbRow('b', [null, null]), kbRow('c', [null, null])],
      [],
    );
    expect(r.unbound).toEqual(['b', 'c']);
    expect(r.keyboardWarning).toBe(true);
    expect(r.anyWarning).toBe(true);
  });
});

describe('computeKeybindConflicts: keyboard duplicate codes', () => {
  it('flags a code held by two non-shared actions', () => {
    const r = computeKeybindConflicts([kbRow('a', ['KeyA', null]), kbRow('b', ['KeyA', null])], []);
    expect(r.duplicateCodes).toEqual(['KeyA']);
    expect(r.keyboardWarning).toBe(true);
  });

  it('does NOT flag a code shared with an allowShared action (Attack Move / Turn Left)', () => {
    const r = computeKeybindConflicts(
      [
        kbRow('turnLeft', ['KeyA', null]),
        kbRow('attackMove', ['KeyA', null], { allowShared: true }),
      ],
      [],
    );
    expect(r.duplicateCodes).toEqual([]);
    expect(r.keyboardWarning).toBe(false);
  });

  it('distinguishes a modifier combo from the bare code (Shift+Digit1 vs Digit1)', () => {
    const r = computeKeybindConflicts(
      [kbRow('a', ['Digit1', null]), kbRow('b', ['Shift+Digit1', null])],
      [],
    );
    expect(r.duplicateCodes).toEqual([]);
  });
});

describe('computeKeybindConflicts: controller duplicate groups (named)', () => {
  it('names the pair of buttons sharing one non-Unbound action', () => {
    const r = computeKeybindConflicts(
      [],
      [padRow(4, 'slot1', 'LB'), padRow(5, 'slot1', 'RB'), padRow(0, 'jump', 'A')],
    );
    expect(r.controllerDuplicates).toEqual([
      { action: 'slot1', buttons: [4, 5], labels: ['LB', 'RB'] },
    ]);
    expect(r.controllerWarning).toBe(true);
    expect(r.anyWarning).toBe(true);
  });

  it('groups three or more buttons on one action into a single named group', () => {
    const r = computeKeybindConflicts(
      [],
      [padRow(0, 'target', 'A'), padRow(3, 'target', 'Y'), padRow(5, 'target', 'RB')],
    );
    expect(r.controllerDuplicates).toEqual([
      { action: 'target', buttons: [0, 3, 5], labels: ['A', 'Y', 'RB'] },
    ]);
  });

  it("treats 'none' and '' actions as unbound, never a duplicate", () => {
    const r = computeKeybindConflicts(
      [],
      [padRow(0, 'none', 'A'), padRow(1, 'none', 'B'), padRow(2, '', 'X')],
    );
    expect(r.controllerDuplicates).toEqual([]);
    expect(r.controllerWarning).toBe(false);
  });
});

describe('describeEviction: names the loser of a just-performed steal', () => {
  it('returns the prior holder of the code (and null when no one held it)', () => {
    const before = [kbRow('interact', ['KeyF', null]), kbRow('bags', ['KeyB', null])];
    expect(describeEviction(before, 'bags', 'KeyF')).toEqual({
      code: 'KeyF',
      gained: 'bags',
      evicted: 'interact',
    });
    // a fresh code nobody held: no eviction
    expect(describeEviction(before, 'bags', 'KeyZ')).toBeNull();
  });

  it('reports no eviction when the gaining action is itself allowShared (steal sweep skipped)', () => {
    const before = [
      kbRow('turnLeft', ['KeyA', null]),
      kbRow('attackMove', ['KeyQ', null], { allowShared: true }),
    ];
    // binding KeyA onto the shared attackMove does not evict turnLeft (real bind() skips
    // the mutual-eviction sweep whenever the gaining side opts into sharing).
    expect(describeEviction(before, 'attackMove', 'KeyA')).toBeNull();
  });

  it('never names a shared holder as the evicted action', () => {
    const before = [kbRow('attackMove', ['KeyA', null], { allowShared: true })];
    expect(describeEviction(before, 'turnLeft', 'KeyA')).toBeNull();
  });
});

describe('keybind_conflicts against the REAL Keybinds steal semantics', () => {
  it('a steal leaves no duplicate codes but lists the fully-unbound loser', () => {
    installStorage();
    const kb = new Keybinds('conflict-test');
    const before = rowsOf(kb);

    // Post-modernization baseline: the default layout ships NO keyboard duplicate
    // (the old KeyH collision is gone), and the strafe keys ship unbound-by-default,
    // so they are the only baseline unbound actions (in registry order).
    const baseline = computeKeybindConflicts(before, []);
    expect(baseline.duplicateCodes).toEqual([]);
    expect(baseline.unbound).toEqual(['strafeLeft', 'strafeRight']);
    expect(baseline.unbound).not.toContain('interact');

    // interact defaults to its only code KeyF; steal it onto bags (default KeyB).
    expect(kb.codeAt('interact', 0)).toBe('KeyF');
    const eviction = describeEviction(before, 'bags', 'KeyF');
    expect(eviction).toEqual({ code: 'KeyF', gained: 'bags', evicted: 'interact' });

    expect(kb.bind('bags', 0, 'KeyF')).toBe(true);
    const after = computeKeybindConflicts(rowsOf(kb), []);

    // The real bind removed KeyF from interact, so the stolen code is on exactly one
    // action now (the steal never leaves the moved code duplicated), and still no dupes.
    expect(after.duplicateCodes).toEqual([]);
    // interact, whose sole code was stolen, is now fully unbound and joins the strafe
    // pair in the unbound list (registry order: strafe rows precede interact).
    expect(kb.codeAt('interact', 0)).toBeNull();
    expect(after.unbound).toEqual(['strafeLeft', 'strafeRight', 'interact']);
    expect(after.keyboardWarning).toBe(true);

    // The KeyH pair no longer collides (Damage Meters moved to KeyZ).
    expect(after.duplicateCodes).not.toContain('KeyH');
  });
});
