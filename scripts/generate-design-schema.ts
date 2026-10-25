import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { format } from 'prettier';
import { designSpecificationSchema } from '../packages/shared/src/index.js';
await writeFile(
  new URL('../packages/shared/design-spec.schema.json', import.meta.url),
  await format(
    JSON.stringify(z.toJSONSchema(designSpecificationSchema, { io: 'input' })),
    { parser: 'json' },
  ),
);
process.stdout.write(
  'Generated packages/shared/design-spec.schema.json from Zod v1.\n',
);
