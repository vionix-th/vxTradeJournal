import { encode, decode } from "./snapshot.js";
import { journalDocuments } from "./admin.js";
import { migrationChain, metadata } from "./schema.js";

export async function migrate(db, lease, registry) {
  let installed = (await db.doc("_system/database").get()).data().schemaVersion;
  const applied = (await db.doc("_system/evolution").get()).data()?.applied || [];
  const chain = migrationChain(installed, registry.target, registry.migrations, applied);
  for (const step of chain) {
    const runRef = db.doc(`_system/runs/history/${lease.runId}`);
    const state = (await runRef.get()).data()?.migration;
    if (!registry.validators.has(step.to)) throw new Error(`Missing target schema validator ${step.to}.`);
    const input = await journalDocuments(db);
    if (!state || state.id !== step.id) {
      await step.validateSource(input);
      await lease.transaction(async (tx) => tx.set(runRef, { migration: { id: step.id, checksum: step.checksum, cursor: null } }, { merge: true }));
    } else if (state.checksum !== step.checksum) throw new Error("Resumed migration checksum differs.");
    const cursor = state?.id === step.id ? state.cursor : null;
    const remaining = input.filter((item) => !cursor || item.path > cursor);
    for (let index = 0; index < remaining.length;) {
      lease.assert();
      const owner = remaining[index].path.split("/")[1];
      const chunk = remaining.slice(index, index + 100).filter((item) => item.path.split("/")[1] === owner);
      const changes = await step.transform(chunk.map(({ path, data }) => ({ path, data: decode(encode(data, db), db) })));
      if (!Array.isArray(changes) || changes.length > 200 || changes.some((item) => !/^users\/[^/]+(?:\/[^/]+\/[^/]+)*$/.test(item.path))) throw new Error("Migration returned invalid or unbounded writes.");
      if (changes.some((item) => item.path.split("/")[1] !== owner || item.data?.uid && item.data.uid !== owner)) throw new Error("Migration must preserve journal ownership.");
      await lease.transaction(async (tx) => {
        for (const change of changes) { if (change.delete === true) tx.delete(db.doc(change.path)); else tx.set(db.doc(change.path), change.data); }
        tx.set(runRef, { migration: { id: step.id, checksum: step.checksum, cursor: chunk.at(-1).path } }, { merge: true });
      });
      index += chunk.length;
    }
    const result = await journalDocuments(db);
    await step.validateTarget(result);
    await registry.validators.get(step.to)(result);
    installed = step.to;
    applied.push({ id: step.id, checksum: step.checksum, from: step.from, to: step.to });
    await lease.transaction(async (tx) => {
      tx.set(db.doc("_system/database"), metadata(installed, "maintenance"));
      tx.set(db.doc("_system/evolution"), { applied });
      tx.set(runRef, { completed: applied, migration: null }, { merge: true });
    });
  }
  const validator = registry.validators.get(installed);
  if (!validator) throw new Error("Unknown installed schema.");
  await validator(await journalDocuments(db));
}
