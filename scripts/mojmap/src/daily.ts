import { run } from './pipeline.js';
import { log } from './logger.js';

run({ mode: 'daily' })
  .then((result) => {
    log.info('daily.exit', result as unknown as Record<string, unknown>);
    process.exit(0);
  })
  .catch((err: unknown) => {
    log.error('daily.fatal', { err: (err as Error).message, stack: (err as Error).stack });
    process.exit(1);
  });
