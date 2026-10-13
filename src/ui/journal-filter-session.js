const keys = ['search', 'account', 'status', 'market', 'strategy', 'tag', 'from', 'to'];
const defaults = () => Object.fromEntries(keys.map((key) => [key, '']));
const comparable = (filters) => JSON.stringify(keys.map((key) => key === 'search' ? filters[key].trim().toLowerCase() : filters[key]));
const validDate = (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && value.slice(0, 4) !== '0000' && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export function journalFilterState(initial = {}) {
  const applied = { ...defaults(), ...initial };
  return { draft: { ...applied }, applied, badDates: { from: false, to: false } };
}
export function journalDateErrors(state) {
  const errors = {};
  for (const name of ['from', 'to']) if (state.badDates[name] || !validDate(state.draft[name])) errors[name] = 'Enter a complete valid date. Results still use the previous valid date range.';
  if (!Object.keys(errors).length && state.draft.from && state.draft.to && state.draft.from > state.draft.to) errors.to = 'End date must be on or after start date. Results still use the previous valid date range.';
  return errors;
}

/** One mounted view schedules updates; persistent state belongs to the authenticated UI session. */
export function journalFilterSession(state, notify, { schedule = setTimeout, cancel = clearTimeout } = {}) {
  let timer, disposed = false;
  function stop() { if (timer !== undefined) cancel(timer); timer = undefined; }
  function publish(changed = false, resetPage = false) {
    if (!disposed) notify({ changed, resetPage, errors: journalDateErrors(state), active: keys.some((key) => state.draft[key] !== '') || Object.values(state.badDates).some(Boolean) });
  }
  function apply(resetPage = false) {
    stop();
    if (disposed) return;
    const next = { ...state.draft };
    if (Object.keys(journalDateErrors(state)).length) { next.from = state.applied.from; next.to = state.applied.to; }
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
    clear() { if (disposed) return; state.draft = defaults(); state.badDates = { from: false, to: false }; apply(true); },
    dispose() { stop(); disposed = true; },
  };
}
