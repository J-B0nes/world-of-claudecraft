// Pure, host-agnostic view-model for the Esc options window.
//
// The pure-core half of the cold-window pure-core + thin-painter split (root
// CLAUDE.md Conventions; reference vendor_view.ts / social_view.ts). The options
// window is the densest control surface in the HUD: nine sub-panels reached
// through a small family of reusable control primitives. This module owns the
// DECLARATIVE model the painter renders: which control of which kind sits in
// which panel, its setting key, its label key, its choice set, and the pure
// value-coercion each control fires when changed. The DOM, the i18n runtime, the
// audio/music singletons, and the dispatch wiring all live in options_window.ts;
// the structure and the dispatch contract are decided here so a Vitest can pin
// every sub-panel's dispatch without a DOM.
//
// DOM/Three-free and game-free: setting keys are plain strings (the painter
// narrows them against the real GameSettings), label keys are t() keys the
// painter resolves. Registered in tests/architecture.test.ts UI_PURE_CORES.

import type { TranslationKey } from './i18n.catalog';
import {
  CATEGORIES,
  CATEGORY_SECTIONS,
  type CategoryId,
  categorySettingKeys,
  type EnvGating,
  type NonSettingSearchRow,
  type OptionRow,
  RAIL_GROUPS,
  type RailGroupId,
  SEARCH_SYNONYMS,
} from './options_ia';

// ---------------------------------------------------------------------------
// Control primitive descriptors (cluster 1)
// ---------------------------------------------------------------------------
// The four setting-write controls share a uniform dispatch (each fires
// onSettingChange(key, value)); they differ only in the value contract, which is
// the one thing worth modelling per kind. Do NOT collapse them: a slider carries
// a numeric range, a toggle an on/off, a boolToggle a true/false store key, a
// choice an enumerated set.

/** How a slider's readout is formatted; the painter maps this to a formatter. */
export type SliderFmt = 'percent' | 'degrees' | 'oneDecimal';

export interface SliderControl {
  control: 'slider';
  /** A NumericSettingKey (the painter narrows it to the live settings store). */
  key: string;
  labelKey: TranslationKey;
  min: number;
  max: number;
  step: number;
  /** Current value at build time; the painter re-reads the live value on input. */
  value: number;
  fmt: SliderFmt;
  /** Commit the setting on release ('change') instead of live on every 'input'
   *  tick. Set for uiScale, whose live rescale moves the slider under the cursor
   *  mid-drag (issue 1558); dragging updates only the readout, not the setting.
   *  Other sliders keep their intended live preview (volume, fov, frame scale). */
  commitOnChange?: boolean;
}

export interface ToggleControl {
  control: 'toggle';
  /** A numeric 0/1 setting key (on when the stored value is >= 0.5). */
  key: string;
  labelKey: TranslationKey;
  on: boolean;
}

export interface BoolToggleControl {
  control: 'boolToggle';
  /** A BOOL_SETTINGS key (true/false stored directly). */
  key: string;
  labelKey: TranslationKey;
  on: boolean;
}

export interface ChoiceOption {
  value: number;
  labelKey: TranslationKey;
}

export interface ChoiceControl {
  control: 'choice';
  key: string;
  labelKey: TranslationKey;
  /** The currently selected value (rounded, matching the inline button-sync). */
  current: number;
  options: ChoiceOption[];
  /** True when selecting an option re-renders the panel (preset + interfaceMode). */
  rerender: boolean;
}

/** A standalone explanatory line rendered between controls (class set-note). */
export interface NoteControl {
  control: 'note';
  textKey: TranslationKey;
}

/** Position marker for the bespoke music on/off toggle inside the audio panel.
 *  It reads the live MusicDirector singleton, not a setting, so it carries only a
 *  label; the painter renders + dispatches it. */
export interface MusicToggleControl {
  control: 'musicToggle';
  labelKey: TranslationKey;
}

export type OptionsControl =
  | SliderControl
  | ToggleControl
  | BoolToggleControl
  | ChoiceControl
  | NoteControl
  | MusicToggleControl;

// ---------------------------------------------------------------------------
// Pure dispatch-value functions (the dispatch matrix's load-bearing contract)
// ---------------------------------------------------------------------------
// Pinning each control's value coercion as a pure function lets the per-sub-panel
// dispatch test prove a control still fires the SAME write after extraction, with
// no DOM. The painter calls these exact functions, so the dispatch cannot drift.

