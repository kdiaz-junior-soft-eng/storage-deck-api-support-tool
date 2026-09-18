// StorageDeckAPI/src/database/storageDeckRepository.ts
import { Collection } from "mongodb";
import { connectMongoDB } from "./mongodb";
import { env } from "../../config/env";

export interface HourlyCount {
  hour: number;
  count: number;
}

export interface DetailedHourlyBucket {
  year: number;
  month: number;
  day: number;
  hour: number;
  count: number;
  bucketStartDate: Date;
}

export interface StorageDeckDocument {
  _id: string;
  createdOn: Date;
  status: string;
}

export interface StorageDeckErrorMessage {
  message?: string;
}

export interface StorageDeckFileDetail {
  name: string;
  recipientName: string;
  status: string;
  errorMessages?: StorageDeckErrorMessage | StorageDeckErrorMessage[];
  createdOn: Date;
  s3Key?: string;
  s3Bucket?: string;
}

/**
 * Internal helper to retrieve the typed storage_deck_document collection.
 */
async function getStorageDeckCollection(): Promise<Collection> {
  const db = await connectMongoDB();
  return db.collection("storage_deck_document");
}

/**
 * Counts all StorageDeck documents with the specified status before the given date.
 */
export async function countDocumentsBeforeDate(
  dateFilter: Date,
  status: string = env.TARGET_STATUS
): Promise<number> {
  const collection = await getStorageDeckCollection();

  return collection.countDocuments({
    _class: "StorageDeck",
    status,
    createdOn: {
      $lt: dateFilter,
    },
  });
}

/**
 * Counts all StorageDeck documents that are NOT 'STORED' before the given date.
 */
export async function countNonStoredDocumentsBeforeDate(
  dateFilter: Date
): Promise<number> {
  const collection = await getStorageDeckCollection();

  return collection.countDocuments({
    _class: "StorageDeck",
    status: { $ne: "STORED" },
    createdOn: {
      $lt: dateFilter,
    },
  });
}

/**
 * Returns hourly distribution between two dates for a specific status.
 */
