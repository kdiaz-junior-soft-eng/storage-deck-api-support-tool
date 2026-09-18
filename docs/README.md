# StorageDeckAPI Documentation

This documentation covers all features available in the StorageDeckAPI project.

## 📁 Documentation Structure

```
docs/
├── README.md                    # This file - documentation index
├── batch-delete/
│   └── README.md               # Batch deletion planning & execution
├── batch-store/
│   └── README.md               # Batch store planning & validation
├── csv-export/
│   └── README.md               # CSV export for stored documents with errors
├── s3-verification/
│   └── README.md               # S3 file existence verification
└── jwt/
    └── README.md               # JWT generation & decoding
```

## 🚀 Quick Start

### Prerequisites

1. Copy `.env.example` to `.env` and configure:
   ```bash
   cp .env.example .env
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run test:batch-loop` | Generate batch delete plan for STORED documents |
| `npm run test:batch-loop-non-stored` | Generate batch delete plan for non-STORED documents |
| `npm run test:batch-store-validate` | Validate documents before batch store |
| `npm run test:batch-store-plan` | Generate batch store plan for error documents |
| `npm run test:export-errors` | Export stored documents with errors to CSV |
| `npm run test:export-sql-filenames` | Export filenames for SQL queries |
| `npm run test:verify-s3` | Verify files exist in S3 |
| `npm run test:jwt` | Generate JWT token |
| `npm run test:decode` | Decode JWT token |

## 📊 Feature Overview

### 1. [Batch Delete](./batch-delete/README.md)
Plan and execute batch deletions of StorageDeck documents by generating date-filtered batches.

### 2. [Batch Store](./batch-store/README.md)
Plan batch store operations for error documents (ERROR, STORE_ERROR, FOR_VALIDATION) with pre-flight validation.

### 3. [CSV Export](./csv-export/README.md)
Export documents with errors to CSV format with interactive status selection (STORED, STORE_ERROR, ERROR, FOR_VALIDATION). Includes error message summary with date ranges.

### 4. [S3 Verification](./s3-verification/README.md)
Verify that files referenced in MongoDB actually exist in S3 storage.

### 5. [JWT Management](./jwt/README.md)
Generate and decode JWT tokens for API authentication.

## 🔧 Environment Configuration

See `.env.example` for all available configuration options.

### Required Variables
- `MONGODB_URI` - MongoDB connection string
- `MONGODB_DATABASE` - Database name
- `BATCH_DELETE_API_URL` - Batch delete API endpoint
- `TARGET_STATUS` - Target document status for operations
- `TARGET_DATE` - Cutoff date for batch operations

### Optional Variables
- `AWS_*` - AWS credentials for S3 verification
- `JWT_*` - JWT token configuration