/** A slider input dispatches the raw input value coerced to a Number. */
export const sliderDispatchValue = (rawValue: string): number => Number(rawValue);

/** A numeric toggle flips between 0 and 1 off the current stored value. */
export const toggleNextValue = (current: number): number => (current >= 0.5 ? 0 : 1);

/** A numeric toggle reads as on when its stored value is >= 0.5. */
export const toggleIsOn = (current: number): boolean => current >= 0.5;

/** A bool toggle flips the stored boolean. */
export const boolToggleNextValue = (current: boolean): boolean => !current;

// ---------------------------------------------------------------------------
// Settings projection + environment the panel builders read from
// ---------------------------------------------------------------------------

/** The minimal settings projection the options view-model needs. The painter
 *  builds it from the live Settings + SETTING_RANGES, keeping this core game-free. */
export interface OptionsSettingsSource {
  /** Current numeric value for a range/choice/slider setting key. */
  num(key: string): number;
  /** Current boolean value for a BOOL_SETTINGS key. */
  bool(key: string): boolean;
  /** Static [min, max] range for a numeric setting key (from SETTING_RANGES). */
  range(key: string): { min: number; max: number };
}

/** Device/shell flags that gate which rows a panel shows. */
export interface OptionsEnv {
  /** useTouchInterface(): reveals the touch-only sliders. */
  touch: boolean;
  /** isNativeAppShell(): hides the Interface Mode picker (the shell forces touch). */
  nativeShell: boolean;
}

const slider = (
  s: OptionsSettingsSource,
  key: string,
  labelKey: TranslationKey,
  fmt: SliderFmt = 'percent',
  step = 0.05,
): SliderControl => {
  const r = s.range(key);
  return { control: 'slider', key, labelKey, min: r.min, max: r.max, step, value: s.num(key), fmt };
};

const toggle = (
  s: OptionsSettingsSource,
  key: string,
  labelKey: TranslationKey,
): ToggleControl => ({
  control: 'toggle',
  key,
  labelKey,
  on: toggleIsOn(s.num(key)),
});

const boolToggle = (
  s: OptionsSettingsSource,
  key: string,
  labelKey: TranslationKey,
): BoolToggleControl => ({ control: 'boolToggle', key, labelKey, on: s.bool(key) });

const choice = (
  s: OptionsSettingsSource,
  key: string,
  labelKey: TranslationKey,
  options: ChoiceOption[],
  rerender = false,
): ChoiceControl => ({
  control: 'choice',
  key,
  labelKey,
  current: Math.round(s.num(key)),
  options,
  rerender,
});

const note = (textKey: TranslationKey): NoteControl => ({ control: 'note', textKey });

// The two-value low/high choice shared by the four advanced-preset sub-pickers.
const lowHighOptions: ChoiceOption[] = [
  { value: 0, labelKey: 'hud.options.terrainLow' },
  { value: 1, labelKey: 'hud.options.terrainHigh' },
];

// ---------------------------------------------------------------------------
// Main menu (cluster 5 routing)
// ---------------------------------------------------------------------------

/** A sub-view the main menu can route to (matches the painter's view discriminator). */
export type OptionsPanelId =
  | 'keybinds'
  | 'controller'
  | 'graphics'
  | 'interface'
  | 'audio'
  | 'performance'
  | 'bugreport';

export type OptionsMenuAction =
  | { kind: 'goto'; view: OptionsPanelId }
  | { kind: 'logout' }
  | { kind: 'close' };

export interface OptionsMenuEntry {
  labelKey: TranslationKey;
  action: OptionsMenuAction;
}

/** The main Esc-menu button list. The "Report a Bug" row is online-only (it needs
 *  an authoritative server to receive the report). */
export function buildOptionsMenu(opts: { bugReportAvailable: boolean }): OptionsMenuEntry[] {
  const entries: OptionsMenuEntry[] = [
    { labelKey: 'hud.options.keyBindings', action: { kind: 'goto', view: 'keybinds' } },
    { labelKey: 'hudChrome.controller.title', action: { kind: 'goto', view: 'controller' } },
    { labelKey: 'hud.options.graphics', action: { kind: 'goto', view: 'graphics' } },
    { labelKey: 'hud.options.interface', action: { kind: 'goto', view: 'interface' } },
    { labelKey: 'hud.options.audio', action: { kind: 'goto', view: 'audio' } },
    { labelKey: 'hudChrome.perf.title', action: { kind: 'goto', view: 'performance' } },
  ];
  if (opts.bugReportAvailable)
    entries.push({
      labelKey: 'hudChrome.bugReport.menuButton',
      action: { kind: 'goto', view: 'bugreport' },
    });
  entries.push({ labelKey: 'hud.options.logout', action: { kind: 'logout' } });
  entries.push({ labelKey: 'hud.options.returnToGame', action: { kind: 'close' } });
  return entries;
}

