import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { journalFilterState, journalFilterSession, journalDateErrors } from '../../src/ui/journal-filter-session.js';
let state, events, session;
beforeEach(() => {
  vi.useFakeTimers();
  state = journalFilterState(); events = [];
  session = journalFilterSession(state, (event) => events.push(event));
});
afterEach(() => vi.useRealTimers());

describe('journal filter draft and application lifecycle', () => {
  it('debounces text without changing applied results during typing', () => {
    session.update('search', 'AUD');
    vi.advanceTimersByTime(249);
    expect(state.applied.search).toBe('');
    session.update('search', 'AUDIT');
    vi.advanceTimersByTime(250);
    expect(state.applied.search).toBe('AUDIT');
    expect(events.filter((event) => event.changed)).toHaveLength(1);
  });
  it('flushes current search and tag on a selector change and cancels the delayed callback', () => {
    session.update('search', 'AUDIT'); session.update('tag', 'exact tag');
    session.update('status', 'closed');
    expect(state.applied).toMatchObject({ search: 'AUDIT', tag: 'exact tag', status: 'closed' });
    const count = events.length;
    vi.runAllTimers(); expect(events).toHaveLength(count);
  });
  it('applies explicit submission and native search clearing immediately', () => {
    session.update('search', 'AUDIT'); session.flush();
    expect(state.applied.search).toBe('AUDIT');
    session.update('search', '');
    expect(state.applied.search).toBe('');
    expect(events.at(-1).changed).toBe(true);
  });
  it('preserves last valid date pair while unrelated filters update', () => {
    session.update('from', '2026-10-01'); session.update('to', '2026-10-13');
    session.update('to', '2026-09-30'); session.update('account', 'account-b');
    expect(state.applied).toMatchObject({ from: '2026-10-01', to: '2026-10-13', account: 'account-b' });
    expect(state.draft.to).toBe('2026-09-30');
    expect(journalDateErrors(state).to).toContain('Results still use the previous valid date range');
    session.update('to', '2026-10-15');
    expect(state.applied.to).toBe('2026-10-15');
    expect(journalDateErrors(state)).toEqual({});
  });
  it('rejects incomplete native input and nonexistent calendar dates without treating them as cleared', () => {
    session.update('from', '2026-02-01');
    session.update('from', '', { badInput: true });
    expect(state.applied.from).toBe('2026-02-01');
    session.update('from', '2026-02-30');
    expect(state.applied.from).toBe('2026-02-01');
    expect(journalDateErrors(state).from).toBeTruthy();
  });
  it('clears date restrictions when both controls are cleared', () => {
    session.update('from', '2026-10-01'); session.update('to', '2026-10-13');
    session.update('from', ''); session.update('to', '');
    expect(state.applied).toMatchObject({ from: '', to: '' });
    expect(journalDateErrors(state)).toEqual({});
  });
  it('does not reset pagination for equivalent searches; tag matching remains exact', () => {
    session.update('search', ' AUDIT '); session.flush();
    session.update('search', 'audit'); session.flush();
    expect(events.at(-1).changed).toBe(false);
    session.update('tag', 'tag'); session.flush();
    session.update('tag', 'Tag'); session.flush();
    expect(events.at(-1).changed).toBe(true);
  });
  it('Clear removes drafts, errors and pending work and explicitly resets pagination', () => {
    session.update('search', 'pending'); session.update('to', '', { badInput: true });
    session.clear();
    expect(state.draft).toEqual(journalFilterState().draft);
    expect(events.at(-1)).toMatchObject({ active: false, errors: {}, resetPage: true });
    const count = events.length;
    vi.runAllTimers(); expect(events).toHaveLength(count);
  });
  it('disposal prevents stale timer updates while preserving draft for a fresh mounted view', () => {
    session.update('search', 'pending'); session.dispose();
    const count = events.length;
    vi.runAllTimers(); expect(events).toHaveLength(count);
    expect(state.applied.search).toBe(''); expect(state.draft.search).toBe('pending');
    const mounted = journalFilterSession(state, (event) => events.push(event));
    mounted.flush(); expect(state.applied.search).toBe('pending');
  });
  it('does not apply unfinished IME composition', () => {
    session.update('search', 'unfinished', { composing: true });
    vi.runAllTimers(); expect(state.applied.search).toBe('');
    session.update('search', 'complete'); vi.advanceTimersByTime(250);
    expect(state.applied.search).toBe('complete');
  });
  it('defaults to opening chronology and retains sort choices when filters clear', () => {
    expect(state.applied).toMatchObject({ sort: 'opened', order: 'desc', dateBasis: 'opened' });
    session.update('sort', 'closed'); session.update('order', 'asc'); session.update('dateBasis', 'closed');
    expect(events.at(-1).active).toBe(true);
    session.clear();
    expect(state.applied).toMatchObject({ sort: 'closed', order: 'asc', dateBasis: 'opened', from: '', to: '' });
    expect(events.at(-1).active).toBe(false);
  });
  it('flushes text on sort change and preserves page for an equivalent sort', () => {
    session.update('search', 'AUDIT'); session.update('sort', 'closed');
    expect(state.applied).toMatchObject({ search: 'AUDIT', sort: 'closed' });
    expect(events.at(-1).changed).toBe(true);
    session.update('sort', 'closed'); expect(events.at(-1).changed).toBe(false);
    const count = events.length; vi.runAllTimers(); expect(events).toHaveLength(count);
  });
  it('retains last valid basis and range while sorting and other filters continue applying', () => {
    session.update('from', '2026-01-01'); session.update('to', '2026-01-31');
    session.update('to', '2025-12-31'); session.update('dateBasis', 'closed'); session.update('sort', 'closed');
    expect(state.draft.dateBasis).toBe('closed');
    expect(state.applied).toMatchObject({ dateBasis: 'opened', from: '2026-01-01', to: '2026-01-31', sort: 'closed' });
    expect(journalDateErrors(state).to).toContain('(Opened: 2026-01-01 to 2026-01-31)');
    session.update('to', '2026-02-01');
    expect(state.applied).toMatchObject({ dateBasis: 'closed', from: '2026-01-01', to: '2026-02-01' });
  });
});
