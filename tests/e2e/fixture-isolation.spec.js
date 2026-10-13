import { test, expect, setup, cleanupFixture } from './fixtures.js';

test('synthetic users own separate journals and cleanup preserves the other graph', async ({ browser }) => {
  const first = await browser.newContext(), second = await browser.newContext();
  const one = await first.newPage(), two = await second.newPage();
  try {
    await setup(one); await setup(two);
    const identity = (page) => page.evaluate(async () => (await import('/src/persistence/firebase.js')).auth.currentUser.uid);
    expect(await identity(one)).not.toBe(await identity(two));
    await cleanupFixture(one);
    const surviving = await two.evaluate(async () => {
      const { auth, db } = await import('/src/persistence/firebase.js');
      const { Repository } = await import('/src/persistence/repository.js');
      return new Repository(db, auth.currentUser.uid).list('accounts');
    });
    expect(surviving).toMatchObject([{ id: 'main', name: 'Main', uid: await identity(two) }]);
  } finally {
    await cleanupFixture(one); await cleanupFixture(two);
    await first.close(); await second.close();
  }
});
