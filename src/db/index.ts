import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let connectionString = process.env.DATABASE_URL || '';

// Fallback to a syntactically valid dummy connection string if the user hasn't configured it yet.
// This prevents Next.js compilation from crashing at build-time (static analysis/route generation).
const isPlaceholder = !connectionString || connectionString.includes('[PASSWORD]') || !connectionString.startsWith('postgres');
if (isPlaceholder) {
  connectionString = 'postgresql://postgres:postgres@localhost:5432/postgres';
}

const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export { isPlaceholder };
