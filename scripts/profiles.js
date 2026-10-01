export const profiles = {
  dev: { id: 'demo-vxjournal-dev', auth: 9099, firestore: 8080, ui: 4000, vite: 5173, config: 'firebase.dev.json', dataDir: '.local-emulators/dev' },
  test: { id: 'demo-vxjournal-test', auth: 9199, firestore: 8180, ui: 4100, vite: 5174, config: 'firebase.test.json', dataDir: '.local-emulators/test' },
  auto: { id: 'demo-vxjournal-auto', auth: 9299, firestore: 8280, ui: 4200, vite: 5175, config: 'firebase.auto.json', dataDir: null },
};

export function getProfile(name = process.env.VXJ_PROFILE ?? 'dev') {
  const profile = profiles[name];
  if (!profile) throw new Error(`Unknown profile "${name}". Use dev, test, or auto.`);
  return { name, ...profile };
}

export function parseProfileArg(args = process.argv.slice(2)) {
  const index = args.indexOf('--profile');
  return index < 0 ? undefined : args[index + 1];
}
