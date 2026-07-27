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

