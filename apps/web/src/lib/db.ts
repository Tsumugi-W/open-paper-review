import { getDb } from '@opr/db';

let dbInstance: ReturnType<typeof getDb> | null = null;

export function db() {
  if (!dbInstance) {
    dbInstance = getDb();
  }
  return dbInstance;
}
