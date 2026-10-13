import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import baseline from '../contracts/baseline.json' with { type: 'json' };

it('retains a destination for every original test contract during suite redesign', () => {
  for (const contract of baseline) {
    expect(contract.replacements.length, contract.contract).toBeGreaterThan(0);
    contract.replacements.forEach((name, index) => expect(readFileSync(contract.targets[index], 'utf8'), contract.path).toContain(name));
  }
});
