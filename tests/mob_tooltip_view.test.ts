import { describe, expect, it } from 'vitest';
import {
  type MobTooltipI18n,
  type MobTooltipModel,
  mobTooltipHtml,
} from '../src/ui/mob_tooltip_view';

// Fake i18n: echo the key plus its params so assertions can see exactly which
// catalog key and which formatted values the view chose, without binding the
// runtime i18n table (mirrors tests/stat_tooltip_view.test.ts).
const fakeT = (key: string, params?: Record<string, string>): string =>
  params
    ? `${key}(${Object.entries(params)
        .map(([k, v]) => `${k}=${v}`)
        .join(',')})`
    : key;
const fakeFmt = (v: number): string => String(v);
const deps: MobTooltipI18n = { t: fakeT, fmt: fakeFmt };

const model = (over: Partial<MobTooltipModel> = {}): MobTooltipModel => ({
  name: 'Forest Wolf',
  level: 5,
  familyLabel: 'Beasts',
  color: '#ffe97a',
  hostile: true,
  ...over,
});

describe('mobTooltipHtml', () => {
  it('renders the localized name AND the level/family line colored by the con-color', () => {
    const html = mobTooltipHtml(model(), deps);
    expect(html).toContain('<div class="tt-title" style="color:#ffe97a">Forest Wolf</div>');
    expect(html).toContain(
      '<div class="tt-sub" style="color:#ffe97a">hudChrome.mobTooltip.levelFamily(level=5,family=Beasts)</div>',
    );
  });

  it('formats the level through the injected fmt, not a raw string', () => {
    const html = mobTooltipHtml(model({ level: 12 }), deps);
    expect(html).toContain('level=12');
  });

  it('shows a red Hostile line for a hostile mob', () => {
    const html = mobTooltipHtml(model({ hostile: true }), deps);
    expect(html).toContain('<div class="tt-red">hudChrome.mobTooltip.hostile</div>');
    expect(html).not.toContain('hudChrome.mobTooltip.friendly');
  });

  it('shows a green Friendly line for a non-hostile mob', () => {
    const html = mobTooltipHtml(model({ hostile: false }), deps);
    expect(html).toContain('<div class="tt-green">hudChrome.mobTooltip.friendly</div>');
    expect(html).not.toContain('hudChrome.mobTooltip.hostile');
  });

  it('escapes HTML in the name and family label', () => {
    const html = mobTooltipHtml(model({ name: '<script>alert(1)</script>' }), deps);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('same input produces the same output (deterministic, no DOM)', () => {
    const m = model();
    expect(mobTooltipHtml(m, deps)).toEqual(mobTooltipHtml(m, deps));
  });
});
