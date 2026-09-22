# CSV Export

Export documents to CSV format for analysis and SQL queries.

## Overview

This feature extracts documents from MongoDB based on selected status and source, exporting them to CSV files for further analysis or use in SQL queries.

## Commands

```bash
# Export full details (filename, recipient, errorMessage, createdOn, s3Key, s3Bucket)
npm run test:export-errors

# Export only filenames (quoted, without extension) for SQL queries
npm run test:export-sql-filenames
```

## Interactive CLI

Both commands feature an interactive CLI that lets you select:

1. **Status** - Dynamically fetched from the database with document counts:
   - **All Processable** - All statuses except `STORED` and any `*PROCESSING*` statuses
   - Individual statuses with their counts (e.g., `STORE_ERROR (1,234 docs)`)
   - 🔒 Locked statuses are marked but still selectable

2. **Source** - Dynamically fetched from the database:
   - **All Sources** - Include all sources (no source filter)
   - Or select a specific source (e.g., `SF_ONBOARDING`, `SF_OFFBOARDING`)

### CLI Example

```
🚀 CSV Export for Documents with Errors...

📡 Fetching available sources from database...
   Found 3 source(s): SF_ONBOARDING, SF_OFFBOARDING, SF_REHIRE
📡 Fetching available statuses from database...
   Found 3 status(es):
   🔒 STORED: 195
      FOR_VALIDATION: 25
      STORE_ERROR: 2

? Select document status to export:
❯ All Processable (27 docs)
  STORED (195 docs)
  FOR_VALIDATION (25 docs)
  STORE_ERROR (2 docs)

? Select document source:
❯ All Sources
  SF_ONBOARDING
  SF_OFFBOARDING
  SF_REHIRE
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
"SeibeDan_I9_SECTION1_2025_V1_signed_20260106025633.pdf","Daniel Seibel","Connection has been closed BEFORE response","2026-08-05T20:35:44.458Z","nucor_prd_paDRed/...","381492120424-ore-sto-shr-prd-s3-stodeck"
```

Documents without error messages will show: `"No error message recorded"`

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

Exports target documents based on your selections:

```javascript
// When "All Processable" status is selected with "All Sources"
{
  _class: "StorageDeck",
  status: { $not: /^STORED$|PROCESSING/ }  // Excludes STORED and *PROCESSING*
}

// When specific status with specific source
{
  _class: "StorageDeck",
  source: "SF_ONBOARDING",
  status: "STORE_ERROR"
}
```

## Output Example

```
🚀 CSV Export for Documents with Errors...

📡 Fetching available sources from database...
   Found 3 source(s): SF_ONBOARDING, SF_OFFBOARDING, SF_REHIRE
📡 Fetching available statuses from database...
   Found 3 status(es):
   🔒 STORED: 195
      FOR_VALIDATION: 25
      STORE_ERROR: 2

? Select document status to export: STORE_ERROR (2 docs)
? Select document source: All Sources

📋 Query Criteria:
   - _class: StorageDeck
   - source: (all sources)
   - status: STORE_ERROR

📁 Output Directory: /path/to/exports
⏱️  Export Duration: 1.23s

---------------------------------------------------
📊 EXPORT SUMMARY
---------------------------------------------------
Status Exported        : STORE_ERROR
Source Exported        : (all sources)
Total Records Exported : 2
Output File Path       : /path/to/exports/stored_with_errors_2026-09-18T11-52-48-670Z.csv

---------------------------------------------------
📈 ERROR MESSAGE SUMMARY
---------------------------------------------------
Unique Error Types : 1
Overall Date Range : 2026-09-17 ➔ 2026-09-17

[1] 2 files (100.0%)
    Error : "Connection has been closed BEFORE response, while sending request body"
    Period: 2026-09-17

---------------------------------------------------
📄 Sample Data (First 5 Records):
---------------------------------------------------

[1] PriceKay_US_NC_4_2025_V1_signed_20260908173916.pdf
    Recipient    : Kayla Price
    Status       : STORE_ERROR
    Error Message: Connection has been closed BEFORE response, while sending request body
    Created On   : 2026-09-17T04:37:44.609Z

✅ CSV export completed successfully!
```

## Related Files

- `src/services/storageDeckService.ts` - `exportStoredDocumentsWithErrorsToCsv()`, `exportFilenamesForSqlQuery()`
- `src/database/repositories/storageDeckRepository.ts` - `getStorageDeckErrorDocuments()`, `getDistinctSources()`, `getDistinctStatusesWithCounts()`
- `test/exportStoredWithErrorsTest.ts` - Full CSV export script with CLI
- `test/exportFilenamesForSqlTest.ts` - SQL filenames export script with CLI
