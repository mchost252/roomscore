/**
 * Krios Home Tab Registry — single source of truth for the home tab bar.
 *
 * The tab index used to be hardcoded in five separate places (_layout's
 * HOME_TAB_ROUTES / isPrimaryHomePath / getHomeTabIndex, BottomTabBar's
 * pathTabIndex, and SidebarNav's primaryTabIndex). Keeping five copies in sync by
 * hand is how the transition-direction logic breaks, so both nav bars and the
 * layout now derive everything from this file.
 *
 * Consumed by:
 *   app/(home)/_layout.tsx
 *   components/BottomTabBar.tsx
 *   components/SidebarNav.tsx
 */

/**
 * `exact` — pathnames that ARE this tab (used for "is the nav bar visible").
 * `owns`  — path fragments that belong to this tab, including pushed sub-screens.
 *           Visiting one keeps this tab highlighted.
 */
export const HOME_TABS = [
  {
    key: 'home',
    route: '/(home)',
    exact: ['/', '/(home)', '/(home)/index', '/index'],
    owns: [] as string[], // fallback tab; nothing routes to it by fragment
  },
  {
    key: 'rooms',
    route: '/(home)/rooms',
    exact: ['/rooms', '/(home)/rooms'],
    // '/room-' catches the pushed room sub-screens (room-detail, room-chat,
    // room-task-thread). The old getHomeTabIndex only tested '/rooms', so those
    // three resolved to Home — harmless while the bar is hidden, but wrong.
    owns: ['/rooms', '/room-'],
  },
  {
    key: 'messages',
    route: '/(home)/messages',
    exact: ['/messages', '/(home)/messages'],
    // '/chat' keeps Chats highlighted while inside a DM. Note '/ai-chat' and
    // '/room-chat' do NOT contain '/chat' (they read '-chat'), so they are
    // correctly excluded.
    owns: ['/messages', '/chat'],
  },
  {
    key: 'more',
    route: '/(home)/more',
    exact: ['/more', '/(home)/more'],
    // Screens that live under More. Profile no longer needs its own tab slot
    // because visiting it keeps More highlighted.
    owns: ['/more', '/profile', '/settings', '/appearance'],
  },
] as const;

export type HomeTabKey = typeof HOME_TABS[number]['key'];

/** Index of the More tab — the slot that replaced Profile. */
export const MORE_TAB_INDEX = HOME_TABS.findIndex(t => t.key === 'more');

/** Every primary tab destination, in tab order. Used for route prefetching. */
export const HOME_TAB_ROUTES = HOME_TABS.map(t => t.route);

/** The More sheet is a modal, so it must be pushed rather than replaced. */
export const MORE_ROUTE = '/(home)/more';

/**
 * Map a pathname or route string to its tab index.
 *
 * Checked in reverse so the most specific tabs win before falling back to Home.
 * Home is index 0 and is the default for anything unrecognised.
 */
export function getHomeTabIndex(pathOrRoute: string): number {
  for (let i = HOME_TABS.length - 1; i >= 1; i--) {
    const owns = HOME_TABS[i].owns as readonly string[];
    if (owns.some(fragment => pathOrRoute.includes(fragment))) return i;
  }
  return 0;
}

/**
 * True when the given pathname is a screen that should display the nav bar.
 *
 * Deliberately asymmetric in two ways:
 *   • /profile returns TRUE. profile.tsx is reached via the More sheet but is
 *     still a primary screen, and it must keep the nav bar visible — it would
 *     otherwise be a dead end.
 *   • /more returns FALSE. The nav overlay in _layout paints above <Stack>
 *     (zIndex 1, rendered after it), so leaving this true would draw the tab bar
 *     on top of the More sheet. Returning false fades the bar out instead.
 */
export function isPrimaryHomePath(pathname: string): boolean {
  if (pathname.includes('/more')) return false;
  if (pathname.includes('/profile')) return true;

  return HOME_TABS.some(tab =>
    (tab.exact as readonly string[]).some(m => pathname === m),
  );
}
