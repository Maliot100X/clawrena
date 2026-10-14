import { describe, it, expect } from 'vitest';
import { settle, type Market } from '../src/lib/markets.js';

function mk(bets: [number, boolean, number][]): Market {
  const m: Market = { id:'t', runId:'r', question:'q', kind:'level', threshold:5,
    status:'CLOSED', pot:0, yes:0, no:0, outcome:null, openedAt:0, closesAt:1, bets: [] };
  bets.forEach(([amount, choice, weight], i) => {
    m.bets.push({ bettorId:`b${i}`, choice, amount, weight, settled:false, at:0 });
    m.pot += amount; if (choice) m.yes += amount; else m.no += amount;
  });
  return m;
}
const paid = (m: Market) => m.bets.reduce((a, b) => a + (b.payout ?? 0), 0);

describe('market settlement', () => {
  const cases: [string, Market, boolean][] = [
    ['mixed field, YES wins',   mk([[100,true,2.0],[100,true,1.5],[100,true,1.0],[50,false,2.0],[50,false,1.0]]), true],
    ['everyone wrong',          mk([[100,false,2.0],[50,false,1.0]]), true],
    ['single winner takes pot', mk([[10,true,1.0],[10,false,1.0],[30,false,1.0]]), true],
    ['all lose on NO',          mk([[30,true,1.0],[20,true,1.0]]), false],
    ['sole bettor wins',        mk([[40,true,1.0]]), true],
    ['sole bettor loses',       mk([[40,true,1.0]]), false],
  ];

  for (const [name, m, outcome] of cases) {
    it(`is zero-sum: ${name}`, () => {
      const pot = m.pot;
      const s = settle(m, outcome);
      expect(paid(s)).toBe(pot);                    // nothing created or destroyed
      expect(s.bets.every(b => b.settled)).toBe(true);
      expect(s.status).toBe('RESOLVED');
      expect(s.outcome).toBe(outcome);
    });
  }

  it('pays winners, zeroes losers', () => {
    const s = settle(mk([[100,true,1.0],[100,false,1.0]]), true);
    expect(s.bets[0].payout).toBeGreaterThan(0);
    expect(s.bets[1].payout).toBe(0);
  });

  it('refunds everybody when there are no winners on that side', () => {
    const s = settle(mk([[30,true,1.0],[20,true,1.0]]), false);
    expect(s.bets.map(b => b.payout)).toEqual([30, 20]);
  });

  it('weights early bets more heavily', () => {
    const s = settle(mk([[100,true,2.5],[100,true,1.0],[100,false,1.0]]), true);
    expect(s.bets[0].payout!).toBeGreaterThan(s.bets[1].payout!);
  });

  it('handles integer rounding without losing a point', () => {
    const m = mk([[33,true,1.0],[33,true,1.0],[34,true,1.0],[50,false,1.0]]);
    const pot = m.pot;
    expect(paid(settle(m, true))).toBe(pot);
  });
});
