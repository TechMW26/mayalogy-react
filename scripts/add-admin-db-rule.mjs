// One-time: lock the admin panel's notes (maya_admin_leads) so only the server can read
// or write them. Reads the LIVE rules, adds just this one entry, keeps a backup.
// Run from the project folder:  node scripts/add-admin-db-rule.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadEnv } from 'vite';
import { getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

Object.assign(process.env, loadEnv('development', process.cwd(), ''), process.env);
const { getAuthClient } = await import('../api/_firebase.js');
getAuthClient(); // starts the admin app with the keys from .env.local

const db = getDatabase(getApps()[0]);
const live = await db.getRulesJSON();
const backup = path.join(os.tmpdir(), `maya-rules-backup-${Date.now()}.json`);
fs.writeFileSync(backup, JSON.stringify(live, null, 2));

live.rules = live.rules || {};
const want = { '.read': false, '.write': false };
if (JSON.stringify(live.rules.maya_admin_leads) === JSON.stringify(want)) {
    console.log('ALREADY LOCKED: maya_admin_leads');
} else {
    live.rules.maya_admin_leads = want;
    await db.setRules(JSON.stringify(live));
    console.log('RULES UPDATED: maya_admin_leads is now server-only');
}
console.log(`Backup of the old rules: ${backup}`);
process.exit(0);
