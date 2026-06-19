import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import {
  getFirestore,
  Firestore,
  Timestamp,
  Query,
  Transaction,
  DocumentData,
  DocumentSnapshot,
} from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

type Where = Record<string, unknown>;
interface QueryOpts {
  where?: Where; // equality filters, ANDed
  orderBy?: { field: string; dir?: 'asc' | 'desc' };
  limit?: number;
}

/**
 * Firestore replacement for PrismaService.
 *
 * Design goals while migrating off Postgres/Prisma:
 *  - Keep the existing REST/JWT contract: documents use **integer ids**
 *    (emulated with a `_counters` collection, like Postgres sequences), so
 *    controllers (`ParseIntPipe`), the JWT `sub`, and the frontend are unchanged.
 *  - Match Prisma's JSON output: Firestore `Timestamp`s are mapped back to JS
 *    `Date` on read (Nest serializes Date -> ISO, exactly like before).
 *  - Init is lenient: if Firebase isn't configured yet the app still boots; the
 *    helpers throw a clear error only when actually used.
 */
@Injectable()
export class FirestoreService implements OnModuleInit {
  private readonly logger = new Logger(FirestoreService.name);
  private _db?: Firestore;

  onModuleInit() {
    try {
      if (!getApps().length) this.initApp();
      this._db = getFirestore();
      this._db.settings({ ignoreUndefinedProperties: true });
      this.logger.log('Firestore initialized.');
    } catch (err) {
      this.logger.error(
        `Firestore NOT initialized: ${(err as Error).message}. ` +
          'Set FIRESTORE_EMULATOR_HOST (local) or FIREBASE_PROJECT_ID/' +
          'FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY (or serviceAccountKey.json).',
      );
    }
  }

  private initApp() {
    const projectId =
      process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;

    // 1) Local emulator (no real credentials needed).
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      initializeApp({ projectId: projectId || 'erp-system-local' });
      this.logger.warn(
        `Using Firestore emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`,
      );
      return;
    }

    // 2) Service account from individual env vars.
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (projectId && clientEmail && privateKey) {
      privateKey = privateKey.replace(/\\n/g, '\n');
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
      return;
    }

    // 3) Service account JSON file.
    const keyPath =
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(keyPath)) {
      const sa = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      initializeApp({ credential: cert(sa) });
      return;
    }

    throw new Error('No Firebase credentials found.');
  }

  /** Raw Firestore handle (throws if not configured). */
  get db(): Firestore {
    if (!this._db)
      throw new ServiceUnavailableException(
        'Firestore is not configured on the server.',
      );
    return this._db;
  }

  get isConfigured(): boolean {
    return !!this._db;
  }

  col(name: string) {
    return this.db.collection(name);
  }

  /** Auto-increment integer id (emulates a Postgres sequence). */
  async nextId(collection: string): Promise<number> {
    const ref = this.db.collection('_counters').doc(collection);
    return this.db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      const current = (snap.exists ? (snap.data()?.value as number) : 0) || 0;
      const next = current + 1;
      tx.set(ref, { value: next }, { merge: true });
      return next;
    });
  }

  // ---- serialization (JS Date <-> Firestore Timestamp; numeric id) ----

  private serialize(data: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      out[k] = v instanceof Date ? Timestamp.fromDate(v) : v;
    }
    return out;
  }

  /** Doc -> entity: numeric `id`, Timestamps -> Date. */
  deserialize<T = any>(id: string, data: DocumentData): T {
    const out: Record<string, unknown> = { id: Number(id) };
    for (const [k, v] of Object.entries(data)) {
      if (k === 'id') continue;
      out[k] = v instanceof Timestamp ? v.toDate() : v;
    }
    return out as T;
  }

  map<T = any>(snap: DocumentSnapshot): T | null {
    return snap.exists ? this.deserialize<T>(snap.id, snap.data()!) : null;
  }

  // ---- generic CRUD / query helpers ----

  async findById<T = any>(collection: string, id: number): Promise<T | null> {
    return this.map<T>(await this.col(collection).doc(String(id)).get());
  }

  async findMany<T = any>(collection: string, opts: QueryOpts = {}): Promise<T[]> {
    let q: Query = this.col(collection);
    for (const [field, value] of Object.entries(opts.where ?? {}))
      q = q.where(field, '==', value);
    if (opts.orderBy) q = q.orderBy(opts.orderBy.field, opts.orderBy.dir ?? 'asc');
    if (opts.limit) q = q.limit(opts.limit);
    const res = await q.get();
    return res.docs.map((d) => this.deserialize<T>(d.id, d.data()));
  }

  async findOne<T = any>(collection: string, where: Where): Promise<T | null> {
    const rows = await this.findMany<T>(collection, { where, limit: 1 });
    return rows[0] ?? null;
  }

  async count(collection: string, where: Where = {}): Promise<number> {
    let q: Query = this.col(collection);
    for (const [field, value] of Object.entries(where))
      q = q.where(field, '==', value);
    const res = await q.count().get();
    return res.data().count;
  }

  /** Create with auto id + createdAt/updatedAt. */
  async create<T = any>(
    collection: string,
    data: Record<string, unknown>,
  ): Promise<T> {
    const id = await this.nextId(collection);
    return this.createWithId<T>(collection, id, data);
  }

  /** Create with a caller-supplied id (e.g. id mirrors another collection). */
  async createWithId<T = any>(
    collection: string,
    id: number,
    data: Record<string, unknown>,
  ): Promise<T> {
    const now = Timestamp.now();
    // Store a numeric `id` field too (doc ids are strings, so a field is needed
    // for correct numeric ordering / range queries).
    const payload = { id, ...this.serialize(data), createdAt: now, updatedAt: now };
    await this.col(collection).doc(String(id)).set(payload);
    return this.deserialize<T>(String(id), payload);
  }

  async update<T = any>(
    collection: string,
    id: number,
    data: Record<string, unknown>,
  ): Promise<T> {
    const ref = this.col(collection).doc(String(id));
    await ref.set(
      { ...this.serialize(data), updatedAt: Timestamp.now() },
      { merge: true },
    );
    const snap = await ref.get();
    return this.deserialize<T>(snap.id, snap.data()!);
  }

  async delete(collection: string, id: number): Promise<void> {
    await this.col(collection).doc(String(id)).delete();
  }

  /** Delete every doc matching equality filters; returns the count removed. */
  async deleteMany(collection: string, where: Where = {}): Promise<number> {
    let q: Query = this.col(collection);
    for (const [field, value] of Object.entries(where))
      q = q.where(field, '==', value);
    const res = await q.get();
    const batch = this.db.batch();
    res.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return res.size;
  }

  /** Update every doc matching equality filters; returns the count updated. */
  async updateMany(
    collection: string,
    where: Where,
    data: Record<string, unknown>,
  ): Promise<number> {
    let q: Query = this.col(collection);
    for (const [field, value] of Object.entries(where))
      q = q.where(field, '==', value);
    const res = await q.get();
    const batch = this.db.batch();
    const payload = { ...this.serialize(data), updatedAt: Timestamp.now() };
    res.docs.forEach((d) => batch.set(d.ref, payload, { merge: true }));
    await batch.commit();
    return res.size;
  }
}