// ---------------------------------------------------------------------------
// Graphics panel (cluster 3) -- the static WebGL preset is read as a plain
// setting value here. This panel must NEVER read the FPS governor or define the
// effects-quality cutoff: that resolver and per-element tiering live in their
// own modules.
// ---------------------------------------------------------------------------

/** Body control rows for the Graphics sub-panel, in render order. The interleaved
 *  notes (browser-effects, interface-mode) live here; the painter appends the
 *  trailing graphics/reload notes + the reload button + footer as panel chrome. */
export function buildGraphicsControls(s: OptionsSettingsSource, env: OptionsEnv): OptionsControl[] {
  const out: OptionsControl[] = [];
  const graphicsPresetOptions: ChoiceOption[] = [
    { value: 1, labelKey: 'hud.options.graphicsPresetLow' },
    { value: 2, labelKey: 'hud.options.graphicsPresetMedium' },
    { value: 3, labelKey: 'hud.options.graphicsPresetHigh' },
  ];
  if (!env.nativeShell) {
    graphicsPresetOptions.push(
      { value: 4, labelKey: 'hud.options.graphicsPresetUltra' },
      { value: 5, labelKey: 'hud.options.graphicsPresetAdvanced' },
    );
  }
  out.push(choice(s, 'graphicsPreset', 'hud.options.graphicsQuality', graphicsPresetOptions, true));
  // Advanced preset (5) reveals the four per-system low/high pickers.
  if (Math.round(s.num('graphicsPreset')) === 5) {
    out.push(choice(s, 'terrainDetail', 'hud.options.terrainDetail', lowHighOptions));
    out.push(choice(s, 'foliageDensity', 'hud.options.foliageDensity', lowHighOptions));
    out.push(choice(s, 'effectsQuality', 'hud.options.effectsQuality', lowHighOptions));
    out.push(choice(s, 'shadowQuality', 'hud.options.shadowQuality', lowHighOptions));
  }
  out.push(
    choice(s, 'browserEffects', 'hudChrome.options.browserEffects', [
      { value: 0, labelKey: 'hudChrome.options.browserEffectsAuto' },
      { value: 1, labelKey: 'hudChrome.options.browserEffectsFull' },
      { value: 2, labelKey: 'hudChrome.options.browserEffectsReduced' },
      { value: 3, labelKey: 'hudChrome.options.browserEffectsMinimal' },
    ]),
  );
  out.push(note('hudChrome.options.browserEffectsNote'));
  // Desktop vs on-screen touch controls. Hidden in the native shell (forces touch).
  if (!env.nativeShell) {
    out.push(
      choice(
        s,
        'interfaceMode',
        'hudChrome.options.interfaceMode',
        [
          { value: 0, labelKey: 'hudChrome.options.interfaceModeAuto' },
          { value: 1, labelKey: 'hudChrome.options.interfaceModeDesktop' },
          { value: 2, labelKey: 'hudChrome.options.interfaceModeTouch' },
        ],
        true,
      ),
    );
    out.push(note('hudChrome.options.interfaceModeNote'));
  }
  out.push(slider(s, 'cameraSpeed', 'hud.options.cameraSpeed'));
  // Camera Speed only scales mouselook; touch gets a dedicated look-rate slider.
  if (env.touch) out.push(slider(s, 'touchLookSpeed', 'hud.options.touchLookSpeed'));
  out.push(slider(s, 'brightness', 'hud.options.brightness'));
  out.push(slider(s, 'cameraFov', 'hud.options.fieldOfView', 'degrees', 1));
  out.push(slider(s, 'renderScale', 'hud.options.renderQuality'));
  out.push(toggle(s, 'fullscreen', 'hud.options.fullscreen'));
  out.push(toggle(s, 'showOverflowXp', 'game.settings.showOverflowXp'));
  if (env.touch) out.push(slider(s, 'touchOpacity', 'hud.options.touchOpacity'));
  out.push(toggle(s, 'weather', 'game.settings.weather'));
  if (env.touch) out.push(slider(s, 'joystickScale', 'hud.options.joystickSize'));
  if (env.touch) out.push(slider(s, 'actionButtonScale', 'hud.options.buttonSize'));
  if (env.touch) out.push(slider(s, 'joystickDeadzone', 'hud.options.joystickDeadzone'));
  if (env.touch) out.push(boolToggle(s, 'touchInvertLook', 'hud.options.invertLook'));
  // Camera joystick is hidden/off by default (swipe-look is primary); left-handed
  // layout already has a Key Bindings row (leftHandedTouch), but is surfaced here
  // too since it is squarely a touch/graphics-panel concern for touch players.
  if (env.touch)
    out.push(boolToggle(s, 'mobileCameraJoystick', 'hudChrome.options.mobileCameraJoystick'));
  if (env.touch) out.push(boolToggle(s, 'leftHandedTouch', 'hudChrome.options.mobileLeftHanded'));
  return out;
}

