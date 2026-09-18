# CSV Export

Export stored documents with errors to CSV format for analysis and SQL queries.

## Overview

This feature extracts documents from MongoDB that are marked as STORED but contain error messages, exporting them to CSV files for further analysis or use in SQL queries.

## Commands

```bash
# Export full details (filename, recipient, errorMessage, createdOn, s3Key, s3Bucket)
npm run test:export-errors

# Export only filenames (quoted, without extension) for SQL queries
npm run test:export-sql-filenames
```

## Output Location

All exports are saved to: `exports/`

Files are timestamped to avoid overwriting:
- `stored_with_errors_2026-09-18T09-33-09-571Z.csv`
- `filenames_for_sql_2026-09-18T08-57-42-478Z.txt`

## Export Formats

### Full Details CSV (`test:export-errors`)

```csv
filename,recipient,errorMessage,createdOn,s3Key,s3Bucket
"SeibeDan_I9_SECTION1_2025_V1_signed_20260106025633.pdf","Daniel Seibel","","2026-08-05T20:35:44.458Z","nucor_prd_paDRed/prd_nucor_prd/40e7870c-b0ee-413c-a46d-0de51cc62510","381492120424-ore-sto-shr-prd-s3-stodeck"
```

### SQL Filenames (`test:export-sql-filenames`)

```txt
"SeibeDan_I9_SECTION1_2025_V1_signed_20260106025633"
"AnotherFile_2026_V2_signed_20260825103045"
```

Note: File extensions are removed for use in SQL LIKE queries.

## SQL Query Usage

Use the exported filenames in SQL queries like:

```sql
SELECT *
FROM storage_file sf
WHERE sf.recordStatus = "ACTIVE" AND sf.ID IN (
  SELECT storageFileNameId 
  FROM storage_file_text 
  WHERE description LIKE "SeibeDan_I9_SECTION1_2025_V1_signed_20260106025633"
);
```

## MongoDB Query

Exports target documents matching:

```javascript
{
  _class: "StorageDeck",
  source: "SF_ONBOARDING",
  status: "STORED",
  errorMessages: { $exists: true, $ne: null }
}
```

## Output Example

```
🚀 Testing CSV Export for Stored Documents with Errors...

📋 Query Criteria:
   - _class: StorageDeck
   - source: SF_ONBOARDING
   - status: STORED
   - errorMessages: exists and not null

📁 Output Directory: /path/to/exports
⏱️  Export Duration: 1.23s

---------------------------------------------------
📊 EXPORT SUMMARY
---------------------------------------------------
Total Records Exported : 1,145
Output File Path       : /path/to/exports/stored_with_errors_2026-09-18T09-33-09-571Z.csv

📄 Sample Data (First 5 Records):
---------------------------------------------------

[1] SeibeDan_I9_SECTION1_2025_V1_signed_20260106025633.pdf
    Recipient    : Daniel Seibel
    Status       : STORED
    Error Message: (none)
    Created On   : 2026-08-05T20:35:44.458Z

... and 1140 more records

✅ CSV export completed successfully!
```

## Related Files

- `src/services/storageDeckService.ts` - `exportStoredDocumentsWithErrorsToCsv()`, `exportFilenamesForSqlQuery()`
- `src/database/repositories/storageDeckRepository.ts` - `getStorageDeckErrorDocuments()`
- `test/exportStoredWithErrorsTest.ts` - Full CSV export script
- `test/exportFilenamesForSqlTest.ts` - SQL filenames export script
