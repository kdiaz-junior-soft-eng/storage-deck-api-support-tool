# S3 Verification

Verify that files referenced in MongoDB actually exist in S3 storage.

## Overview

This feature checks if files stored in MongoDB (with `s3Key` and `s3Bucket` fields) actually exist in AWS S3. It uses the `HeadObject` API call which only checks file existence without downloading the file content.

## Command

```bash
npm run test:verify-s3
```

## Prerequisites

### AWS Credentials

Add these to your `.env` file:

```env
AWS_ACCESS_KEY_ID=ASIAV...
AWS_SECRET_ACCESS_KEY=ZxNK9...
AWS_SESSION_TOKEN=IQoJb3...  # Required for temporary credentials
AWS_REGION=us-west-2         # Must match the S3 bucket's region!
```

### IAM Permissions

Your AWS credentials need at minimum:

```json
{
  "Effect": "Allow",
  "Action": ["s3:HeadObject"],
  "Resource": "arn:aws:s3:::your-bucket-name/*"
}
```

## How It Works

1. **Fetch Documents** - Gets all stored documents with errors from MongoDB
2. **Filter S3 Info** - Filters to documents that have `s3Bucket` and `s3Key` fields
3. **Check S3** - Uses `HeadObject` to verify each file exists (read-only, no download)
4. **Report Results** - Shows summary and exports missing files to CSV

## Configuration

```env
# AWS Configuration
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_SESSION_TOKEN=your-session-token  # For temporary credentials
AWS_REGION=us-west-2                  # IMPORTANT: Must match bucket region!
```

### Region Mismatch Error

If you see `HTTP 301` errors, your `AWS_REGION` doesn't match the bucket's region. Update it to the correct region.

## Concurrency

The verification runs multiple S3 checks in parallel (default: 20) for faster processing:

```typescript
await verifyStoredDocumentsInS3(20); // 20 parallel requests
```

Adjust this based on your needs:
- Higher = faster but more resource usage
- Lower = slower but gentler on network/API

## Output Example

```
🔄 Starting S3 File Verification for Stored Documents with Errors...

📋 Target documents:
   - _class: StorageDeck
   - source: SF_ONBOARDING
   - status: STORED
   - errorMessages: exists and not null

⚙️  Concurrency: 20 parallel requests

✅ S3 verification complete!

------------------------------------------------------------------------------------------------------------------
📊 S3 VERIFICATION SUMMARY
------------------------------------------------------------------------------------------------------------------
Total Documents in MongoDB    : 1,145
Documents with S3 Info        : 1,145
Documents without S3 Info     : 0

Files Found in S3             : 1,145
Files Missing in S3           : 0
Files with Check Errors       : 0
Execution Duration            : 45.32s

------------------------------------------------------------------------------------------------------------------
✅ SUCCESS: All files exist in S3!
------------------------------------------------------------------------------------------------------------------
```

### When Files Are Missing

```
------------------------------------------------------------------------------------------------------------------
❌ FILES MISSING IN S3
------------------------------------------------------------------------------------------------------------------

[1] SeibeDan_I9_SECTION1_2025_V1_signed_20260106025633.pdf
    Bucket: 381492120424-ore-sto-shr-prd-s3-stodeck
    Key   : nucor_prd_paDRed/prd_nucor_prd/40e7870c-b0ee-413c-a46d-0de51cc62510

📁 Missing files exported to: exports/missing_in_s3_2026-09-18T10-15-30-000Z.csv
```

## Error Types

| Error | Meaning | Solution |
|-------|---------|----------|
| `HTTP 301` | Wrong AWS region | Update `AWS_REGION` in `.env` |
| `HTTP 403: AccessDenied` | No permission | Check IAM policy |
| `HTTP 400: ExpiredToken` | Credentials expired | Refresh AWS credentials |
| `NotFound` | File doesn't exist | File is genuinely missing |

## Related Files

- `src/services/s3Service.ts` - `checkFileExistsInS3()`, `checkFilesExistInS3()`
- `src/services/storageDeckService.ts` - `verifyStoredDocumentsInS3()`
- `test/verifyS3FilesTest.ts` - Verification test script