// ---------------------------------------------------------------------------
// Audio panel (cluster 4)
// ---------------------------------------------------------------------------

/** Body control rows for the Audio sub-panel: three volume sliders, the bespoke
 *  music on/off toggle (reads the live MusicDirector), then the three audio bool
 *  toggles. The painter appends the footer. */
export function buildAudioControls(s: OptionsSettingsSource): OptionsControl[] {
  return [
    slider(s, 'sfxVolume', 'hud.options.soundEffects'),
    slider(s, 'musicVolume', 'hud.options.musicVolume'),
    slider(s, 'voiceVolume', 'hud.options.voiceVolume'),
    { control: 'musicToggle', labelKey: 'hud.options.music' },
    boolToggle(s, 'voiceEnabled', 'hud.options.npcVoices'),
    boolToggle(s, 'footstepSfx', 'hudChrome.options.footstepSounds'),
    boolToggle(s, 'clickFeedback', 'hudChrome.options.clickFeedback'),
  ];
}

// ---------------------------------------------------------------------------
// Controller panel (cluster 5) -- the enable/invert toggles + the three sliders.
// The per-button remap rows are bespoke (a dropdown per pad button) and live in
// the painter.
// ---------------------------------------------------------------------------

export function buildControllerControls(s: OptionsSettingsSource): OptionsControl[] {
  return [
    boolToggle(s, 'gamepadEnabled', 'hudChrome.controller.enable'),
    boolToggle(s, 'gamepadInvertY', 'hudChrome.controller.invertY'),
    slider(s, 'gamepadStickDeadzone', 'hudChrome.controller.deadzone'),
    slider(s, 'gamepadCameraSpeed', 'hudChrome.controller.cameraSpeed', 'oneDecimal'),
    slider(s, 'gamepadVibration', 'hudChrome.controller.vibration'),
  ];
}

// ---------------------------------------------------------------------------
// Interface & Comfort panel (cluster 5) -- the slider/boolToggle block that
// follows the bespoke language picker + theme controls. The chat-timestamp and
// chat-window-reset rows below it are bespoke and live in the painter.
// ---------------------------------------------------------------------------

