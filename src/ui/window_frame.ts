// Thin, cold-path DOM builder for the shared window frame.
//
// The consumer half of the pure-core + thin-consumer split: it paints a
// window's chrome (titlebar, tab rail, body region, footer action row) from the
// structured WindowFrameModel (window_frame_view.ts) and wires the close /
// tab-change callbacks. It owns no state and never imports Hud; a window module
// calls it to stamp the shared anatomy, then fills the returned body element
// with its own content.
//
// Cold path (window open / rebuild), so innerHTML is allowed; every interpolated
// string passes through esc(), and every visible label / accessible name is a
// t() key carried on the model. Callbacks arrive through the injected deps.

import { esc } from './esc';
import { type TranslationKey, t } from './i18n';
import { svgIcon } from './ui_icons';
import { buildWindowFrameModel, type WindowFrameDescriptor } from './window_frame_view';

/** Hud-supplied callbacks. Both optional: a non-closable or tab-less window omits the one it does not need. */
export interface WindowFrameDeps {
  /** Fired when the close control is activated. */
  onClose?: () => void;
  /** Fired with the tab id fragment when a tab is activated. */
  onTabChange?: (tabId: string) => void;
}

/** The live nodes the caller fills after the chrome is stamped. */
export interface WindowFrameParts {
  root: HTMLElement;
  /** The scrollable content region (`.window-body`). */
  body: HTMLElement;
  /** The sticky footer action row, or null when the window has no footer. */
  footer: HTMLElement | null;
  /** The tab buttons in descriptor order (empty when the window has no tabs). */
  tabButtons: HTMLButtonElement[];
}

/**
 * Stamp the shared window chrome onto `el` and wire its callbacks.
 *
 * Sets the dialog role / aria-labelledby on the root, builds the titlebar (with
 * an optional close control), the optional tab rail, an empty body region, and
 * an optional footer, then returns the body / footer / tab nodes so the caller
 * paints its own content into them.
 */
export function renderWindowFrame(
  el: HTMLElement,
  descriptor: WindowFrameDescriptor,
  deps: WindowFrameDeps = {},
  activeTabId?: string,
): WindowFrameParts {
  const model = buildWindowFrameModel(descriptor, activeTabId);

  el.classList.add(model.className);
  el.setAttribute('role', model.role);
  el.setAttribute('aria-labelledby', model.labelledBy);
  if (model.ariaModal) el.setAttribute('aria-modal', 'true');

  const closeHtml = model.close
    ? `<button type="button" class="${model.close.className}" data-window-close aria-label="${esc(t(model.close.labelKey as TranslationKey))}">${svgIcon('close')}</button>`
    : '';
  const titlebar =
    `<div class="${model.titlebarClassName}">` +
    `<span class="${model.titleClassName}" id="${esc(model.titleId)}">${esc(t(model.titleKey as TranslationKey))}</span>` +
    `${closeHtml}</div>`;

  let tabRail = '';
  if (model.tablist) {
    const tabs = model.tablist.tabs
      .map(
        (tab) =>
          `<button type="button" class="tab" role="tab" id="${esc(tab.tabId)}" ` +
          `data-window-tab="${esc(tab.key)}" aria-controls="${esc(tab.panelId)}" ` +
          `aria-selected="${tab.selected}" tabindex="${tab.tabIndex}">` +
          `${esc(t(tab.labelKey as TranslationKey))}</button>`,
      )
      .join('');
    tabRail =
      `<div class="${model.tablist.className}" role="tablist" ` +
      `aria-labelledby="${esc(model.tablist.labelledBy)}" id="${esc(model.tablist.id)}">${tabs}</div>`;
  }

  const body = `<div class="${model.bodyClassName}" id="${esc(model.bodyId)}"></div>`;
  const footer = model.footer
    ? `<div class="${model.footer.className}" id="${esc(model.footer.id)}"></div>`
    : '';

  el.innerHTML = `${titlebar}${tabRail}${body}${footer}`;

  el.querySelector('[data-window-close]')?.addEventListener('click', () => deps.onClose?.());
  const tabButtons = Array.from(el.querySelectorAll<HTMLButtonElement>('[data-window-tab]'));
  for (const btn of tabButtons) {
    btn.addEventListener('click', () => deps.onTabChange?.(btn.dataset.windowTab ?? ''));
  }

  return {
    root: el,
    body: el.querySelector<HTMLElement>('.window-body') as HTMLElement,
    footer: el.querySelector<HTMLElement>('.window-footer'),
    tabButtons,
  };
}
