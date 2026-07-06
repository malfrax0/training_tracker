import { Exercise } from '../types';

export interface EquipmentItem {
  type: 'dumbbell' | 'bar';
  weightKg: number;
  count: number;
}

/**
 * Aggregates the dumbbells/bars needed to complete every exercise of a session.
 * For dumbbells, items are grouped by weight: the count needed for a given weight
 * is the max across exercises at that weight (1 for "1 Dumbbell", 2 for "2 Dumbbell") —
 * so a "1 dumbbell" and a "2 dumbbell" exercise at the same weight still only need 2, not 3.
 * Bars are grouped by weight too, with 1 bar needed per distinct weight.
 */
export function computeEquipmentNeeds(exercises: Exercise[]): EquipmentItem[] {
  const dumbbellCounts = new Map<number, number>();
  const barWeights = new Set<number>();

  for (const ex of exercises) {
    if (ex.dumbbellType === 'one_dumbbell' || ex.dumbbellType === 'two_dumbbell') {
      const needed = ex.dumbbellType === 'two_dumbbell' ? 2 : 1;
      const current = dumbbellCounts.get(ex.defaultWeightKg) ?? 0;
      dumbbellCounts.set(ex.defaultWeightKg, Math.max(current, needed));
    } else if (ex.dumbbellType === 'bar') {
      barWeights.add(ex.defaultWeightKg);
    }
  }

  const items: EquipmentItem[] = [
    ...Array.from(dumbbellCounts.entries()).map(([weightKg, count]) => ({
      type: 'dumbbell' as const,
      weightKg,
      count,
    })),
    ...Array.from(barWeights).map((weightKg) => ({
      type: 'bar' as const,
      weightKg,
      count: 1,
    })),
  ];

  // Dumbbells first (by weight), then bars (by weight) — matches insertion order above.
  const typeOrder: Record<EquipmentItem['type'], number> = { dumbbell: 0, bar: 1 };
  items.sort((a, b) => (a.type === b.type ? a.weightKg - b.weightKg : typeOrder[a.type] - typeOrder[b.type]));
  return items;
}
