import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { EJSON } from 'bson';
import { logger } from './logger';

const SNAPSHOT_DIR = path.resolve(__dirname, '../../data');
const SNAPSHOT_FILE = path.join(SNAPSHOT_DIR, 'local-dev-snapshot.json');
const SNAPSHOT_TMP_FILE = path.join(SNAPSHOT_DIR, 'local-dev-snapshot.tmp.json');

let autoSnapshotTimer: NodeJS.Timeout | null = null;
let isSaving = false;

/**
 * Recursively restores BSON native types (ObjectIds, Dates) so that Mongoose models
 * and `.save()` operations find documents by their genuine BSON ObjectId.
 */
export function resurrectBsonValue(val: any, key?: string): any {
  if (val === null || val === undefined) return val;

  if (val instanceof mongoose.Types.ObjectId) return val;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? new Date() : val;
  }

  // Handle BSON ObjectId object
  if (typeof val === 'object' && val._bsontype === 'ObjectID') {
    return new mongoose.Types.ObjectId(val.toString());
  }

  // Handle EJSON $oid
  if (typeof val === 'object' && val.$oid && typeof val.$oid === 'string') {
    return new mongoose.Types.ObjectId(val.$oid);
  }

  // Handle EJSON $date
  if (typeof val === 'object' && val.$date) {
    const raw =
      typeof val.$date === 'object' && val.$date.$numberLong
        ? Number(val.$date.$numberLong)
        : val.$date;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  // Convert string _id and known reference ID fields (24-char hex strings) to ObjectId
  if (typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val)) {
    if (
      key === '_id' ||
      key === 'userId' ||
      key === 'retailerProfileId' ||
      key === 'retailerId' ||
      key === 'productId' ||
      key === 'variantId' ||
      key === 'pricingGroupId' ||
      key === 'discountGroupId' ||
      key === 'approvedBy' ||
      key === 'archivedBy' ||
      key === 'salesmanId' ||
      key === 'assignedSalesmanId' ||
      key === 'actorId' ||
      key === 'targetId' ||
      key === 'recordedByUserId' ||
      key === 'placedByUserId'
    ) {
      return new mongoose.Types.ObjectId(val);
    }
  }

  // Handle ISO Date strings
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  // Handle Arrays
  if (Array.isArray(val)) {
    return val.map((item) => resurrectBsonValue(item, key));
  }

  // Handle nested objects
  if (typeof val === 'object') {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      result[k] = resurrectBsonValue(v, k);
    }
    return result;
  }

  return val;
}

/**
 * Automatically export all collections from the active MongoDB database to disk.
 * Uses MongoDB EJSON serialization so ObjectIds and Dates are preserved with complete BSON fidelity.
 */
export async function exportLocalSnapshot(): Promise<boolean> {
  if (mongoose.connection.readyState !== 1) {
    return false;
  }

  if (isSaving) {
    return false;
  }

  isSaving = true;

  try {
    if (!fs.existsSync(SNAPSHOT_DIR)) {
      fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    }

    const collections = await mongoose.connection.db?.listCollections().toArray();
    if (!collections || collections.length === 0) {
      isSaving = false;
      return false;
    }

    const snapshotData: Record<string, any[]> = {};
    let totalDocs = 0;

    for (const coll of collections) {
      if (coll.name.startsWith('system.')) continue;

      const docs = await mongoose.connection.db?.collection(coll.name).find({}).toArray();
      if (docs && docs.length > 0) {
        snapshotData[coll.name] = docs;
        totalDocs += docs.length;
      }
    }

    if (totalDocs > 0) {
      const serialized = EJSON.stringify(snapshotData, { relaxed: false });
      fs.writeFileSync(SNAPSHOT_TMP_FILE, serialized, 'utf-8');
      fs.renameSync(SNAPSHOT_TMP_FILE, SNAPSHOT_FILE);
      logger.debug(`💾 Local dev snapshot saved: ${totalDocs} documents across ${Object.keys(snapshotData).length} collections.`);
    }

    isSaving = false;
    return true;
  } catch (error: any) {
    isSaving = false;
    logger.warn(`Failed to export local development snapshot: ${error.message}`);
    return false;
  }
}

/**
 * Automatically restore all collections from disk snapshot into the current MongoDB instance.
 * Ensures all _id and foreign reference fields are genuine BSON ObjectIds so .save() never fails.
 */
export async function importLocalSnapshot(): Promise<number> {
  if (mongoose.connection.readyState !== 1) {
    return 0;
  }

  if (!fs.existsSync(SNAPSHOT_FILE)) {
    logger.info('No existing local development snapshot found. Starting with fresh initial state.');
    return 0;
  }

  try {
    const rawData = fs.readFileSync(SNAPSHOT_FILE, 'utf-8');
    let parsedData: Record<string, any[]>;

    try {
      parsedData = EJSON.parse(rawData) as any;
    } catch {
      parsedData = JSON.parse(rawData);
    }

    let totalRestored = 0;

    for (const [collName, docs] of Object.entries(parsedData)) {
      if (!Array.isArray(docs) || docs.length === 0) continue;

      const coll = mongoose.connection.db?.collection(collName);
      if (!coll) continue;

      for (const rawDoc of docs) {
        if (!rawDoc) continue;
        const doc = resurrectBsonValue(rawDoc);
        if (!doc._id) continue;

        // Force _id to be an ObjectId if it matches 24-character hex string
        if (typeof doc._id === 'string' && /^[0-9a-fA-F]{24}$/.test(doc._id)) {
          doc._id = new mongoose.Types.ObjectId(doc._id);
        }

        // Clean out any stale string _id document if it existed
        try {
          await coll.deleteOne({ _id: doc._id.toString() as any });
        } catch {
          // ignore
        }

        // Upsert document using native ObjectId
        await coll.replaceOne({ _id: doc._id }, doc, { upsert: true });
        totalRestored++;
      }
    }

    logger.info(
      `✅ Successfully restored ${totalRestored} documents across ${Object.keys(parsedData).length} collections from persistent disk snapshot (${SNAPSHOT_FILE}). Customer data preserved!`
    );

    return totalRestored;
  } catch (error: any) {
    logger.warn(`Failed to restore local development snapshot: ${error.message}`);
    return 0;
  }
}

/**
 * Start periodic snapshotting during development to ensure all customer modifications
 * are continuously persisted to disk before server restarts.
 */
export function startAutoSnapshot(intervalMs = 8000): void {
  if (autoSnapshotTimer) {
    clearInterval(autoSnapshotTimer);
  }

  autoSnapshotTimer = setInterval(() => {
    exportLocalSnapshot().catch(() => {});
  }, intervalMs);

  autoSnapshotTimer.unref();

  const saveAndExit = async () => {
    try {
      await exportLocalSnapshot();
    } catch {
      // ignore
    }
  };

  process.once('SIGINT', saveAndExit);
  process.once('SIGTERM', saveAndExit);
  process.once('beforeExit', saveAndExit);
}
