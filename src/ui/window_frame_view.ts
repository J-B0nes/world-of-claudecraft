// Pure, host-agnostic view model for the shared window frame.
//
// This is the pure-core half of the pure-core + thin-consumer split (root
// CLAUDE.md Conventions; reference unit_portrait.ts / vendor_view.ts). It owns
// the one thing every redesigned window frame decides that is worth testing
// without a DOM: the derived structural-node ids, the aria wiring
// (role="dialog", aria-labelledby, the tablist/tab/tabpanel id set and the
// aria-selected + roving-tabindex state for a given active tab), and the shared
// grammar class names the DOM builder paints (see the AAA component grammar in
// src/styles/components.css, spec section 8).
//
// DOM-free and i18n-free so tests/window_frame_view.test.ts can drive it
// directly: the model carries i18n KEY strings (titleKey, labelKey), never
// resolved text. The DOM/i18n side lives in window_frame.ts.
//
// Instance-parameterized: every id is derived from the descriptor id, so the
// same builder frames the vendor window, the social panel, and the other 22
// windows with no hardcoded element id.

/** One tab descriptor: a stable id fragment plus the i18n key for its label. */
export interface WindowFrameTab {
  /** Stable per-window id fragment (e.g. 'buy'); the derived ids embed it. */
  id: string;
  /** i18n key for the tab's visible label, resolved by the consumer via t(). */
  labelKey: string;
}

/** Fields shared by every window frame, closable or not. */
interface WindowFrameBase {
  /** Root element id; every structural id below is derived from it. */
  id: string;
  /** i18n key for the titlebar title, resolved by the consumer via t(). */
  titleKey: string;
  /** Optional tab rail; an omitted or empty list yields no tablist. */
  tabs?: readonly WindowFrameTab[];
  /** Sticky footer action row (transactional windows). Defaults to false. */
  footer?: boolean;
  /** Sets aria-modal on the dialog (L2 modals). Defaults to false. */
  modal?: boolean;
}

// A closable window MUST name its close control's aria-label key (kept on the
// descriptor rather than baked in, so each window reuses its own existing key,
// e.g. itemUi.vendor.close); a non-closable window needs none. The union makes
// the type system enforce that at every call site.
export type WindowFrameDescriptor = WindowFrameBase &
  ({ closable?: true; closeLabelKey: string } | { closable: false; closeLabelKey?: string });

export interface WindowFrameTabModel {
  /** The descriptor tab id fragment. */
  key: string;
  labelKey: string;
  /** Derived id of the tab button (`role="tab"`). */
  tabId: string;
  /** Derived id of the tab panel this tab controls (`role="tabpanel"`). */
  panelId: string;
  /** aria-selected state for this tab. */
  selected: boolean;
  /** Roving tabindex: 0 for the active tab, -1 for the rest. */
  tabIndex: number;
}

export interface WindowFrameTablistModel {
  /** Derived id of the tablist container. */
  id: string;
  className: string;
  /** aria-labelledby target: the titlebar title. */
  labelledBy: string;
  /** The id fragment of the active tab. */
  activeKey: string;
  tabs: WindowFrameTabModel[];
}

export interface WindowFrameCloseModel {
  /** Derived id of the close control. */
  id: string;
  className: string;
  /** i18n key for the close control's aria-label. */
  labelKey: string;
}

export interface WindowFrameFooterModel {
  /** Derived id of the sticky footer action row. */
  id: string;
  className: string;
}

export interface WindowFrameModel {
  /** Root element id (the descriptor id verbatim). */
  id: string;
  role: 'dialog';
  ariaModal: boolean;
  className: string;
  /** Derived id of the title element (the aria-labelledby target). */
  titleId: string;
  labelledBy: string;
  titleKey: string;
  titlebarClassName: string;
  titleClassName: string;
  /** Derived id of the scrollable body region. */
  bodyId: string;
  bodyClassName: string;
  /** Null for a non-closable window. */
  close: WindowFrameCloseModel | null;
  /** Null when the window has no tabs. */
  tablist: WindowFrameTablistModel | null;
  /** Null when the window has no footer. */
  footer: WindowFrameFooterModel | null;
}

/**
 * Build the structured window-frame model from a descriptor and the active tab.
 *
 * `activeTabId` selects which tab is `aria-selected` and carries the roving
 * tabindex 0; an unknown or omitted id falls back to the first tab. Windows
 * without tabs ignore it. All ids are derived from `descriptor.id`.
 */
export function buildWindowFrameModel(
  descriptor: WindowFrameDescriptor,
  activeTabId?: string,
): WindowFrameModel {
  const rootId = descriptor.id;
  const titleId = `${rootId}-title`;

  const closable = descriptor.closable !== false;
  const close: WindowFrameCloseModel | null =
    closable && descriptor.closeLabelKey
      ? { id: `${rootId}-close`, className: 'window-close', labelKey: descriptor.closeLabelKey }
      : null;

  const tabDescs = descriptor.tabs ?? [];
  let tablist: WindowFrameTablistModel | null = null;
  if (tabDescs.length > 0) {
    const activeKey = tabDescs.some((tab) => tab.id === activeTabId)
      ? (activeTabId as string)
      : tabDescs[0].id;
    const tabs = tabDescs.map((tab): WindowFrameTabModel => {
      const selected = tab.id === activeKey;
      return {
        key: tab.id,
        labelKey: tab.labelKey,
        tabId: `${rootId}-tab-${tab.id}`,
        panelId: `${rootId}-panel-${tab.id}`,
        selected,
        tabIndex: selected ? 0 : -1,
      };
    });
    tablist = { id: `${rootId}-tabs`, className: 'tab-rail', labelledBy: titleId, activeKey, tabs };
  }

  const footer: WindowFrameFooterModel | null = descriptor.footer
    ? { id: `${rootId}-footer`, className: 'window-footer' }
    : null;

  return {
    id: rootId,
    role: 'dialog',
    ariaModal: descriptor.modal === true,
    className: 'window-frame',
    titleId,
    labelledBy: titleId,
    titleKey: descriptor.titleKey,
    titlebarClassName: 'window-titlebar',
    titleClassName: 'window-title',
    bodyId: `${rootId}-body`,
    bodyClassName: 'window-body',
    close,
    tablist,
    footer,
  };
}
