// Strategy profiles, mirroring the reference title's tuning shape:
// flee / greed / engage / weaponBias / offenseBias / lootBias.

export const STRATEGIES = {
  survivor:  { label: 'SURVIVOR',  flee: 1.15, greed: 0.9, engage: 0.0,  weaponBias: 1.2, offenseBias: 0.6, lootBias: 1.0 },
  hunter:    { label: 'HUNTER',    flee: 0.70, greed: 0.7, engage: 0.35, weaponBias: 2.0, offenseBias: 1.4, lootBias: 0.5 },
  collector: { label: 'COLLECTOR', flee: 1.10, greed: 1.7, engage: 0.0,  weaponBias: 0.8, offenseBias: 0.3, lootBias: 2.2 },
  berserker: { label: 'BERSERKER', flee: 0.35, greed: 0.5, engage: 0.8,  weaponBias: 1.6, offenseBias: 2.4, lootBias: 0.3 },
};

export const STRATEGY_IDS = Object.keys(STRATEGIES);

export function normalizeStrategy(s) {
  return STRATEGY_IDS.includes(s) ? s : 'survivor';
}