export function buildInterfaceControls(s: OptionsSettingsSource): OptionsControl[] {
  return [
    // uiScale commits on release: applying it live rescales the whole UI (the
    // options window included), which shoves the slider under the cursor and makes
    // the value hard to land (issue 1558).
    { ...slider(s, 'uiScale', 'hudChrome.options.uiScale'), commitOnChange: true },
    slider(s, 'playerFrameScale', 'hudChrome.options.playerFrameScale'),
    slider(s, 'targetFrameScale', 'hudChrome.options.targetFrameScale'),
    slider(s, 'hudOpacity', 'hud.options.hudOpacity'),
    slider(s, 'tooltipScale', 'hud.options.tooltipScale'),
    slider(s, 'fctScale', 'hud.options.fctScale'),
    slider(s, 'chatFontScale', 'hud.options.chatFontScale'),
    slider(s, 'chatOpacity', 'hud.options.chatOpacity'),
    boolToggle(s, 'compactChat', 'hud.options.compactChat'),
    boolToggle(s, 'frostedPanels', 'hud.options.frostedPanels'),
    boolToggle(s, 'highContrastText', 'hud.options.highContrastText'),
    boolToggle(s, 'reduceMotion', 'hud.options.reduceMotion'),
    boolToggle(s, 'showWalletOnCharacterScreen', 'hudChrome.options.showWalletOnCharacterScreen'),
    boolToggle(s, 'showWalletOnPlayerCard', 'hudChrome.options.showWalletOnPlayerCard'),
    boolToggle(s, 'showDevBadges', 'hudChrome.options.showDevBadges'),
    boolToggle(s, 'showOwnNameplate', 'hudChrome.options.showOwnNameplate'),
    boolToggle(s, 'landingHighContrast', 'hudChrome.options.highContrastBackground'),
    boolToggle(s, 'invertLookY', 'hud.options.invertLookY'),
    boolToggle(s, 'startAttackOnAbilityUse', 'hudChrome.options.startAttackOnAbility'),
    boolToggle(s, 'walkByAutoloot', 'hudChrome.options.walkByAutoloot'),
    boolToggle(s, 'groundReticle', 'hudChrome.options.groundReticle'),
    boolToggle(s, 'aurasOnPlayerFrame', 'hudChrome.options.aurasOnPlayerFrame'),
    boolToggle(s, 'showItemLevel', 'hudChrome.options.showItemLevel'),
    boolToggle(s, 'showSecondaryActionBar', 'hudChrome.options.showSecondaryActionBar'),
    boolToggle(s, 'showDailyRewardsChest', 'hudChrome.options.showDailyRewardsChest'),
  ];
}

// ---------------------------------------------------------------------------
// Bug report (cluster 2) -- the ONE slice of IWorld the options window reads, so
// it is the ClientWorld-vs-Sim parity surface. The painter formats
// the coords; this core returns the raw values so both world shapes round-trip
// to the same info block.
// ---------------------------------------------------------------------------

export interface BugReportPlayer {
  name: string;
  pos: { x: number; y: number; z: number };
}

export interface BugReportInfo {
  /** True when the realm is known; the painter shows the 'unknown' key when false. */
  realmKnown: boolean;
  realm: string;
  characterName: string;
  pos: { x: number; y: number; z: number };
}

export function buildBugReportInfo(
  realm: string | null | undefined,
  player: BugReportPlayer,
): BugReportInfo {
  const known = !!realm;
  return {
    realmKnown: known,
    realm: known ? (realm as string) : '',
    characterName: player.name,
    pos: { x: player.pos.x, y: player.pos.y, z: player.pos.z },
  };
}

// ===========================================================================
// The Warden's Codex desktop chrome (P2): rail + category detail view-models.
// ---------------------------------------------------------------------------
// These consume the landed options_ia tree (the IA of record) to produce the
// two structural models the painter renders: the vertical rail (groups +
// category tabs, with the per-category changed-from-defaults count) and a
// category's detail pane (env-filtered sections + rows). Both are DOM/i18n-free
// so a Vitest can pin their shape; the painter resolves label keys via t() and
// binds live values through buildControlFromRow (which reuses the existing
// private control builders above, so a row's dispatch stays byte-identical).
// ===========================================================================

/** Device/shell flags gating which categories + rows a host reveals (mirrors
 *  the runtime useTouchInterface()/isNativeAppShell() the painter resolves). */
export interface RailEnv {
  touch: boolean;
  nativeShell: boolean;
}

/** One rail category tab. The conflict slot is reserved for P4 (always false
 *  in P2); the changed count is wired now from the category-to-keys map. */
export interface RailTabModel {
  id: CategoryId;
  iconSlug: string;
  nameKey: TranslationKey;
  subheadKey: TranslationKey;
  changedCount: number;
  hasConflict: boolean;
}

export interface RailGroupModel {
  id: RailGroupId;
  labelKey: TranslationKey;
  tabs: RailTabModel[];
}

/** The full rail: the Overview landing tab (above the groups) + the three
 *  rail groups, each holding its env-visible category tabs. */
export interface RailModel {
  overview: RailTabModel;
  groups: RailGroupModel[];
}

/** True when a category is revealed under the given host environment. The
 *  touch-only Touch category hides on desktop; the desktop-only Keybinds
 *  category hides on touch (nativeShellHidden is a ROW gate, not a category). */
function categoryVisible(env: EnvGating | undefined, e: RailEnv): boolean {
  if (!env) return true;
  if (env.touchOnly && !e.touch) return false;
  if (env.desktopOnly && e.touch) return false;
  return true;
}

