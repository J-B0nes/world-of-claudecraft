# The v1 Deed catalog: authoring rules

This directory is the reviewable source of truth for the launch catalog. The
first implement session transcribes it into `src/sim/content/deeds.ts`. Edit
here first, code second, until that session lands.

## Files

| File | Prefixes | Target | Steam quota |
|---|---|---|---|
| progression-combat.md | prog_, cmb_ | ~35 | 14 |
| dungeons-delves.md | dgn_, dlv_ (+ cmb_ for the world boss) | ~40 | 20 |
| chronicles.md | chr_ | 9 chapter metas | 3 |
| collection.md | col_ | ~25 | 8 |
| pvp-sport.md | pvp_ | ~25 | 12 |
| social-economy-exploration.md | soc_, exp_ | ~25 | 8 |
| feats-hidden.md | feat_, hid_ | ~20 | 6 |

Roughly 180 deeds total; Steam marquee total must stay comfortably under 100.
(The table above records the original authoring targets; the audited
post-review counts, which drifted from them slightly, live in the Assembly
resolutions section below.)

## Entry format (uniform, one block per deed)

```
### <deed_id>
- Name: <English name, WoCC voice>
- Desc: <one player-facing English sentence; states the criteria plainly>
- Renown: 0 | 5 | 10 | 25 | 50
- Trigger: <precise, implementable condition over REAL game state>
- Reward: none | title "<Title>" | border <slug>
- Hidden: no | yes (reveal note)
- Steam: no | ACH_<UPPER_SNAKE>
- Notes: <optional: balance notes, trigger site, retro behavior>
```

## Hard rules

1. Only reference content that actually exists in `src/sim/content/` on this
   branch. Read the files; never invent a mob, zone, item, boss, or system.
   Cite the source file in Notes when the reference is non-obvious.
2. Renown scale: 5 routine, 10 standard, 25 notable, 50 prestige. ZERO Renown
   for anything luck-dependent (rare drops), for dynamic metas whose
   requirements grow with content, and for all feats. The account score must
   never be able to decrease.
3. Rewards are cosmetic only: titles and borders in v1, nothing else. Most
   deeds reward none; titles go on marquee deeds (aim 15 to 20 titles total),
   borders on meta capstones (aim about 6). Reserved titles already taken by
   the milestone deeds: Veteran, Champion, Paragon, Mythic, Eternal.
4. Trigger vocabulary (use only these shapes): predicate over persisted state
   (level, questsDone, delveClears, arenaRating, craftSkills, and similar),
   lifetime counter threshold (new deedStats counters), completion (specific
   dungeon/delve/quest/encounter, normal or heroic), mechanical / perfection /
   restriction / speed (encounter skill tasks that fail ONLY through player
   error, never RNG), collection (own or have logged specific items), 
   interaction (NPC, POI, object), and meta (a list of other deed ids).
5. No permanently missable deeds. Anything tied to seasonal or retired content
   is a Feat (feat_, 0 Renown), excluded from completion percentages.
6. PvP uses rating thresholds and match milestones that cannot be win-traded
   profitably; social deeds count outcomes, not attempts, and must be
   satisfiable only by being a better teammate. No deed may reward griefing,
   AFK attendance, or pure login.
7. Grind thresholds sit where natural play lands. Most of the catalog must be
   reachable in the first two-thirds of a character's journey; sub-1% unlocks
   are deliberate prestige only.
8. Hidden deeds (hid_) are a small set of delights and spoiler-guards: fully
   invisible until earned. Everything else shows criteria and progress.
9. Voice: playful classic-MMO English. In-world proper nouns are fine; no
   real-world references except sanctioned easter eggs (Bursar Fernando
   precedent; Saul the Chronicler). No em dashes, en dashes, or emojis.
10. Steam column: marquee, legible, spoiler-safe deeds only (Steam names and
    descriptions are public); hidden deeds may be Steam-hidden. API names are
    stable forever: `ACH_` plus the upper-snake deed id without its prefix
    where unambiguous.

## Registries (kept in sync during assembly)

