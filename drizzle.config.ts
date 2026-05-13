import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/main/infrastructure/db/schema.ts',
  out: './src/main/infrastructure/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    // Used only for drizzle-kit generate — not the runtime path.
    url: './dev.db',
  },
})
