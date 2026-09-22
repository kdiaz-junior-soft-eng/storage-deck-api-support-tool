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
 * Retrieves documents matching specified source and status.
 * Error messages filter is optional - returns all documents with the status.
 * Special status "NOT_STORED" matches all statuses except "STORED".
 * Source filter is optional - pass undefined or "ALL" to include all sources.
 */
export async function getStorageDeckErrorDocuments(
  status: string = "STORED",
  source?: string,
  requireErrorMessages: boolean = false
): Promise<StorageDeckFileDetail[]> {
  const collection = await getStorageDeckCollection();

  const query: Record<string, any> = {
    _class: "StorageDeck",
    status: buildStatusFilter(status),
  };

  // Only add source filter if specified and not "ALL"
  if (source && source !== "ALL") {
    query.source = source;
  }

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
 * Common source options for batch operations.
 */
export const SOURCE_OPTIONS = ["SF_ONBOARDING", "SF_OFFBOARDING", "SF_REHIRE"] as const;
export type SourceOption = (typeof SOURCE_OPTIONS)[number];

/**
 * Fetches all distinct source values from the database for StorageDeck documents.
 */
export async function getDistinctSources(): Promise<string[]> {
  const collection = await getStorageDeckCollection();

  const sources = await collection.distinct("source", {
    _class: "StorageDeck",
  });

  return sources.filter((s): s is string => typeof s === "string" && s !== null && s !== "");
}

/**
 * Fetches all distinct status values with counts from the database for StorageDeck documents.
 */
export async function getDistinctStatusesWithCounts(): Promise<Array<{ status: string; count: number }>> {
  const collection = await getStorageDeckCollection();

  const results = await collection
    .aggregate<{ _id: string; count: number }>([
      { $match: { _class: "StorageDeck" } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray();

  return results
    .filter((r) => r._id !== null && r._id !== "")
    .map((r) => ({ status: r._id, count: r.count }));
}

/**
 * Checks if a status should include errorMessages filter.
 */
function shouldFilterByErrorMessages(status: string): boolean {
  return status.includes("ERROR");
}

/**
 * Builds the status filter for MongoDB queries.
 * Handles the special "NOT_STORED" case which means all processable statuses.
 * Excludes: STORED and any status containing "PROCESSING" (locked by other operations)
 * 
 * Returns an object that should be used as the `status` field value in MongoDB queries.
 * For NOT_STORED, returns a $nor filter that excludes both STORED and *PROCESSING* statuses.
 */
function buildStatusFilter(status: string): string | Record<string, any> {
  if (status === "NOT_STORED") {
    // Use $and to combine: not equal to STORED AND does not contain PROCESSING
    return { 
      $not: { $regex: /^STORED$|PROCESSING/ }
    };
  }
  return status;
}

/**
 * Counts all StorageDeck documents eligible for batch store.
 * Only includes errorMessages filter if status contains "ERROR".
 * Source filter is optional - pass undefined or "ALL" to include all sources.
 * Special status "NOT_STORED" matches all statuses except "STORED".
 */
export async function countDocumentsForBatchStore(
  targetCutoffDate: Date,
  status: string,
  source?: string
): Promise<number> {
  const collection = await getStorageDeckCollection();

  const query: Record<string, any> = {
    _class: "StorageDeck",
    status: buildStatusFilter(status),
    createdOn: { $lt: targetCutoffDate },
  };

  if (source && source !== "ALL") {
    query.source = source;
  }

  if (shouldFilterByErrorMessages(status)) {
    query.errorMessages = { $exists: true, $ne: null };
  }

  return collection.countDocuments(query);
}

/**
 * Counts documents that are missing required fields (recipient, folder, or category).
 * Returns 0 if all documents have the required fields and are ready for batch store.
 * Special status "NOT_STORED" matches all statuses except "STORED".
 */
export async function countDocumentsMissingRequiredFields(
  status: string,
  source?: string
): Promise<number> {
  const collection = await getStorageDeckCollection();

  const query: Record<string, any> = {
    _class: "StorageDeck",
    status: buildStatusFilter(status),
    $or: [
      { recipient: { $in: [null, ""] } },
      { folder: { $in: [null, ""] } },
      { category: { $in: [null, ""] } },
    ],
  };

  if (source && source !== "ALL") {
    query.source = source;
  }

  if (shouldFilterByErrorMessages(status)) {
    query.errorMessages = { $exists: true, $ne: null };
  }

  return collection.countDocuments(query);
}

/**
 * Retrieves documents missing required fields for inspection.
 * Special status "NOT_STORED" matches all statuses except "STORED".
 */
export async function getDocumentsMissingRequiredFields(
  limit: number = 100,
  status: string,
  source?: string
): Promise<StorageDeckFileDetail[]> {
  const collection = await getStorageDeckCollection();

  const query: Record<string, any> = {
    _class: "StorageDeck",
    status: buildStatusFilter(status),
    $or: [
      { recipient: { $in: [null, ""] } },
      { folder: { $in: [null, ""] } },
      { category: { $in: [null, ""] } },
    ],
  };

  if (source && source !== "ALL") {
    query.source = source;
  }

  if (shouldFilterByErrorMessages(status)) {
    query.errorMessages = { $exists: true, $ne: null };
  }

  const documents = await collection
    .find(query, {
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
    })
    .limit(limit)
    .toArray();

  return documents as unknown as StorageDeckFileDetail[];
}

/**
 * Retrieves the next FIFO batch of documents for batch store planning.
 * Includes tie-breaker logic on `_id` for deterministic ordering.
 * Only includes errorMessages filter if status contains "ERROR".
 * Special status "NOT_STORED" matches all statuses except "STORED".
 */
export async function getNextBatchForStore(
  limit: number,
  targetCutoffDate: Date,
  status: string,
  source?: string,
  lastDoc?: StorageDeckDocument
): Promise<StorageDeckDocument[]> {
  const collection = await getStorageDeckCollection();

  const query: Record<string, any> = {
    _class: "StorageDeck",
    status: buildStatusFilter(status),
    createdOn: { $lt: targetCutoffDate },
  };

  if (source && source !== "ALL") {
    query.source = source;
  }

  if (shouldFilterByErrorMessages(status)) {
    query.errorMessages = { $exists: true, $ne: null };
  }

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
 * Special status "NOT_STORED" matches all statuses except "STORED".
 */
export async function getCutoffDateForBatchStore(
  maxDocuments: number,
  status: string,
  source?: string
): Promise<Date | null> {
  const collection = await getStorageDeckCollection();

  const query: Record<string, any> = {
    _class: "StorageDeck",
    status: buildStatusFilter(status),
  };

  if (source && source !== "ALL") {
    query.source = source;
  }

  if (shouldFilterByErrorMessages(status)) {
    query.errorMessages = { $exists: true, $ne: null };
  }

  const targetDoc = await collection
    .find(query)
    .sort({ createdOn: 1 })
    .skip(maxDocuments - 1)
    .limit(1)
    .project({ createdOn: 1 })
    .next();

  return targetDoc ? targetDoc.createdOn : null;
}