/** The effective row gating: the row's own markers merged over its category's,
 *  resolved against the live host environment (see options_ia.rowEnv). */
function rowVisible(row: OptionRow, catEnv: EnvGating | undefined, e: RailEnv): boolean {
  const env: EnvGating = { ...(catEnv ?? {}), ...(row.env ?? {}) };
  if (env.touchOnly && !e.touch) return false;
  if (env.desktopOnly && e.touch) return false;
  if (env.nativeShellHidden && e.nativeShell) return false;
  return true;
}

/** The rail model: Overview first, then Display/Input/System groups with their
 *  env-visible categories. `changedCount(id)` supplies the per-category
 *  changed-from-defaults count (the painter computes it against the live
 *  settings + the SETTING_RANGES/BOOL_SETTINGS defaults). */
export function renderRailModel(e: RailEnv, changedCount: (id: CategoryId) => number): RailModel {
  const tabOf = (c: (typeof CATEGORIES)[number]): RailTabModel => ({
    id: c.id,
    iconSlug: c.iconSlug,
    nameKey: c.nameKey,
    subheadKey: c.subheadKey,
    changedCount: changedCount(c.id),
    hasConflict: false,
  });
  const overview = CATEGORIES.find((c) => c.id === 'overview');
  const groups: RailGroupModel[] = RAIL_GROUPS.map((g) => ({
    id: g.id,
    labelKey: g.labelKey,
    tabs: CATEGORIES.filter((c) => c.group === g.id && categoryVisible(c.env, e)).map(tabOf),
  }));
  return { overview: tabOf(overview as (typeof CATEGORIES)[number]), groups };
}

/** Section heads (spec section 4): a t() key per structural section id. Kept
 *  here (not in options_ia) so the P1 IA-of-record stays untouched; the comment
 *  in options_ia predicted "section HEAD keys are P2 chrome". Section ids are
 *  unique across the tree, so a flat map is unambiguous. */
export const SECTION_HEAD_KEYS: Record<string, TranslationKey> = {
  quality: 'hudChrome.options.sec.quality',
  view: 'hudChrome.options.sec.view',
  general: 'hudChrome.options.sec.general',
  scaleText: 'hudChrome.options.sec.scaleText',
  panels: 'hudChrome.options.sec.panels',
  unitFrames: 'hudChrome.options.sec.unitFrames',
  actionBars: 'hudChrome.options.sec.actionBars',
  chat: 'hudChrome.options.sec.chat',
  combatTooltips: 'hudChrome.options.sec.combatTooltips',
  hudExtras: 'hudChrome.options.sec.hudExtras',
  motionContrast: 'hudChrome.options.sec.motionContrast',
  content: 'hudChrome.options.sec.content',
  camera: 'hudChrome.options.sec.camera',
  movement: 'hudChrome.options.sec.movement',
  combat: 'hudChrome.options.sec.combat',
  feedback: 'hudChrome.options.sec.feedback',
  inputMode: 'hudChrome.options.sec.inputMode',
  feel: 'hudChrome.options.sec.feel',
  sticks: 'hudChrome.options.sec.sticks',
  look: 'hudChrome.options.sec.look',
  buttons: 'hudChrome.options.sec.buttons',
  volume: 'hudChrome.options.sec.volume',
  toggles: 'hudChrome.options.sec.toggles',
  performance: 'hudChrome.options.sec.performance',
  support: 'hudChrome.options.sec.support',
  about: 'hudChrome.options.sec.about',
};

/** The head key for a section id (falls back to the id when unmapped, which a
 *  test forbids for the shipped ids). */
export function sectionHeadKey(sectionId: string): TranslationKey {
  return SECTION_HEAD_KEYS[sectionId] ?? (sectionId as TranslationKey);
}

export interface CategoryDetailSection {
  id: string;
  headKey: TranslationKey;
  rows: OptionRow[];
}

export interface CategoryDetailModel {
  id: CategoryId;
  nameKey: TranslationKey;
  subheadKey: TranslationKey;
  sections: CategoryDetailSection[];
}

/** The detail-pane model for a category: its header/subhead keys plus its
 *  env-visible sections (an empty section is dropped). Overview carries no
 *  settings-key sections (its quick actions + pins are painted bespoke). */
