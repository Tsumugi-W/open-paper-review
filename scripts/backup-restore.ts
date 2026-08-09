#!/usr/bin/env tsx
/**
 * Database backup and restore utility.
 *
 * Usage:
 *   pnpm tsx scripts/backup-restore.ts backup [--output ./backups/]
 *   pnpm tsx scripts/backup-restore.ts restore --input ./backups/opr-2026-08-01.sql
 */

import { execFile } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return url;
}

function parseDatabaseUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    database: parsed.pathname.slice(1),
    user: parsed.username,
    password: parsed.password,
  };
}

async function backup(outputDir: string): Promise<void> {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const db = parseDatabaseUrl(getDatabaseUrl());
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `opr-${timestamp}.sql`;
  const outputPath = join(outputDir, filename);

  console.log(`Backing up database "${db.database}" to ${outputPath}...`);

  const env = { ...process.env, PGPASSWORD: db.password };

  await execFileAsync('pg_dump', [
    '-h', db.host,
    '-p', db.port,
    '-U', db.user,
    '-d', db.database,
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    `-f`, outputPath,
  ], { env, timeout: 300000 });

  console.log(`Backup complete: ${outputPath}`);
}

async function restore(inputPath: string): Promise<void> {
  if (!existsSync(inputPath)) {
    throw new Error(`Backup file not found: ${inputPath}`);
  }

  const db = parseDatabaseUrl(getDatabaseUrl());
  const env = { ...process.env, PGPASSWORD: db.password };

  console.log(`Restoring database "${db.database}" from ${inputPath}...`);
  console.warn('WARNING: This will overwrite existing data!');

  await execFileAsync('pg_restore', [
    '-h', db.host,
    '-p', db.port,
    '-U', db.user,
    '-d', db.database,
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-privileges',
    inputPath,
  ], { env, timeout: 600000 });

  console.log('Restore complete.');
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'backup': {
      const outputIdx = args.indexOf('--output');
      const outputDir = outputIdx >= 0 ? args[outputIdx + 1] : './backups';
      await backup(outputDir);
      break;
    }
    case 'restore': {
      const inputIdx = args.indexOf('--input');
      if (inputIdx < 0) throw new Error('--input path required for restore');
      await restore(args[inputIdx + 1]);
      break;
    }
    default:
      console.log('Usage:');
      console.log('  backup [--output ./backups/]');
      console.log('  restore --input ./backups/opr-2026-08-01.sql');
      process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
