// StorageDeckAPI/src/services/batchPlannerService.ts
import { env } from "../config/env";
import { 
  countDocumentsBeforeDate, 
  getNextBatchAfterDate, 
  StorageDeckDocument 
} from "../database/repositories/storageDeckRepository";

export interface BatchPlanWindow {
  batchNumber: number;
  count: number;
  windowStart: Date;
  windowEnd: Date;
  dateFilter: string; // ISO string with +1ms adjustment for $lt
  lastDoc: StorageDeckDocument;
}

export interface BatchPlanSummary {
  totalInScope: number;
  totalBatches: number;
  totalMapped: number;
  batches: BatchPlanWindow[];
}

export async function generateBatchDeletePlan(
  batchSize: number = 1000,
  status: string = env.TARGET_STATUS,
  targetCutoffDate: Date = env.TARGET_DATE
): Promise<BatchPlanSummary> {
  const totalInScope = await countDocumentsBeforeDate(targetCutoffDate, status);

  if (totalInScope === 0) {
    return {
      totalInScope: 0,
      totalBatches: 0,
      totalMapped: 0,
      batches: []
    };
  }

  const batches: BatchPlanWindow[] = [];
  let processedCount = 0;
  let batchNumber = 1;
  let lastDoc: StorageDeckDocument | undefined = undefined;

  while (processedCount < totalInScope) {
    const batch: StorageDeckDocument[] = await getNextBatchAfterDate(
      batchSize,
      status,
      targetCutoffDate,
      lastDoc
    );

    if (batch.length === 0) break;

    const windowStart = new Date(batch[0].createdOn);
    const windowEnd = new Date(batch[batch.length - 1].createdOn);
    
    // Add +1ms for $lt filter boundary
    const dateFilter = new Date(windowEnd.getTime() + 1).toISOString();
    const currentLastDoc = batch[batch.length - 1];

    batches.push({
      batchNumber,
      count: batch.length,
      windowStart,
      windowEnd,
      dateFilter,
      lastDoc: currentLastDoc
    });

    lastDoc = currentLastDoc;
    processedCount += batch.length;
    batchNumber++;
  }

  return {
    totalInScope,
    totalBatches: batches.length,
    totalMapped: processedCount,
    batches
  };
}