- Titles: each catalog file lists its proposed titles at the top; duplicates
  are resolved at assembly.
- Borders: proposed border slugs likewise.
- Steam: each file lists its ACH_ names at the top for the global under-100
  audit.

## Assembly resolutions (authoritative; read before transcription)

Audited totals after the adversarial-review fixes (2026-07-08, scripted
recount): 197 deed blocks across the seven files (chronicles 23, collection
24, dungeons-delves 42, feats-hidden 19, progression-combat 36, pvp-sport 28,
social-economy-exploration 25), no duplicate ids, names, titles, or ACH
names; 2,370 total Renown; 21 titles; 3 borders; 70 Steam entries authored.
After the deferrals below (11 blocks, 85 Renown, 2 Steam, 2 titles), the v1
launch set is 186 deeds, 2,285 Renown, 68 Steam entries, 19 titles, 3
borders.

1. DEFERRED means: the block STAYS in this catalog as reviewed design, but is
   NOT transcribed into `src/sim/content/deeds.ts` or `DEED_ORDER` in v1, and
   its ACH_ name is NOT registered on Steam yet. The first implement session
   lists every deferred id in its commit body (the no-silent-drop rule).
2. Deferred for account-level evaluation (the v1 evaluator is per-character;
   a follow-up server-grant lane can land these): prog_three_paths,
   prog_ninefold (holds ACH_NINEFOLD), and the seven server-assisted feats:
   feat_before_the_book, feat_realm_first_cap, feat_founders_circle,
   feat_realm_first_nythraxis, feat_realm_first_thunzharr,
   feat_realm_chronicler, feat_top_of_the_book.
3. Deferred as currently unearnable: prog_ringwright (holds ACH_RINGWRIGHT);
   jewelcrafting, inscription, and enchanting have zero recipes today.
   MAINTAINER FLAG: revisit when those crafts get recipes.
4. Cut from v1: pvp_vcup_bet_flex (marked optional by its author; we do not
   ship betting-adjacent deeds, even at 0 Renown).
5. Fiesta gating: online Fiesta practice and the offline sandbox both run the
   real match logic, so every pvp_fiesta_* trigger counts REAL matchmade bouts
   only (never practice bouts). The sim-core session verifies a
   practice-match flag exists to gate on; any Fiesta deed it cannot gate is
   deferred, not shipped farmable.
6. Chronicler NPC template ids are pinned: chronicler_saul,
   chronicler_osric_fenn, chronicler_edda_hartwell (definitions in
   chronicles.md).
7. feat_era_cap is resolved via a `DEEDS_ERA` string constant in
   src/sim/content/deeds.ts, bumped only by the maintainer at era boundaries.
8. Zone naming: zone 2 is Mirefen Marsh (mirefen_marsh); "Deepfen" is one of
   its POIs, not the zone. Early design notes that say "the Deepfen" mean
   Mirefen Marsh.
9. Cross-file requirement ids in chronicles.md are pinned to the real deed
   ids (dgn_hollow_crypt, dgn_sunken_bastion, dgn_gravewyrm_sanctum,
   dlv_reliquary, dlv_litany, cmb_thunzharr).
10. dgn_sanctum_speed ships with its 15-minute threshold marked
    CALIBRATE-AT-IMPLEMENT (no instance timestamp persists yet; the sim-core
    session picks the mechanism, the window session shows no timer UI).
11. Duplicate sweep (adversarial review): five duplicated accomplishments
    were merged. col_delve_journal was DELETED; the one global journal deed
    is dlv_lore_journal (dungeons-delves.md), which now holds
    ACH_DELVE_JOURNAL. hid_golden_goal was DELETED (its ACH_GOLDEN_GOAL slot
    with it); the golden-goal moment lives solely on pvp_vcup_golden_goal
    (pvp-sport.md, rated-gated). The three chr_*_landmarks tasks were
    DELETED; the per-zone visit-all-POIs deeds are exp_vale_wayfarer,
    exp_marsh_wayfarer, exp_peaks_wayfarer (social-economy-exploration.md,
    which owns the single POI-visit mechanism: the poisVisited set, within
    20 yd, 1 Hz sweep), and the Chronicle Chapter I metas require them.
