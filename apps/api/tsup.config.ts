import { defineConfig } from 'tsup';

export default defineConfig({
  // server.js is the app; db/createAdmin.js is the one-off "create the first admin" command.
  entry: ['src/server.ts', 'src/db/createAdmin.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  // Bundle the TS-source workspace package; keep npm deps external.
  noExternal: ['@pathway/shared'],
});
