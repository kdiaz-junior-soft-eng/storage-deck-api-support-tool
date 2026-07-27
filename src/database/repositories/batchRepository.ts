// src/database/repositories/batchRepository.ts
import { Collection } from "mongodb";
import { connectMongoDB } from "./mongodb";

export interface ProcessingBatchInfo {
  batchSrn: string;
  status: string;
  batchType: string;
  totalRecordCount: number;
  doneRunningCount: number;
  errorRunningCount: number;
  executedOn: Date;
}

export interface BatchTypeSummary {
  status: string;
  batchType: string;
  totalBatches: number;
  totalRecords: number;
  totalCompletedRecords: number;
  totalErrorRecords: number;
  latestExecution: Date;
  earliestExecution: Date;
}

async function getBatchCollection(): Promise<Collection<ProcessingBatchInfo>> {
  const db = await connectMongoDB();
  return db.collection<ProcessingBatchInfo>("batch_collection");
}

/**
 * Checks batch_collection for any batch jobs that are currently 'PROCESSING'.
 */
export async function getActiveProcessingBatches(): Promise<ProcessingBatchInfo[]> {
  const collection = await getBatchCollection();

  return await collection
    .find({
      _class: "Batch",
      batchType: "DELETE",
      status: "PROCESSING",
    })
    .sort({ executedOn: -1 })
    .toArray();
}


/**
 * Aggregates batch job metrics grouped by status and type.
 */
export async function getBatchStatusSummary(): Promise<BatchTypeSummary[]> {
  const collection = await getBatchCollection();

  return collection.aggregate<BatchTypeSummary>([
    {
      $match: {
        _class: "Batch",
        status: { $in: ["PROCESSING", "ERROR", "DONE"] }
      }
    },
    {
      $group: {
        _id: {
          status: "$status",
          batchType: "$batchType"
        },
        totalBatches: { $sum: 1 },
        totalRecords: { $sum: "$totalRecordCount" },
        totalCompletedRecords: { $sum: "$doneRunningCount" },
        totalErrorRecords: { $sum: "$errorRunningCount" },
        latestExecution: { $max: "$executedOn" },
        earliestExecution: { $min: "$executedOn" }
      }
    },
    {
      $project: {
        _id: 0,
        status: "$_id.status",
        batchType: "$_id.batchType",
        totalBatches: 1,
        totalRecords: 1,
        totalCompletedRecords: 1,
        totalErrorRecords: 1,
        latestExecution: 1,
        earliestExecution: 1
      }
    },
    { $sort: { latestExecution: -1 } }
  ]).toArray();
}