export function renderCategory(id: CategoryId, e: RailEnv): CategoryDetailModel {
  const def = CATEGORIES.find((c) => c.id === id);
  const sections: CategoryDetailSection[] = CATEGORY_SECTIONS[id]
    .map((s) => ({
      id: s.id,
      headKey: sectionHeadKey(s.id),
      rows: s.rows.filter((r) => rowVisible(r, def?.env, e)),
    }))
    // Drop an empty section, and one left with only note rows after gating (e.g.
    // the Controls "Input Mode" section under the native shell, where the sole
    // control is hidden and only its explanatory note would remain).
    .filter((s) => s.rows.some((r) => r.control !== 'note'));
  return {
    id,
    nameKey: def?.nameKey ?? ('' as TranslationKey),
    subheadKey: def?.subheadKey ?? ('' as TranslationKey),
    sections,
  };
}

/** Bind a static OptionRow to a live OptionsControl by reusing the existing
 *  private control builders (so the rendered descriptor, and therefore the
 *  dispatch, is byte-identical to the old per-panel path). Returns null for the
 *  bespoke language / theme-preset rows, which the painter renders itself. The
 *  slider step mirrors the old builders: 1 for the degrees FOV slider, 0.05
 *  everywhere else. */
export function buildControlFromRow(
  s: OptionsSettingsSource,
  row: OptionRow,
): OptionsControl | null {
  switch (row.control) {
    case 'slider': {
      const step = row.fmt === 'degrees' ? 1 : 0.05;
      const base = slider(s, row.key as string, row.labelKey as TranslationKey, row.fmt, step);
      return row.commitOnChange ? { ...base, commitOnChange: true } : base;
    }
    case 'toggle':
      return toggle(s, row.key as string, row.labelKey as TranslationKey);
    case 'boolToggle':
      return boolToggle(s, row.key as string, row.labelKey as TranslationKey);
    case 'choice':
      return choice(
        s,
        row.key as string,
        row.labelKey as TranslationKey,
        row.choices ?? [],
        row.rerender ?? false,
      );
    case 'note':
      return note(row.textKey as TranslationKey);
    case 'musicToggle':
      return { control: 'musicToggle', labelKey: row.labelKey as TranslationKey };
    default:
      // 'language' | 'themePreset': bespoke rows the painter renders directly.
      return null;
  }
}

/** The per-category changed-from-defaults count: how many of a category's
 *  homed settings keys currently differ from their default. `changed(key)` is
 *  supplied by the painter (which reads the live value vs the range/bool def). */
export function categoryChangedCount(id: CategoryId, changed: (key: string) => boolean): number {
  return categorySettingKeys(id).filter(changed).length;
}

/** The total changed-from-defaults count across every homed key (Overview has
 *  none of its own; its pins are mirrors of other categories' keys). */
export function totalChangedCount(changed: (key: string) => boolean): number {
  let n = 0;
  for (const c of CATEGORIES) n += categorySettingKeys(c.id).filter(changed).length;
  return n;
}

/** The keys a scoped "Reset [category]" restores: exactly that category's homed
 *  settings keys (the painter resets each to its default and re-applies it). */
export function categoryResetKeys(id: CategoryId): string[] {
  return categorySettingKeys(id);
}

/** Section-scope search: does a row match the query? The label TEXT is resolved
 *  by the painter (t() is a runtime dependency); a query also matches through
 *  the explicit synonym overlay (e.g. "fps" -> showFps). An empty query matches
 *  everything (the full category shows). */
export function rowMatchesQuery(labelText: string, settingKey: string, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  if (labelText.toLowerCase().includes(q)) return true;
  for (const [term, target] of Object.entries(SEARCH_SYNONYMS)) {
    if (target === settingKey && term.toLowerCase().includes(q)) return true;
  }
  return false;
}

/** Global / section search for a NON-settings row (language, theme preset): matches
 *  its label OR any explicit synonym (contains-match, mirroring rowMatchesQuery and
 *  the synonym overlay semantics). An empty query matches. These rows carry no
 *  settings key, so they are searched through this helper rather than rowMatchesQuery
 *  + the settings-key SEARCH_SYNONYMS overlay. */
export function nonSettingRowMatches(
  row: NonSettingSearchRow,
  labelText: string,
  rawQuery: string,
): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  if (labelText.toLowerCase().includes(q)) return true;
  return row.synonyms.some((term) => term.toLowerCase().includes(q));
}
