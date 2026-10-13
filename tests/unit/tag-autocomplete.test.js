import { describe, it, expect } from 'vitest';
import { journalTagCatalogue, matchingTags } from '../../src/ui/tag-autocomplete.js';

describe('journal tag suggestions', () => {
  it('collects all records, deduplicates exact values and preserves distinct case', () => {
    expect(journalTagCatalogue([{ tags: ['red', 'blue', 'Blue'] }, { tags: ['blue', 'red'] }, { tags: ['green'] }])).toEqual(['Blue', 'blue', 'green', 'red']);
  });
  it('matches substring case-insensitively without rewriting selected values', () => {
    const catalogue = journalTagCatalogue([{ tags: ['Swing setup', 'BREAKOUT', 'blue'] }]);
    expect(matchingTags(catalogue, 'ING')).toEqual(['Swing setup']);
    expect(matchingTags(catalogue, ' break ')).toEqual(['BREAKOUT']);
    expect(catalogue).toEqual(['blue', 'BREAKOUT', 'Swing setup']);
  });
  it('distinguishes empty catalogue and unmatched text, showing all tags for blank query', () => {
    expect(journalTagCatalogue([{ tags: [] }])).toEqual([]);
    expect(matchingTags(['blue', 'red'], '')).toEqual(['blue', 'red']);
    expect(matchingTags(['blue', 'red'], 'missing')).toEqual([]);
  });
});
