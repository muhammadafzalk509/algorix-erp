/**
 * Firestore equivalent of prisma/seed.ts — seeds the 12 roles and the
 * seed-only CEO / CTO accounts into Firestore.
 *
 * Run (after backend/serviceAccountKey.json exists, or FIREBASE_* env is set):
 *   npm run firestore:seed
 *
 * Idempotent: roles are upserted by name, users by email.
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore, Timestamp } from 'firebase-admin/firestore';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

try {
  // Load backend/.env if dotenv is available (no-op if it isn't).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv').config();
} catch {
  /* dotenv optional */
}

// Mirrors prisma/seed.ts ROLES. Tiers/capabilities are stored as plain strings.
const ROLES: {
  name: string;
  permissionTier: string;
  description: string;
  capabilities: string[];
}[] = [
  { name: 'CEO', permissionTier: 'TIER_0', description: 'Highest authority. Read-only access to everything.', capabilities: ['NOTIFY_GLOBAL', 'PAYROLL_AUDIT', 'ATTENDANCE_MANAGE', 'AUDIT_VIEW', 'USER_MANAGE'] },
  { name: 'CTO', permissionTier: 'TIER_1', description: 'Technical authority. Approves Developer accounts.', capabilities: ['NOTIFY_GLOBAL', 'PAYROLL_AUDIT', 'ATTENDANCE_MANAGE', 'AUDIT_VIEW', 'USER_MANAGE'] },
  { name: 'VP Engineering', permissionTier: 'TIER_2', description: 'Oversees engineering output. Manages projects and developers.', capabilities: ['USER_MANAGE', 'ATTENDANCE_MANAGE'] },
  { name: 'Head of Developer', permissionTier: 'TIER_3', description: 'Manages developer teams, tasks, logs, timesheets.', capabilities: [] },
  { name: 'Head of Documentation', permissionTier: 'TIER_4', description: 'Manages the document module.', capabilities: [] },
  { name: 'Developer', permissionTier: 'TIER_5', description: 'Access to assigned tasks and own data only.', capabilities: [] },
  { name: 'QA', permissionTier: 'TIER_6', description: 'Quality assurance: validates tasks and files bug reports.', capabilities: ['QA_VALIDATE'] },
  { name: 'HR / Payroll Officer', permissionTier: 'TIER_7', description: 'Manages employee salary records, payroll and company-wide attendance.', capabilities: ['PAYROLL_VIEW', 'PAYROLL_EDIT', 'ATTENDANCE_MANAGE'] },
  { name: 'Tester Head', permissionTier: 'TIER_3', description: 'Leads the QA/testing team; validates tasks and files bugs.', capabilities: ['QA_VALIDATE'] },
  { name: 'Documentation Specialist', permissionTier: 'TIER_5', description: 'Documentation team member under Head of Documentation. Own data only.', capabilities: [] },
  { name: 'IoT Head', permissionTier: 'TIER_3', description: 'Leads the IoT engineering team; manages IoT tasks.', capabilities: [] },
  { name: 'IoT Engineer', permissionTier: 'TIER_5', description: 'IoT engineering team member. Access to assigned tasks and own data only.', capabilities: [] },
];

function initFirebase(): Firestore {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      initializeApp({ projectId: projectId || 'erp-system-local' });
    } else if (projectId && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.resolve(process.cwd(), 'serviceAccountKey.json');
      if (!fs.existsSync(keyPath))
        throw new Error('No Firebase credentials. Add backend/serviceAccountKey.json or set FIREBASE_* env vars.');
      initializeApp({ credential: cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))) });
    }
  }
  return getFirestore();
}

async function nextId(db: Firestore, collection: string): Promise<number> {
  const ref = db.collection('_counters').doc(collection);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = (snap.exists ? (snap.data()?.value as number) : 0) || 0;
    const next = current + 1;
    tx.set(ref, { value: next }, { merge: true });
    return next;
  });
}

async function upsertByField(
  db: Firestore,
  collection: string,
  field: string,
  value: string,
  data: Record<string, unknown>,
): Promise<number> {
  const existing = await db.collection(collection).where(field, '==', value).limit(1).get();
  const now = Timestamp.now();
  if (!existing.empty) {
    const doc = existing.docs[0];
    await doc.ref.set({ ...data, updatedAt: now }, { merge: true });
    return Number(doc.id);
  }
  const id = await nextId(db, collection);
  await db.collection(collection).doc(String(id)).set({ ...data, createdAt: now, updatedAt: now });
  return id;
}

async function main() {
  const db = initFirebase();
  db.settings({ ignoreUndefinedProperties: true });

  // 1) Roles
  const roleIds: Record<string, number> = {};
  for (const r of ROLES) {
    roleIds[r.name] = await upsertByField(db, 'roles', 'name', r.name, r);
  }
  console.log(`✅ Seeded ${ROLES.length} roles`);

  // 2) CEO + CTO (seed-only)
  const ceoEmail = (process.env.CEO_SEED_EMAIL || 'ceo@company.com').toLowerCase();
  const ceoPass = process.env.CEO_SEED_PASSWORD || 'ChangeMe!CEO123';
  await upsertByField(db, 'users', 'email', ceoEmail, {
    firstName: 'Chief', lastName: 'Executive', email: ceoEmail,
    passwordHash: await bcrypt.hash(ceoPass, 10),
    roleId: roleIds['CEO'], designation: 'CEO', status: 'ACTIVE',
  });

  const ctoEmail = (process.env.CTO_SEED_EMAIL || 'cto@company.com').toLowerCase();
  const ctoPass = process.env.CTO_SEED_PASSWORD || 'ChangeMe!CTO123';
  await upsertByField(db, 'users', 'email', ctoEmail, {
    firstName: 'Chief', lastName: 'Technology', email: ctoEmail,
    passwordHash: await bcrypt.hash(ctoPass, 10),
    roleId: roleIds['CTO'], designation: 'CTO', status: 'ACTIVE',
  });

  console.log(`✅ Seeded CEO (${ceoEmail}) and CTO (${ctoEmail})`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌ Firestore seed failed:', e);
    process.exit(1);
  });
