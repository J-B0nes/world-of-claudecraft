# Professions System: Design Review and First-Slice Recommendation

Review of the high-level [Professions System manifesto](https://woc.nervemart.com/docs/professions-system),
grounded against the current codebase (`release/v0.17.0`). The goal is buy-in on the
vision plus the handful of decisions worth locking before the work is spread across
contributors. This is not a line edit of the manifesto.

Date: 2026-06-30

## TL;DR

This is one of the strongest design docs we have had, and the vision deserves buy-in.
The thesis is sharp and falsifiable (a specialist beats a generalist by construction via
the conserved-mass production wheel, with all growth routed off-wheel into additive
gathering), and the architecture maps cleanly onto our real seams (SimContext modules,
content-as-code via `data.ts`, additive JSONB persistence, IWorld-first). It also brings
its own guardrails: the fragility section and mirror theorem are exactly what stops a
professions system from rotting over time.

One principle is already decided and worth stating up front: professions are accessible from
level 1 everywhere, not gated behind level 20 or maxed talents. What curves as the zones get
higher is depth and content, not access. The game targets every kind of player (questers,
PvPers, dungeon runners, crafters, and pure skillers), so a player can stay combat level 1
and progress entirely through gathering and crafting if that is the game they want to play.
The work should also be structured for parallel contribution: define the shared schemas and
the IWorld facet first, then each skill, recipe, and node is an independent additive task in
its own module, so multiple people can build at once without stepping on each other.

Before we split up the work, four decisions are worth locking, because three of them are
foundations the manifesto treats as no-ops and one is the biggest risk to how it feels:

1. **Item instances.** We have no per-item-instance model today. Signed materials,
   charged tools, and rolled-quality crafted gear all need item identity. This should be
   its own early foundation slice.
2. **Binding (BoP/BoE).** Undecided, and the whole interdependence pitch hinges on it.
3. **Alts and the economy.** Conserved mass binds a character, but an account owns 10.
   We also need an output throttle and a real gold sink.
4. **Decay model.** Destructive, silent, no-respec decay is a known footgun for our
   RuneScape-leaning audience. Reversible attunement is worth serious consideration.

The recommended first slice for this issue is the **Gathering Foundation, kept fully
fungible**, which sidesteps the item-instance question and ships tradeable value at low
risk.

## What is strong

- **Architecture is genuinely repo-grounded.** Gathering, crafting, and the wheel as
  SimContext modules; content-as-code tables merged by `data.ts`; additive optional JSONB
  fields on the character following the proven talents/delve/arena backfill pattern; and
  the IWorld-first seam all match how this repo actually lands features.
- **Crafting-only effects as the identity axis.** Differentiating crafted gear by effects
  (procs, utility, set bonuses) rather than raw item level is the single best lever in the
  design and the one most likely to age well. It is how WoW kept Engineering, Tailoring,
  and unique crafted trinkets desirable for years. Protect it.
- **Social input-side scarcity.** Single-use, first-come, signed monster corpses plus an
  additive gathering focus that lets a group divide component duty is an elegant, social
  alternative to artificial daily cooldowns. Per-player world-node respawn kills
  node-camping and gather-rush griefing.
- **The common-tier free floor.** Anyone can still bang out a basic sword, which preserves
  universality and removes the worst crafting feel-bad while reserving the conserved-mass
  tension for the tiers that actually matter.
- **Emergent naming.** You craft swords and the game calls you a Smith. This is a
  genuinely delightful core that players, not just designers, will love, and it costs
  little comprehension because it is a reward rather than a rule to master.
- **Design discipline.** The fragility section, the mirror theorem, and the rule that
  growth routes off-wheel are precisely the guardrails that would have prevented WoW's
  profession bloat and dead-recipe sprawl.

## Decisions to lock before spreading the work

### 1. The per-item-instance model (engineering foundation)

We have no per-item-instance model today. Inventory is `{itemId, count}`, equipment is a
slot to id-string map (`Partial<Record<EquipSlot, string>>`), and the market keys on
`itemId`. `addItem` merges purely by `itemId`. All item attributes live in the static
`ITEMS[id]` table.

That means three manifesto features cannot exist as written:

- **Signed materials** (a gatherer's name stamped on a rare+ material): two same-id mats
  with different signers would silently merge into one stack.
- **Charged tools** (per-effect durability/charge counts): nowhere to store the count.
- **Rolled-quality crafted gear** (a rolled quality and rolled stats within an ilvl
  budget): every craft instance differs, so it cannot be a static `ITEMS[id]` lookup.

The manifesto's claim that these "flow through existing systems unchanged" is true for
fungible stacks (raw ore, herbs, infinite-durability base tools) and false for anything
carrying identity. The fix is a real, cross-cutting foundation, not a no-op: it touches
inventory, equipment, trade, market, vendor, the interest-scoped snapshot, the wire
encoder, and JSONB load/save at once. **Spec it as its own early foundation slice, before
tools / monster-harvesting / crafted-gear, not bolted on afterward.** The gathering
foundation (slice 1) can stay fully fungible and does not need it.

### 2. Binding policy (BoP / BoE)

Items are freely tradable today (no bind system). The interdependence thesis lives or dies
here. If crafted gear is competitive with rare-to-epic drops and freely auctionable, the
buyer ends up identically geared, so a specialist's edge is purely economic (sole
supplier), not power. BoP-on-craft, conversely, breaks the sell-your-specialty premise
outright.

Write an explicit per-output-class binding policy as a hard invariant. The cleanest answer
is likely BoE base gear that competes on crafting-only effects plus non-transferable
crafter bonuses (recharge discount, observed-use improvement), with any "sometimes better
than current drops" case reserved for BoP-on-craft. A Dragonflight-style crafting-orders /
commission layer on top of `market.ts` is a clean way to route demand to a named
specialist rather than the anonymous lowest listing.

### 3. Alts and the economy (throttle plus gold sink)

Conserved mass constrains a character, but an account owns up to 10 of them (the only cap
is two simultaneous live sessions). Five alts across the five mirror-pairs cover the whole
wheel after a one-time grind, and that player never has to trade again. The manifesto never
mentions alts or account-level economy.

Pick a lane and state it: either accept conserved mass is per-character and re-scope
interdependence toward consumable churn and time-value, or anchor real exclusivity to the
scarce social input (contested monster corpses that a coordinated group out-harvests a solo
alt army), or add an account-aware constraint.

Related and just as load-bearing: per-player respawning nodes are an unbounded material
faucet, the only gold sink in the game today is the 5 percent market cut (no
durability/repair), and conserved mass throttles who can make top-tier goods but not how
many a maxed specialist produces. With a real auction house already shipped, the high-value
crafted market will race to material-cost plus a thin margin unless we add an output
throttle (a regenerating per-craft resource, or making top-tier output strictly require
scarce signed monster materials so the input throttle binds) and a real gold sink.

### 4. The decay model (the biggest risk to how it feels)

Destructive, silent, no-respec conserved-mass decay plus a "Don't Ask Again" that mutes the
only safety net is the documented Ultima Online / pre-NGE Star Wars Galaxies failure mode.
A bulk crafter helping a friend can silently drain a main craft they spent hours on,
recoverable only by a full re-grind. Level loss is the single most hated mechanic in the
RuneScape family, and our players skew that way; loss aversion makes the pain dwarf the
gain.

Strongly consider reframing conserved mass as **reversible attunement**: craft levels only
ever go up, but only your top-two adjacent crafts are empowered at a time via a swappable
loadout (a cost or cooldown to re-attune, not a re-grind). If destructive decay survives
review, make it slow, always visible, and never silent: per-craft protect/lock (the lesson
UO retrofitted), no permanent silence on a protected craft, a per-batch warning with a live
before/after preview, and a fast-rebound "specialization memory" so a misclick costs
minutes, not hours.

## Accessible everywhere, depth that curves with the zones

Decided: professions are not gated behind a level requirement, maxed talents, or any other
unlock. They are available from level 1, in the first zone, to every character. This is the
RuneScape half of the WoW-plus-RuneScape blend: skills are a parallel progression track you
can pursue from the very start, not a level-gated endgame system bolted on at the cap.

The rationale is player diversity. Some players will want to live in professions and
gathering, others in quests, others in PvP. Gating crafting behind level 20 or behind a
finished talent tree would tell the would-be crafter that the part of the game they care
about does not begin for hours. Instead, a brand-new character can gather and craft on day
one and have a real role: a level 1 in zone 1 can mine, tan leather, and hammer out basic
armor for other players, and be a useful part of the economy and the social fabric before
they have killed much of anything. (The RuneScape inspiration is explicit here: low-level
crafters making and offering goods and services to others is part of the fantasy.)

What scales is depth and content, not access. Accessibility is flat; the curve is in how
far the system goes as you move outward:

- **Zone 1 (early):** universal gathering and common-tier crafting on the free floor. Basic
  nodes, basic recipes, no conserved-mass pressure yet. This is where a level 1 makes armor
  for friends.
- **Higher zones:** higher-tier materials, monster harvesting, the conserved-mass wheel and
  archetypes (pressure only begins at uncommon and above), specialization perks, and
  crafting hubs. The system reveals its deep end exactly as the world gets harder.

This lines up with the manifesto's own common-tier free floor: everyone, everywhere, can
make common basics at no cost to specialization, and the conserved-mass tension is reserved
for the uncommon-and-up tiers that naturally live in the higher zones. So the level 20+ zone
below is about integrating and deepening profession content, never about unlocking
professions in the first place.

## Skilling as a standalone way to play (skillers)

The game is for every kind of player: questers, PvPers, dungeon runners, crafters, and pure
skillers. Each of those should be a complete way to play on its own, not a side activity you
do between fights. Professions carry the skiller pillar, and we should design it so a player
can spend their whole time gathering and crafting and feel like they are playing the game,
not waiting to play it.

Concretely, a skiller can stay combat level 1 and progress entirely through gathering and
crafting. Combat level (the character XP from kills and quests) and skilling progression
(gathering proficiency and craft skill) are separate tracks, and neither gates the other. A
player who only ever wants to woodcut, mine, fish, and tailor can do exactly that, take
those skills to the top, and never swing a sword. This is the classic RuneScape skiller, and
our gathering design already fits it: gathering is additive, universal, breadth-free, and
available from level 1, which is precisely the "just let me max woodcutting" fantasy.

What it takes to make skilling a true pillar rather than merely an available activity:

- **A non-combat path to a high gathering tier.** A skiller must be able to reach a
  respectable, economically relevant tier in pure safety. The very top can be reserved for
  risk (dangerous or contested areas) or for trade, which is good risk/reward design, but
  there has to be a safe road for most of the way up. A dedicated safe skilling area is one
  clean way to provide it, and it doubles as a natural town build-out.
- **Top-tier crafting must not hard-require combat.** Reaching the best crafted output should
  be possible by combining world materials a skiller gathers themselves with monster
  materials bought from combat players. A pure skiller can be a top crafter purely by trading
  for the monster components. Keep monster harvesting as one input lane, never the only path
  to the top, so a non-combatant is never hard-locked out of the deep end.
- **Progression and recognition independent of combat.** Skill levels, titles, and ideally
  per-profession leaderboards, so a skiller advances and is seen on their own track, the same
  way a raider or a PvPer is. We already have a lifetime-XP leaderboard; a gathering or
  crafting equivalent would give skillers the same status hook.
- **A non-combat quest path.** Enough gather, craft, and deliver quests that a skiller has a
  questline of their own, and the archetype acceptance lore quests (the diegetic switching
  cost) completable without fighting, so the profession identity is reachable by someone who
  never fights.

The payoff is that skillers become the supply backbone of the economy. They feed the combat
players their materials and gear, and the combat players feed them monster components and
gold. That mutual need is exactly the interdependence the whole design is chasing, and a
healthy skiller population is what makes the auction house and the bespoke-commission model
actually work. It also softens the alt concern: when there is a real specialist supply side,
self-sufficiency by alt is a convenience, not an advantage.

## Where professions plug into the rest of the game

This is where the system stops being a standalone screen and starts making the whole game
richer.

### Quests beyond combat

Today quest objectives are a small union: `kill`, `collect`, and `interact`
(`src/sim/types.ts`, `src/sim/content/CLAUDE.md`). Professions let quests stop being "go
hit this monster" and start being "make something". A profession-aware objective type
(`craft` / `gather` / `cook`) is a clean, additive extension to that union, and `collect`
already overlaps with gathering, so the very first integration ("collect N of a gathered
material") works the moment gathering ships, with no new objective type at all.

What this unlocks:

- **Varied objectives.** "Brew 3 healing potions for the field medic," "Cook a hearty stew
  for the innkeeper," "Smith a set of horseshoes," "Harvest a venom sac from a marsh drake
  at rare tier." Quests teach professions in context instead of in a tutorial panel.
- **Gather to craft to deliver chains.** Multi-step turn-ins that exercise the whole loop
  (harvest the input, craft the output, hand it in) make a far better tutorial for the
  wheel than a wall of text.
- **Recipe acquisition as content.** Recipe acquisition is currently undefined in the
  manifesto. Quest rewards are a natural home for it: a questline grants a pattern, which
  ties the recipe layer to tooling we already have (`content/quests`, `/wiki` generation)
  rather than inventing a new system.
- **Crafting commissions as repeatable quests.** Daily/repeatable NPC "make me X" quests
  double as the crafting-orders / commission seam flagged under binding, and give a
  bounded, designer-controlled demand sink for crafted goods.

### A level 20+ zone built around professions

Professions are live everywhere from level 1 (see above), so this is not where they unlock.
A new high-level zone is where the deeper, integrated profession content concentrates, and
it doubles as a low-risk rollout surface for that content: rather than retrofitting
higher-tier nodes, monster harvesting, crafting hubs, and profession quests across the
entire existing world at once, we can land them in one new zone and expand outward as the
system proves out.

A level 20+ zone gives professions a place to matter:

- **Higher-tier materials gate behind the zone.** The rare/epic nodes and the
  monster-harvest corpses that feed top-tier crafting live here, which fits the
  conserved-mass tier curve perfectly: low levels stay on the common free floor where there
  is no pressure, and the specialization tension and high-tier inputs arrive exactly when
  players reach the new zone.
- **A crafting hub.** A town build-out with crafting stations and a profession trainer
  gives the author's own named dependency (stations) a single contained home instead of a
  world-wide rollout.
- **Things to do that are not combat.** Gathering circuits, crafting orders, recipe chases,
  and the social corpse-harvest loop with a coordinated group are real, repeatable
  activities for max-and-near-max players, which is exactly the kind of high-level content
  we want more of.
- **A questline that teaches the wheel.** The zone's quests can walk a player from the
  common floor into their first uncommon push (where drain begins), surface the archetype
  title, and reveal the hobby, so the system reveals itself through play.

We already build zones as content (`zone1`/`zone2`/`zone3`), so a new zone follows the
existing pattern. Pairing the professions rollout with a new level 20+ zone turns "a
crafting feature" into "a content update with a reason to log in," and it gives the team a
clean, self-contained surface to ship against.

## Non-blocking notes

None of these block the first slice, but they should each get a conscious call:

- **Recipe acquisition** needs a layer orthogonal to the tier gate (trainer baseline, rare
  drop patterns as chase content, plus reputation or discovery for the long tail). Skill
  tier gates what you can make; acquisition gates what you know. Quests are a strong vector
  here (see above).
- **The radar / wheel UI** has to survive our mobile-landscape and accessibility contracts
  (text alternatives, focus management, forced-colors, 24px touch targets). A 10-axis radar
  is a poor encoding for the threshold judgement players actually make and is hard to read
  on a phone. Lead the HUD with an identity card plus adjacency-grouped bars and a
  trajectory line; keep the radar as a secondary expert view. Prototype on a phone at
  844x390 before locking it.
- **Bot exposure.** Per-player infinite, uncontested nodes remove the natural anti-bot
  friction (contention) that RuneScape relies on, and gathering is the most-botted MMO
  activity. Plan for per-node diminishing returns or a soft personal cap, light engagement
  per action, and lean on our determinism plus server authority for anomaly detection.
- **Headless RL env.** All profession logic compiles into the headless loop, so per-tick
  node respawn timers, corpse flags, and decay run every tick. Decide explicitly whether
  professions are out of scope for the agent (accept and measure the per-tick cost) or in
  scope (own extending `obs.ts` across all three hosts in lockstep).
- **Wheel migration and testing.** The manifesto's own fragility warning has no mechanism
  yet. Commit to a wheel schema version and a migration routine, and add a testing-strategy
  section: the conserved-mass invariant draws no RNG, so the repo's strongest safety net
  (the draw-order parity gate) cannot see a wheel regression. We need property/invariant
  tests (total skill within budget, deterministic drain ordering, decay convergence, stable
  majors/hobby derivation).
- **Cooking universality, recycling, and stations.** Cooking on the wheel gates raid food
  buffs behind two archetypes (WoW deliberately made it universal); consider a universal
  common/uncommon food floor. Disenchant/Salvage is parked in "future" but the wheel
  produces a mid-tier glut with no recycling sink at launch; consider promoting it into the
  gathering foundation. Define crafting-station placement and contention rules before
  stations land.

## Codebase grounding: what we reuse vs what we build

What genuinely exists and is reusable:

| Capability | Status | Detail |
|---|---|---|
| Six-tier quality enum | Reuse | `poor / common / uncommon / rare / epic / legendary` on `BaseItemDef` (`src/sim/types.ts:312`), already used by loot, tooltips, and the ilvl tables. No new tier type needed. |
| Item-level / stat budget | Reuse (partial) | `src/sim/item_level.ts` is a pure, RNG-free leaf with `primaryStatBudget()` and `normalizePrimaryStats()`. A craft can compute a level from material tier + skill and call these. But `itemLevel()` derives level only from a mob-loot/quest source index and is consumed only by HUD tooltips, so the create-time stat-roll path is new. |
| Channeled gather/craft action | Reuse | Fishing is the working template: a timed cast channel that on completion does one weighted RNG roll over a content table and `addItem`s the result (`sim.ts:4246-4312`, `FISHING_TABLES`). It has no proficiency layer, so the skill layer is net-new. |
| Inventory / vendor / market plumbing | Reuse (fungible only) | `addItem/removeItem/countItem`, vendor `npc.vendorItems`, and `Market`/`MarketListing` all work unchanged for stackable materials and stateless base tools. |
| World objects (nodes, stations) | Reuse | `GroundObjectDef` + `createGroundObject` + the `interaction.ts` dispatcher + the render object path are the seam for gather nodes and crafting stations. |
| SimContext seam + content-as-code | Reuse | New `src/sim/professions/{gathering,crafting,wheel,focus,tools}.ts` modules with state on `Sim` as live ctx views; content tables merge via `data.ts` like `ITEMS`/`MOBS`. |
| Additive JSONB persistence | Reuse | New optional fields on the character (gather proficiency, craft skills, majors/hobby, focus, learned recipes) load with no migration via the proven backfill pattern. |
| Party / guild for group play | Reuse | Party/raid and guild systems exist for the group-coordination and observed-use credit ideas. |

What is a real gap the work must build:

| Gap | Severity | Detail |
|---|---|---|
| Per-item-instance model | High | No instance id, no per-item mutable state, no signer field, no per-effect charge field anywhere. Blocks signed materials, charged tools, and rolled-quality crafted gear. Load-bearing for the tools / harvesting / crafted-gear slices. |
| Per-player node respawn | High | Today harvest state is a single global lootable flag + respawn timer per object; one harvest hides the node for everyone, and `sim.time` resets to 0 on restart. Per-player availability must be added to the snapshot, IWorld, and the ClientWorld mirror, with restart persistence. |
| Proficiency / wheel / focus state and math | High | No gathering or crafting proficiency exists at all (fishing has none). The conserved-mass wheel, focus, archetype derivation, and decay are entirely net-new state plus math. |
| Create-time stat roll | Medium | Nothing today generates an item's stats at creation; `recalcPlayerStats` reads hand-authored `def.stats`. The budget primitives are reusable, but the roll path is new. |
| Mob component-type tags + corpse harvest | Medium | A new additive `MobTemplate` field plus a per-corpse harvest state machine distinct from loot/tap. |
| IWorld facet size | Medium | A professions facet bumps the IWorld parity members and command tables (kept in lockstep across Sim and ClientWorld). `IWorldDelves` is the closest blueprint. |
| Animations and UI primitives | Medium | No harvest/mine/craft animation clip (reuse the cast clip as fishing does for slice 1); no radar/wheel UI primitive exists. |

One correction to the manifesto: there is no single ~120-yard interest radius. Players,
objects, and world events scope at 90 yards (`INTEREST_RADIUS`, `EVENT_RADIUS`); 120 yards
is NPC-only. Any observed-use XP design keys off the 90-yard player/event scope.

## Building it so multiple people can work in parallel

The reason to get the vision and the seams right up front is that the implementation can then
be spread across contributors who rarely touch the same file. The repo's existing
module-first, data-as-code doctrine already supports this, and professions should lean into
it hard. The architecture must stay clean, scalable, and well separated so that adding a new
skill, craft, recipe, or quest is a small, isolated, additive task rather than a change to
shared code.

The enabling move is to land the shared contracts first, then fan out. Define the record
schemas (a skill, a craft, a recipe, a node), the IWorld professions facet, the wire and
snapshot keys, and the persistence fields as a small foundation, publish them, and from that
point individual skills, crafts, recipes, and nodes become independent work items anyone can
pick up without coordination.

Decompose along the seams the repo already has, so owners hold non-overlapping files:

- **Content authors (data-as-code).** Each gathering skill, craft, recipe, and node is a
  declarative record in `src/sim/content/` (`professions.ts`, `recipes.ts`,
  `gather_nodes.ts`), merged by `data.ts`. Adding Mining vs Herbalism vs Logging, or one
  recipe line vs another, is a new record, not an edit to a coordinator, so two people adding
  two skills do not conflict. This is what "let others begin a skill" means concretely: a
  contributor writes one self-contained skill record plus its node placements plus its wiki
  page, and it is done.
- **System owners (SimContext modules).** Each profession behavior is its own small module
  behind the SimContext seam
  (`src/sim/professions/{gathering,crafting,wheel,focus,tools}.ts`), owned by one person,
  with backing state held on `Sim` as live ctx views and thin delegates. No method clusters
  get added to `sim.ts`. The wheel owner and the gathering owner work in separate files.
- **Seam owner (IWorld).** One person defines and maintains the professions facet on
  `IWorld`, plus the wire and snapshot keys and persistence fields, and keeps the parity
  gates green. Once that surface is published, the sim, server, and UI work proceeds against
  the interface in parallel instead of waiting on each other.
- **UI owner (module-first HUD).** The professions HUD is its own component (a `*_view` pure
  core plus a painter on the PainterHost seam), so it never collides with `hud.ts`. Whoever
  builds the wheel view works independently of whoever wires the harvest action.

Conventions that keep the parallel work merge-clean and correct:

- **Contracts before content.** Sequence the foundation slices (the per-item-instance model,
  the IWorld professions facet, the skill/recipe/node schemas) first. They are the shared
  dependencies; everything fans out cleanly only after they exist. Do not start ten skills
  before the skill schema is settled.
- **One record per concept, small slices.** Each skill, craft, recipe, or node is a single
  focused record, and each slice is its own spec and PR. Small additive diffs are easy to
  review and rarely conflict.
- **Append content records last.** New nodes and content placements go at the end of their
  tables to preserve world-gen RNG draw order (a determinism requirement, and conveniently
  the layout that minimizes merge conflicts).
- **Each module unit-tested in isolation.** The pure modules (wheel math, the stat-budget
  roll, focus allocation) are host-agnostic and imported directly by Vitest, so an owner can
  build and prove their piece without the rest of the system running.
- **Never grow the monoliths.** `sim.ts`, `hud.ts`, `renderer.ts`, and `main.ts` are
  coordinators; new profession logic lands as sibling modules behind the existing seams, not
  as new sections inside them. This is the single most important rule for keeping many
  contributors out of each other's way.

Net: with the schemas and the IWorld facet defined up front, the long tail of professions
content (every skill, every recipe, every node, every profession quest) becomes a backlog of
small, independent, well-isolated tasks the team can parallelize. That is exactly the
autonomy the vision is aiming for.

## Recommended first slice (this issue)

Ship the **Gathering Foundation** and keep every item **fungible**, so the per-instance gap
does not block it.

Reuse:

- Gather nodes as `GroundObjectDef` placements in a new `gather_nodes.ts` merged like
  `GROUND_OBJECTS` (append placements last to preserve world-gen RNG draw order), spawned
  via `createGroundObject`, harvested through the `interaction.ts` dispatcher with an RNG
  rarity roll modeled on `completeFishing`.
- Drive the harvest channel through the fishing cast bar and cast clip, so no new animation
  is needed.
- Surface materials through existing bags and base tools through the existing vendor, so no
  new inventory UI is needed.

Build:

- `src/sim/professions/gathering.ts` behind SimContext holding per-player node respawn
  state (with restart persistence using the market `secondsLeft` JSONB pattern) and
  gathering proficiency as new optional character fields with backfill.
- A minimal IWorld read-plus-act surface (per-skill gather level, nearby-node availability
  and ready state, a harvest command) implemented in both `Sim` and `ClientWorld`, updating
  the parity and command gates in lockstep.
- Per-player node availability in the interest-scoped snapshot.
- A gathering page added to the `/wiki` guide as a new content type.

Defer to later slices (all blocked on the per-instance model): signed materials, charged
tools, crafted-gear stat rolls, the conserved-mass wheel, and the radar UI. Do not
front-load the wheel/perks/focus/recipe read surface.

Two determinism musts: route every roll through `ctx.rng` (the architecture test
auto-covers new files), and append node placements last.

Critically, spec the **per-item-instance model as its own early foundation slice before**
tools / harvesting / crafted-gear, since it touches inventory, equipment, market, trade,
vendor, the snapshot/wire, and persistence all at once.

## Open decisions checklist

- [ ] Per-item-instance model: instance id + payload, or stay `itemId + count`? How do two
      rolled crafted swords stack, list, and persist? (Gating dependency.)
- [ ] Binding policy per output class: BoP-on-craft, BoE, or freely tradable?
- [ ] Per-character vs per-account interdependence: is alt-based self-sufficiency accepted,
      or do we need an account-aware constraint?
- [ ] Output supply throttle and gold sink: what caps a maxed specialist's volume, and what
      drains coin in proportion to the new faucet? Are high-rarity world materials contested
      or personal-infinite?
- [ ] Decay model: destructive exponential decay vs reversible attunement; and if decay
      stays, how it accrues offline/idle, survives restart, and is protected from accidental
      batch-craft drain.
- [ ] Recipe acquisition layer orthogonal to the tier gate (trainer / drop / reputation /
      discovery / quests).
- [ ] Skiller pillar: confirm combat level and skilling progression are fully decoupled, and
      that there is a safe, non-combat path to a high gathering tier (with the very top
      reserved for risk or trade).
- [ ] Confirm top-tier crafting is reachable without combat (self-gathered world materials
      plus monster materials bought from combat players), so monster harvesting is one input
      lane, not the only path to the top.
- [ ] Skiller progression and recognition: per-profession skill levels and titles, possibly
      leaderboards, and a non-combat quest path (including the archetype acceptance quests).
- [ ] Solo / low-population path: is Jack of All Trades a first-class self-sufficient build,
      and does the economy assume a trading population?
- [ ] RL env scope: are professions trainable (extend `obs.ts` across all three hosts) or
      out of scope (accept the per-tick cost)?
- [ ] Monster-harvest ownership rule relative to the existing loot owner-lock + FFA lapse +
      despawn race.
- [ ] Central UI: bars-first identity view vs radar-primary, and how it meets the
      mobile-landscape and accessibility contracts.
- [ ] Wheel schema version + migration routine, and a conserved-mass invariant test plan.
- [ ] Conscious calls on Cooking universality, Disenchant/Salvage timing, enchant
      commoditization, and crafting-station placement/contention.
- [ ] Quest integration: confirm a `craft` / `gather` objective type and how recipes are
      granted via quests.
- [ ] Level 20+ zone: confirm the higher-tier nodes, monster harvesting, crafting hub, and
      profession quests concentrate in a new high-level zone. (Professions themselves are not
      level-gated; that is decided.)
- [ ] Publish the shared contracts first (skill / recipe / node schemas, the IWorld
      professions facet, and the persistence fields) before fanning out the content work, so
      contributors can add skills and recipes in parallel without conflicts.

## Summary for the thread

Strong buy-in on the vision. The thesis is sharp, the architecture lines up with our real
seams, and the best idea in it (crafted gear that differs by effect, not item level) is the
one most likely to age well. Before we split up the work, let's lock four things: the
item-instance model (we have none today, and signed mats / charged tools / rolled gear all
need it, so it should be its own early slice), binding (BoP/BoE), the alt + economy
throttle question, and the decay model (reversible attunement over silent destructive
drain). First slice should be the gathering foundation kept fully fungible. And two
multipliers worth planning for now: profession-aware quest objectives (cook this, craft
that, not just kill that) and pairing the rollout with a new level 20+ zone and crafting
hub so this lands as a content update with a reason to log in, not just a new screen. One
principle is decided: professions are accessible from level 1 everywhere, not gated behind
level 20 or maxed talents; what scales with the zones is depth, not access (a level 1 in zone
1 should be able to hammer out armor for other players). The game should also support pure
skillers: a player can stay combat level 1 and live entirely in gathering and crafting,
which makes them the supply backbone of the economy, so let's keep a safe, non-combat path to
a high gathering tier and make sure top-tier crafting never hard-requires combat. And we
should build it for parallel work: define the record schemas and the IWorld facet up front,
then every skill, recipe, and node becomes an independent, additive task contributors can
pick up without stepping on each other, with all the logic in small modules behind our
existing seams rather than in the monoliths.
