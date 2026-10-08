/** Operator commands distinguish preservation from destructive recovery. */
export function argumentsFor(args) {
  const [action, ...rest] = args;
  if (action === 'initialize') throw new Error('Use database:upgrade; it preserves records and runs automatically during development startup.');
  if (!['deploy', 'status', 'restore', 'upgrade'].includes(action)) throw new Error('Expected deploy, status, restore or upgrade.');
  const allowed = {
    deploy: ['--profile', '--dry-run', '--resume', '--register-existing-schema', '--backup-dir'],
    upgrade: ['--profile', '--dry-run', '--resume', '--backup-dir'],
    status: ['--profile'],
    restore: ['--profile', '--resume', '--snapshot', '--yes'],
  };
  const options = {};
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i];
    if (key === '--bootstrap-schema') throw new Error('Use --register-existing-schema 1 to validate and register existing data without clearing it.');
    if (!allowed[action].includes(key) || key in options) throw new Error(`Invalid option: ${key}`);
    options[key] = ['--dry-run', '--yes'].includes(key) ? true : rest[++i];
    if (!options[key] || String(options[key]).startsWith('--')) throw new Error(`Missing value: ${key}`);
  }
  if (!options['--profile']) throw new Error('Explicit --profile required.');
  if (action === 'upgrade' && options['--profile'] === 'prod') throw new Error('Automatic upgrades are emulator-only; production uses guarded deployment.');
  if (options['--resume'] && !/^[0-9a-f-]{36}$/.test(options['--resume'])) throw new Error('Invalid run ID.');
  if (options['--register-existing-schema'] && options['--register-existing-schema'] !== '1') throw new Error('Only existing schema 1 can be registered; records are preserved.');
  if (action === 'restore' && (!options['--yes'] || !options['--snapshot'] || !options['--resume'])) throw new Error('Restore replaces journal records and requires --snapshot <file> --resume <interrupted-run-id> --yes.');
  return { action, options };
}
