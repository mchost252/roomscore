const {
  CATEGORIES,
  RARITY,
  TROPHIES,
  getTrophy,
  listTrophies,
  groupByCategory,
} = require('../catalog/trophies');

const EXPECTED_TOTAL = 76;
const EXPECTED_LIVE = 39;
const EXPECTED_STUBS = 37;

function criterionKey(criterion) {
  if (!criterion) return null;
  return [criterion.type, criterion.scope ?? '', criterion.threshold ?? ''].join('|');
}

describe('trophy catalog', () => {
  test('has the agreed size after deduplication', () => {
    expect(TROPHIES).toHaveLength(EXPECTED_TOTAL);
    expect(listTrophies({ includeStubs: false })).toHaveLength(EXPECTED_LIVE);
    expect(listTrophies({ includeStubs: true })).toHaveLength(EXPECTED_TOTAL);
    expect(EXPECTED_LIVE + EXPECTED_STUBS).toBe(EXPECTED_TOTAL);
  });

  test('trophy ids are unique and resolvable via getTrophy', () => {
    const ids = TROPHIES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(getTrophy(id)).toBeTruthy();
      expect(getTrophy(id).id).toBe(id);
    }
    expect(getTrophy('does-not-exist')).toBeNull();
  });

  test('every trophy references a valid category and rarity', () => {
    const categoryIds = new Set(Object.keys(CATEGORIES));
    const rarityIds = new Set(Object.keys(RARITY));
    for (const trophy of TROPHIES) {
      expect(categoryIds.has(trophy.category)).toBe(true);
      expect(rarityIds.has(trophy.rarity)).toBe(true);
    }
  });

  test('every trophy has title and description', () => {
    for (const trophy of TROPHIES) {
      expect(typeof trophy.title).toBe('string');
      expect(trophy.title.length).toBeGreaterThan(0);
      expect(typeof trophy.description).toBe('string');
      expect(trophy.description.length).toBeGreaterThan(0);
    }
  });

  test('no two live trophies share an identical criterion', () => {
    const seen = new Map();
    const duplicates = [];
    for (const trophy of listTrophies({ includeStubs: false })) {
      const key = criterionKey(trophy.criterion);
      if (seen.has(key)) {
        duplicates.push(`${seen.get(key)} <-> ${trophy.id} (${key})`);
      } else {
        seen.set(key, trophy.id);
      }
    }
    expect(duplicates).toEqual([]);
  });

  test('removed duplicate trophies stay removed', () => {
    const removed = [
      'getting-started',
      'finding-your-way',
      'on-your-way',
      'krios-initiate',
      'first-session',
      'task-starter',
      'showing-up',
      'in-sync',
      'krios-elite',
      'krios-master',
      'peak-performance',
      'unstoppable-legend',
      'krios-legend',
    ];
    for (const id of removed) {
      expect(getTrophy(id)).toBeNull();
    }
  });

  test('groupByCategory covers every category with its trophies', () => {
    const groups = groupByCategory();
    expect(groups.map((g) => g.id)).toEqual(
      Object.values(CATEGORIES).sort((a, b) => a.order - b.order).map((c) => c.id),
    );
    const groupedCount = groups.reduce((sum, g) => sum + g.trophies.length, 0);
    expect(groupedCount).toBe(TROPHIES.length);
    for (const group of groups) {
      expect(group.trophies.length).toBeGreaterThan(0);
      for (const trophy of group.trophies) {
        expect(trophy.category).toBe(group.id);
      }
    }
  });
});
