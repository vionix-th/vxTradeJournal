const filterKeys = ['search', 'account', 'status', 'market', 'strategy', 'tag', 'from', 'to', 'dateBasis'];
const keys = [...filterKeys, 'sort', 'order'];
const defaults = () => ({ ...Object.fromEntries(filterKeys.map((key) => [key, ''])), dateBasis: 'opened', sort: 'opened', order: 'desc' });
export const journalFiltersActive = (state) => filterKeys.some((key) => state.draft[key] !== defaults()[key]) || Object.values(state.badDates).some(Boolean);
const comparable = (filters) => JSON.stringify(keys.map((key) => key === 'search' ? filters[key].trim().toLowerCase() : filters[key]));
const validDate = (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && value.slice(0, 4) !== '0000' && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export function journalFilterState(initial = {}) {
  const applied = { ...defaults(), ...initial };
  return { draft: { ...applied }, applied, badDates: { from: false, to: false } };
}
export function journalDateErrors(state) {
  const errors = {};
  const previous = ` Results still use the previous valid date range (${state.applied.dateBasis === 'closed' ? 'Closed' : 'Opened'}: ${state.applied.from || 'any start'} to ${state.applied.to || 'any end'}).`;
  for (const name of ['from', 'to']) if (state.badDates[name] || !validDate(state.draft[name])) errors[name] = 'Enter a complete valid date.' + previous;
  if (!Object.keys(errors).length && state.draft.from && state.draft.to && state.draft.from > state.draft.to) errors.to = 'End date must be on or after start date.' + previous;
  return errors;
}

/** One mounted view schedules updates; persistent state belongs to the authenticated UI session. */
export function journalFilterSession(state, notify, { schedule = setTimeout, cancel = clearTimeout } = {}) {
  let timer, disposed = false;
  function stop() { if (timer !== undefined) cancel(timer); timer = undefined; }
  function publish(changed = false, resetPage = false) {
    if (!disposed) notify({ changed, resetPage, errors: journalDateErrors(state), active: journalFiltersActive(state) });
  }
  function apply(resetPage = false) {
    stop();
    if (disposed) return;
    const next = { ...state.draft };
    if (Object.keys(journalDateErrors(state)).length) { next.from = state.applied.from; next.to = state.applied.to; next.dateBasis = state.applied.dateBasis; }
    const changed = comparable(next) !== comparable(state.applied);
    state.applied = next;
    publish(changed, resetPage);
  }
  return {
    update(name, value, { badInput = false, composing = false, immediate = false } = {}) {
      if (disposed) return;
      state.draft[name] = value;
      if (name === 'from' || name === 'to') state.badDates[name] = badInput;
      stop();
      if (composing) { publish(); return; }
      if (!immediate && (name === 'search' || name === 'tag') && !(name === 'search' && value === '')) {
        publish(); timer = schedule(() => apply(), 250);
      } else apply();
    },
    flush: apply,
    clear() { if (disposed) return; state.draft = { ...defaults(), sort: state.draft.sort, order: state.draft.order }; state.badDates = { from: false, to: false }; apply(true); },
    dispose() { stop(); disposed = true; },
  };
}
