import { run } from './pipeline.js';
import { log } from './logger.js';

run({ mode: 'full' })
  .then((result) => {
    log.info('full.exit', result as unknown as Record<string, unknown>);
    process.exit(0);
  })
  .catch((err: unknown) => {
    log.error('full.fatal', { err: (err as Error).message, stack: (err as Error).stack });
    process.exit(1);
  });