12. Vale Cup gating standard (mirrors resolution 5's Fiesta rule): Cup
    participation deeds demand a PERSONAL OUTCOME, never attendance.
    chr_vale_cup_debut requires a personal ball touch in a QUEUED bout;
    pvp_vcup_first_match requires seeing the match out AND a personal touch,
    kick, or save. Bot-backfilled queued bouts count for these two debuts
    only; practice bouts and offline-staged bouts NEVER count for any Cup
    or Fiesta deed.
13. Discovery-ladder retune: the top rung is col_discovery_250 (threshold
    250, ACH_DISCOVERY_250, border curators_gilt). 250 is luck-independent
    by construction: 253 sub-rare items plus the 10 deterministic Heroic
    Quartermaster epics clear it with zero rare-quality drops, and World
    Market purchases count as acquisition.

## Assembly resolutions, polish round (2026-07-09)

Catalog re-review against the tree as of this round (salvage, the level-20
crafting hub, the professions intro quest, heroic equalization, and the
pre-baseline audit holes: the Nythraxis crypt, the Drowned Temple back half,
Sethrael, the Marsh fishing debut). This section APPENDS to the 2026-07-08
resolutions above and never rewrites them.

14. Audited totals after this round (scripted recount of deeds.ts): 8 new
    blocks authored (progression-combat 4, dungeons-delves 1, chronicles 1,
    social-economy-exploration 2); 6 transcribed, 2 deferred (resolution 17).
    The live set is 192 deeds (progression 30, combat 10, dungeon 27, delve
    13, chronicle 24, collection 24, pvp 27, social 16, exploration 9, feat
    3, hidden 9), 2,365 Renown, 19 titles, 3 borders, 72 Steam entries
    (ACH_CROWN_BELOW, ACH_MERE_AT_REST, ACH_TOOLS_OF_THE_TRADE,
    ACH_NYTHRAXIS_CRYPT are the four new). New-deed Renown: 80 transcribed
    (plus 15 authored-deferred), inside the round's 60 to 110 window.

15. The no-retro-edit rule, binding this round and the next: existing deed
    TRIGGERS are never retro-edited. Widening a trigger list changes
    mid-progress fractions and re-scopes an earned deed's meaning; additions
    land as NEW deeds only. (Earned records are append-only either way; this
    keeps displayed progress honest.) Applied here: chr_marsh_first_cast is
    NOT added to the Marsh chapter metas, and Sethrael coverage lands inside
    prog_mere_at_rest (q_palecoil) rather than editing chr_marsh_rares.

16. Deferral rechecks, all re-verified against this tree:
    - prog_ringwright STAYS deferred: recipes.ts still carries 15 recipes,
      zero for jewelcrafting, inscription, or enchanting (scripted recount;
      the upstream enchanting PR is not merged here).
    - The nine account-level ids (prog_three_paths, prog_ninefold, the seven
      server-assisted feat_*) STAY deferred: server/deeds_records.ts is
      still observer-only; no account-level grant lane exists.
    - Deferral costs no art: the 11 orphan files in the maintainer's icon
      set already cover the deferred and cut ids.

17. NEW deferral: soc_first_salvage and soc_salvage_50 are authored (see
    social-economy-exploration.md) but NOT transcribed: salvage has zero
    player-facing wiring on any host (no IWorld member, no UI caller, no
    wire message or server command; Sim.salvageItem is not-yet-wired by its
    own comment), so both deeds would be visible yet unearnable by anyone,
    the prog_ringwright class. Their salvagesPerformed counter ships with
    the transcription (the counter doctrine forbids a key no deed reads).
    ACH_FIRST_SALVAGE is held, not registered. MAINTAINER FLAG: transcribe
    when salvage lands its player-facing surface.

18. Considered and rejected this round, each with its reason:
    - Class set-bonus collections: drop-luck gated; rule 2's zero renown
      would make them pure noise.
    - Per-class deeds: the catalog is deliberately class-agnostic.
    - Warlock pet collection: class-specific, same rule.
    - Lore letters: no counter exists and low signal.
    - Daily-reward streaks: login-shaped, forbidden by rule 6.
    - Heroic equalization: a difficulty retune; the existing dgn_ deeds
      already cover every instance at both difficulties. No catalog action.
    - The professions-intro "first profession pick" arm: no pick or
      selection state exists on this branch (professions are use-based
      skills), so no clean predicate; the deed covers q_prof_intro
      completion only.
    - A standalone Sethrael kill deed: covered via q_palecoil inside
      prog_mere_at_rest (the shortlist's preferred route); a second deed for
      the same rare would double-award one outcome.
    - A dungeonClears trigger for the crypt: nythraxis_crypt has no final
      boss (empty spawn list; relic-raised guardians), so the key never
      records and the deed would be permanently unearnable; the certifying
      quest predicate ships instead.
    - A crafting-hub visit-only deed: a visit is an attempt surface, not an
      outcome; the shipped deed counts station-bound craft completions.

19. Trigger-kind note for reviewers: prog_crown_below and prog_mere_at_rest
    are the first shipped users of the 'quests' trigger kind (the evaluator
    arm existed unused; content previously reached all-of-quests only
    through the meta questIds arm). No evaluator change was needed.

20. Verification-pass completeness addendum (2026-07-09): two further
    profession systems landed in the review range with no player-reachable
    outcome today, recorded here so no in-range system lacks a written
    resolution:
    - Recipe acquisition (professions/crafting.ts acquireRecipe and the
      knownRecipes set, with the optional per-recipe acquisition field in
      professions/types.ts): inert in this tree. No shipped recipe carries
      an acquisition entry (every recipe is grandfathered known) and no
      host exposes a learn surface (no IWorld member, no UI caller, no
      wire message, no server command), so a learn-a-recipe deed would be
      visible yet unearnable by anyone, the prog_ringwright class. No deed
      ships; revisit when a recipe actually requires acquisition.
    - Archetype refinement helpers (professions/archetype.ts pairedMajor
      plus the hobby and ceiling lookups): no new player-reachable outcome
      (the accept and switch surfaces are still empty client stubs, and
      archetype selection itself predates the v1 baseline), and the
      catalog stays class and archetype agnostic besides (resolution 18).
      No deed ships.
21. Post-round deferral recheck (2026-07-10, after the upstream enchanting
    profession PR #1712 merged into this branch): resolution 16's
    parenthetical "the upstream enchanting PR is not merged here" no longer
    holds, and "zero recipes" no longer describes enchanting: an ENCHANTS
    table now lives in src/sim/content/enchants.ts, and disenchant plus
    apply-enchant gain flat enchanting skill in the sim. Every deferral
    STANDS on the surviving ground: neither disenchant nor apply-enchant has
    player-facing wiring on any host (no IWorld member, no UI caller, no
    wire or server command; the module documents its own not-yet-wired
    status, the salvageItem class), jewelcrafting and inscription still have
    zero recipes, and salvage wiring is unchanged (resolution 17 holds).
    prog_ringwright, soc_first_salvage, and soc_salvage_50 stay
    untranscribed, and no enchanting deed ships (the resolution 20
    inert-system class; revisit when the player-facing surface lands).
    collection.md's "fully-enchanted equipment" rejection is superseded in
    its premise (per-item enchantment state now exists on ItemInstancePayload
    and PlayerMeta.equipmentInstance) but stands in its conclusion for the
    same no-wiring reason; any future coverage lands as NEW deeds per
    resolution 15. Two evaluator-side effects of the merge were fixed in
    code the same day, test-first: the enchanting skill-gain sites now mark
    the player deeds-dirty (the crafting.ts craftItem contract), and
    retroFallbackGrants no longer reads craftSkills.enchanting as proof of a
    first craft (it would have permanently misgranted prog_first_craft to a
    disenchant-only character on join).