export async function getHourlyCounts(
  startDate: Date,
  endDate: Date,
  status: string = env.TARGET_STATUS
): Promise<HourlyCount[]> {
  const collection = await getStorageDeckCollection();

  return collection
    .aggregate<HourlyCount>([
      {
        $match: {
          _class: "StorageDeck",
          status,
          createdOn: {
            $gte: startDate,
            $lt: endDate,
          },
        },
      },
      {
        $group: {
          _id: { $hour: "$createdOn" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          hour: "$_id",
          count: 1,
        },
      },
    ])
    .toArray();
}

/**
 * Aggregates all documents across all days up to targetDate, grouped chronologically by Hour.
 */
export async function getChronologicalHourlyBuckets(
  targetDate: Date,
  status: string = env.TARGET_STATUS
): Promise<DetailedHourlyBucket[]> {
  const collection = await getStorageDeckCollection();

  const results = await collection
    .aggregate<{
      _id: { year: number; month: number; day: number; hour: number };
      count: number;
    }>([
      {
        $match: {
          _class: "StorageDeck",
          status,
          createdOn: { $lt: targetDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdOn" },
            month: { $month: "$createdOn" },
            day: { $dayOfMonth: "$createdOn" },
            hour: { $hour: "$createdOn" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
          "_id.day": 1,
          "_id.hour": 1,
        },
      },
    ])
    .toArray();

  return results.map((r) => ({
    year: r._id.year,
    month: r._id.month,
    day: r._id.day,
    hour: r._id.hour,
    count: r.count,
    bucketStartDate: new Date(Date.UTC(r._id.year, r._id.month - 1, r._id.day, r._id.hour)),
  }));
}

/**
 * Finds the exact timestamp of the Nth document (e.g., 1000th) 
 * so you know the exact cutoff date to process exactly N files.
 */
export async function getCutoffDateForLimit(
  maxDocuments: number,
  status: string = env.TARGET_STATUS
): Promise<Date | null> {
  const collection = await getStorageDeckCollection();

  const targetDoc = await collection
    .find({ _class: "StorageDeck", status })
    .sort({ createdOn: 1 }) // Oldest first
    .skip(maxDocuments - 1)  // Jump straight to the Nth document
    .limit(1)
    .project({ createdOn: 1 })
    .next();

  return targetDoc ? targetDoc.createdOn : null;
}

/**
 * Fetches up to `limit` oldest documents ready for batch deletion.
 */
export async function getBatchForDeletion(
  limit: number,
  status: string = env.TARGET_STATUS,
  beforeDate?: Date
): Promise<StorageDeckDocument[]> {
  const collection = await getStorageDeckCollection();

  const query: Record<string, any> = {
    _class: "StorageDeck",
    status,
  };

  if (beforeDate) {
    query.createdOn = { $lte: beforeDate };
  }

  const documents = await collection
    .find(query)
    .sort({ createdOn: 1 }) // Oldest first (FIFO)
    .limit(limit)
    .project({ _id: 1, createdOn: 1, status: 1 })
    .toArray();

  return documents as unknown as StorageDeckDocument[];
}

/**
 * Helper to retrieve the next FIFO batch starting AFTER a specific date/ID
 * up to the global target Cutoff Date. Includes tie-breaker logic on `_id`.
 */
export async function getNextBatchAfterDate(
  limit: number,
  status: string,
  targetCutoffDate: Date,
  lastDoc?: StorageDeckDocument
): Promise<StorageDeckDocument[]> {
  const collection = await getStorageDeckCollection();

  const query: Record<string, any> = {
    _class: "StorageDeck",
    status,
    createdOn: { $lt: targetCutoffDate },
  };

  // Tie-breaker filtering using both createdOn AND _id
  if (lastDoc) {
    query.$or = [
      { createdOn: { $gt: new Date(lastDoc.createdOn) } },
      { 
        createdOn: new Date(lastDoc.createdOn), 
        _id: { $gt: lastDoc._id } 
      },
    ];
  }

  const documents = await collection
    .find(query)
    .sort({ createdOn: 1, _id: 1 }) // Deterministic sort with tie-breaker
    .limit(limit)
    .project({ _id: 1, createdOn: 1, status: 1 })
    .toArray();

  return documents as unknown as StorageDeckDocument[];
}



/**
 * Helper to retrieve the next FIFO batch for non-STORED records 
 * up to the global target Cutoff Date. Includes tie-breaker logic on `_id`.
 */
export async function getNextBatchForNonStored(
  limit: number,
  targetCutoffDate: Date,
  lastDoc?: StorageDeckDocument
): Promise<StorageDeckDocument[]> {
  const collection = await getStorageDeckCollection();

  // Targets both FOR_VALIDATION and DELETE_ERROR (or anything not STORED)
  const query: Record<string, any> = {
    _class: "StorageDeck",
    status: { $ne: "STORED" }, // OR explicitly: status: { $in: ["FOR_VALIDATION", "DELETE_ERROR"] }
    createdOn: { $lt: targetCutoffDate },
  };

  // Tie-breaker filtering using both createdOn AND _id
  if (lastDoc) {
    query.$or = [
      { createdOn: { $gt: new Date(lastDoc.createdOn) } },
      { 
        createdOn: new Date(lastDoc.createdOn), 
        _id: { $gt: lastDoc._id } 
      },
    ];
  }

  return collection
    .find(query)
    .sort({ createdOn: 1, _id: 1 })
    .limit(limit)
    .project({ _id: 1, createdOn: 1, status: 1 })
    .toArray() as unknown as StorageDeckDocument[];
}

/**
 * Retrieves documents matching source SF_ONBOARDING with specified status.
 * Error messages filter is optional - returns all documents with the status.
 */
export async function getStorageDeckErrorDocuments(
  status: string = "STORED",
  requireErrorMessages: boolean = false
): Promise<StorageDeckFileDetail[]> {
  const collection = await getStorageDeckCollection();

  const query: Record<string, any> = {
    _class: "StorageDeck",
    source: "SF_ONBOARDING",
    status: status,
  };

  // Only add errorMessages filter if required
  if (requireErrorMessages) {
    query.errorMessages = { $exists: true, $ne: null };
  }

  const documents = await collection
    .find<StorageDeckFileDetail>(
      query,
      {
        projection: {
          _id: 0,
          name: 1,
          recipientName: 1,
          status: 1,
          "errorMessages.message": 1,
          createdOn: 1,
          s3Key: 1,
          s3Bucket: 1,
        },
      }
    )
    .toArray();

  return documents;
}



// ============================================================================
// BATCH STORE REPOSITORY FUNCTIONS
// ============================================================================

/**
 * Valid statuses for batch store operations.
 */
export const BATCH_STORE_STATUSES = ["ERROR", "STORE_ERROR", "FOR_VALIDATION"] as const;
export type BatchStoreStatus = (typeof BATCH_STORE_STATUSES)[number];

/**
 * Counts all StorageDeck documents eligible for batch store (error statuses with errorMessages).
 */
export async function countDocumentsForBatchStore(
  targetCutoffDate: Date,
  statuses: readonly string[] = BATCH_STORE_STATUSES
): Promise<number> {
  const collection = await getStorageDeckCollection();

  return collection.countDocuments({
    _class: "StorageDeck",
    source: "SF_ONBOARDING",
    status: { $in: statuses },
    errorMessages: { $exists: true, $ne: null },
    createdOn: { $lt: targetCutoffDate },
  });
}

/**
 * Counts documents that are missing required fields (recipient, folder, or category).
 * Returns 0 if all error documents have the required fields and are ready for batch store.
 */
export async function countDocumentsMissingRequiredFields(
  statuses: readonly string[] = BATCH_STORE_STATUSES
): Promise<number> {
  const collection = await getStorageDeckCollection();

  return collection.countDocuments({
    _class: "StorageDeck",
    source: "SF_ONBOARDING",
    status: { $in: statuses },
    errorMessages: { $exists: true, $ne: null },
    $or: [
      { recipient: { $in: [null, ""] } },
      { folder: { $in: [null, ""] } },
      { category: { $in: [null, ""] } },
    ],
  });
}

/**
 * Retrieves documents missing required fields for inspection.
 */
export async function getDocumentsMissingRequiredFields(
  limit: number = 100,
  statuses: readonly string[] = BATCH_STORE_STATUSES
): Promise<StorageDeckFileDetail[]> {
  const collection = await getStorageDeckCollection();

  const documents = await collection
    .find(
      {
        _class: "StorageDeck",
        source: "SF_ONBOARDING",
        status: { $in: statuses },
        errorMessages: { $exists: true, $ne: null },
        $or: [
          { recipient: { $in: [null, ""] } },
          { folder: { $in: [null, ""] } },
          { category: { $in: [null, ""] } },
        ],
      },
      {
        projection: {
          _id: 0,
          name: 1,
          recipientName: 1,
          status: 1,
          recipient: 1,
          folder: 1,
          category: 1,
          "errorMessages.message": 1,
          createdOn: 1,
        },
      }
    )
    .limit(limit)
    .toArray();

  return documents as unknown as StorageDeckFileDetail[];
}

/**
 * Retrieves the next FIFO batch of error documents for batch store planning.
 * Includes tie-breaker logic on `_id` for deterministic ordering.
 */
export async function getNextBatchForStore(
  limit: number,
  targetCutoffDate: Date,
  statuses: readonly string[] = BATCH_STORE_STATUSES,
  lastDoc?: StorageDeckDocument
): Promise<StorageDeckDocument[]> {
  const collection = await getStorageDeckCollection();

  const query: Record<string, any> = {
    _class: "StorageDeck",
    source: "SF_ONBOARDING",
    status: { $in: statuses },
    errorMessages: { $exists: true, $ne: null },
    createdOn: { $lt: targetCutoffDate },
  };

  // Tie-breaker filtering using both createdOn AND _id
  if (lastDoc) {
    query.$or = [
      { createdOn: { $gt: new Date(lastDoc.createdOn) } },
      {
        createdOn: new Date(lastDoc.createdOn),
        _id: { $gt: lastDoc._id },
      },
    ];
  }

  const documents = await collection
    .find(query)
    .sort({ createdOn: 1, _id: 1 }) // Deterministic sort with tie-breaker
    .limit(limit)
    .project({ _id: 1, createdOn: 1, status: 1 })
    .toArray();

  return documents as unknown as StorageDeckDocument[];
}

/**
 * Finds the exact timestamp of the Nth document for batch store cutoff.
 */
export async function getCutoffDateForBatchStore(
  maxDocuments: number,
  statuses: readonly string[] = BATCH_STORE_STATUSES
): Promise<Date | null> {
  const collection = await getStorageDeckCollection();

  const targetDoc = await collection
    .find({
      _class: "StorageDeck",
      source: "SF_ONBOARDING",
      status: { $in: statuses },
      errorMessages: { $exists: true, $ne: null },
    })
    .sort({ createdOn: 1 })
    .skip(maxDocuments - 1)
    .limit(1)
    .project({ createdOn: 1 })
    .next();

  return targetDoc ? targetDoc.createdOn : null;
}
