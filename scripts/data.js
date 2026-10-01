import { getProfile, parseProfileArg } from './profiles.js';
import { normalizeAccount, normalizeInstrument, normalizeStrategy, createTrade, calculateTrade } from '../src/domain/journal.js';

const profile = getProfile(parseProfileArg());
if (profile.name !== 'dev') throw new Error('Synthetic data commands only operate on dev profile.');
const action = process.argv[2];
if (!['seed', 'reset'].includes(action)) throw new Error('Usage: npm run data:seed|data:reset [-- --profile dev]');

if (action === 'reset') {
  const project = encodeURIComponent(profile.id);
  const responses = await Promise.all([
    fetch(`http://127.0.0.1:${profile.firestore}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: 'DELETE' }),
    fetch(`http://127.0.0.1:${profile.auth}/emulator/v1/projects/${project}/accounts`, { method: 'DELETE' }),
  ]);
  const failures = responses.filter((response) => !response.ok);
  if (failures.length) throw new Error('Could not reset emulator data. Is `npm run emulators` running?');
  console.log('Development emulator data cleared; restoring synthetic records.');
}
{
  const now = new Date().toISOString();
  const email = 'demo@example.test';
  const password = 'Demo-journal-123';
  const authOrigin = `http://127.0.0.1:${profile.auth}`;
  const authBase = `${authOrigin}/identitytoolkit.googleapis.com/v1`;
  let response = await fetch(`${authBase}/accounts:signUp?key=demo-key`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  let auth = await response.json();
  if (!response.ok && auth.error?.message === 'EMAIL_EXISTS') {
    response = await fetch(`${authBase}/accounts:signInWithPassword?key=demo-key`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    auth = await response.json();
  }
  if (!response.ok) throw new Error(`Could not sign in synthetic user: ${auth.error?.message ?? response.status}`);
  const lookupUser = async (idToken) => fetch(`${authBase}/accounts:lookup?key=demo-key`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  let lookup = await lookupUser(auth.idToken);
  let userInfo = await lookup.json();
  if (!lookup.ok) throw new Error(`Could not inspect synthetic user: ${lookup.status}`);
  if (userInfo.users?.[0]?.emailVerified !== true) {
    response = await fetch(`${authBase}/accounts:sendOobCode?key=demo-key`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: auth.idToken, requestType: 'VERIFY_EMAIL' }),
    });
    const verification = await response.json();
    if (!response.ok) throw new Error(`Could not request synthetic email verification: ${verification.error?.message ?? response.status}`);
    const project = encodeURIComponent(profile.id);
    const oobResponse = await fetch(`${authOrigin}/emulator/v1/projects/${project}/oobCodes`);
    const oobPayload = await oobResponse.json();
    const code = oobPayload.oobCodes?.filter((item) => item.email === email && item.requestType === 'VERIFY_EMAIL').at(-1);
    if (!oobResponse.ok || !code?.oobCode) throw new Error('Auth emulator did not expose synthetic email verification code.');
    response = await fetch(`${authBase}/accounts:update?key=demo-key`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ oobCode: code.oobCode }),
    });
    const verified = await response.json();
    if (!response.ok || verified.emailVerified !== true) throw new Error(`Could not verify synthetic user: ${verified.error?.message ?? response.status}`);
    auth = await (await fetch(`${authBase}/accounts:signInWithPassword?key=demo-key`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    })).json();
    lookup = await lookupUser(auth.idToken);
    userInfo = await lookup.json();
  }
  if (!lookup.ok || userInfo.users?.[0]?.emailVerified !== true) throw new Error('Synthetic user verification did not persist after sign-in.');

  const encode = (value) => {
    if (value === null) return { nullValue: null };
    if (typeof value === 'boolean') return { booleanValue: value };
    if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
    if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
    if (typeof value === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)])) } };
    return { stringValue: value };
  };
  async function writeDocument(collection, id, data) {
    const path = `users/${auth.localId}/${collection}/${id}`;
    const result = await fetch(`http://127.0.0.1:${profile.firestore}/v1/projects/${profile.id}/databases/(default)/documents/${path}`, {
      method: 'PATCH', headers: { authorization: 'Bearer owner', 'content-type': 'application/json' },
      body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encode(value)])) }),
    });
    if (!result.ok) throw new Error(`Could not seed ${path}: ${await result.text()}`);
  }
  const metadata = { uid: auth.localId, revision: 1, schemaVersion: 1, createdAt: now, updatedAt: now };
  const account = normalizeAccount({ ...metadata, id: 'main', name: 'Main', currency: 'USD' });
  const instruments = [
    normalizeInstrument({ ...metadata, id: 'acme', name: 'Acme equity', symbol: 'ACME', market: 'Equities', preset: 'equity', model: 'linear', priceUnit: 'USD/share', quantityUnit: 'shares', quantityIncrement: '1', priceIncrement: '0.01', pointValue: '1', currency: 'USD' }),
    normalizeInstrument({ ...metadata, id: 'es', priceUnit: 'points', name: 'E-mini S&P 500', symbol: 'ES', market: 'Futures', preset: 'futures', model: 'linear', quantityUnit: 'contracts', quantityIncrement: '1', priceIncrement: '0.25', pointValue: '50', currency: 'USD' }),
    normalizeInstrument({ ...metadata, id: 'spy-call', priceUnit: 'USD/share', name: 'SPY call option', symbol: 'SPY', market: 'Options', preset: 'options', model: 'manual', quantityUnit: 'contracts', quantityIncrement: '1', priceIncrement: '0.01', pointValue: null, currency: 'USD', underlying: 'SPY', expiry: '2027-01-15', strike: '600', optionType: 'call' }),
  ];
  const strategy = normalizeStrategy({ ...metadata, id: 'breakout', name: 'Breakout', purpose: 'Synthetic example strategy', markets: 'Equities', entryRules: 'Close above resistance', exitRules: 'Exit below invalidation level', riskRules: 'Risk a fixed account amount' });
  account.hasTrades = true;
  await writeDocument('accounts', account.id, account);
  for (const instrument of instruments) await writeDocument('instruments', instrument.id, instrument);
  await writeDocument('strategies', strategy.id, strategy);
  const trade = createTrade({ id: 'scaled-demo', account, instruments: [{ instrument: instruments[0], direction: 'long', planning: { entry: '10', stop: '8', riskBudget: '500', rate: '1' } }], strategy });
  trade.uid = auth.localId;
  trade.createdAt = '2026-09-28T09:00:00.000Z';
  trade.updatedAt = now;
  trade.revision = 1;
  trade.rationale = 'Synthetic example: planned breakout through resistance.';
  trade.tags = ['example', 'breakout'];
  trade.lastOperation = 'seed';
  trade.executions = [
    { id: 'scaled-demo-exec-1', legId: trade.legs[0].id, kind: 'entry', quantity: '100', price: '10', timestamp: '2026-09-28T09:05:00.000Z', sequence: 1, fees: '0', feeCurrency: 'USD', orderReference: 'demo-entry-1' },
    { id: 'scaled-demo-exec-2', legId: trade.legs[0].id, kind: 'entry', quantity: '100', price: '12', timestamp: '2026-09-28T09:15:00.000Z', sequence: 2, fees: '0', feeCurrency: 'USD', orderReference: 'demo-entry-2' },
    { id: 'scaled-demo-exec-3', legId: trade.legs[0].id, kind: 'exit', quantity: '50', price: '13', timestamp: '2026-09-28T10:00:00.000Z', sequence: 3, fees: '0', feeCurrency: 'USD', orderReference: 'demo-exit-1' },
    { id: 'scaled-demo-exec-4', legId: trade.legs[0].id, kind: 'entry', quantity: '50', price: '10', timestamp: '2026-09-28T10:15:00.000Z', sequence: 4, fees: '0', feeCurrency: 'USD', orderReference: 'demo-entry-3' },
    { id: 'scaled-demo-exec-5', legId: trade.legs[0].id, kind: 'exit', quantity: '200', price: '12', timestamp: '2026-09-28T11:00:00.000Z', sequence: 5, fees: '0', feeCurrency: 'USD', orderReference: 'demo-exit-2' },
  ];
  trade.status = 'closed';
  const calculated = calculateTrade(trade);
  trade.summary = { ...calculated, legs: calculated.legs.map(({ history: _history, ...leg }) => leg) };
  trade.openedAt = trade.summary.openedAt;
  trade.instruments = trade.legs.map((leg) => ({ name: leg.snapshot.name, symbol: leg.snapshot.symbol, market: leg.snapshot.market }));
  const { legs, executions, ...tradeDocument } = trade;
  delete tradeDocument.adjustments;
  await writeDocument('trades', trade.id, tradeDocument);
  for (const leg of legs) await writeDocument(`trades/${trade.id}/legs`, leg.id, { ...metadata, ...leg });
  for (const execution of executions) await writeDocument(`trades/${trade.id}/executions`, execution.id, { ...metadata, ...execution });
  await writeDocument('settings', 'preferences', {
    ...metadata, id: 'preferences', theme: 'system', timezone: 'UTC', defaultAccount: account.id,
  });
  console.log(`Synthetic dev records loaded for ${email}. Demo password: ${password}.`);
}
