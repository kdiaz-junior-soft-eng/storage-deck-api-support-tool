// StorageDeckAPI/src/services/batchService.ts
import { 
  getActiveProcessingBatches, 
  getBatchStatusSummary, 
  BatchTypeSummary, 
  ProcessingBatchInfo 
} from "../database";

export interface BatchAuditResult {
  isSafeToRun: boolean;
  activeBatchesCount: number;
  summaries: BatchTypeSummary[];
  activeBatches: ProcessingBatchInfo[];
}

/**
 * Performs a comprehensive audit on active batch jobs and overall execution status.
 */
export async function auditBatchStatus(): Promise<BatchAuditResult> {
  const [summaries, activeBatches] = await Promise.all([
    getBatchStatusSummary(),
    getActiveProcessingBatches(),
  ]);

  return {
    isSafeToRun: activeBatches.length === 0,
    activeBatchesCount: activeBatches.length,
    summaries,
    activeBatches,
  };
}