# 🚀 StorageDeckAPI

**StorageDeckAPI** is a high-performance Node.js/TypeScript service designed to safely perform deterministic, batch-driven data operations on MongoDB collections (`storage_deck_document`).

It uses **Keyset (Cursor) Pagination** with a combined compound index (`{ createdOn: 1, _id: 1 }`) to process thousands of records efficiently while safely handling live database insertions without memory overload, socket timeouts, or skipped records.

---

## 📚 Documentation

For detailed documentation on each feature, see the [docs](./docs/README.md) folder:

| Feature | Description | Command |
|---------|-------------|---------|
| [Batch Delete](./docs/batch-delete/README.md) | Plan batch deletions with date filters | `npm run test:batch-loop` |
| [Batch Store](./docs/batch-store/README.md) | Plan batch store for error documents | `npm run test:batch-store-plan` |
| [CSV Export](./docs/csv-export/README.md) | Export stored documents with errors | `npm run test:export-errors` |
| [S3 Verification](./docs/s3-verification/README.md) | Verify files exist in S3 | `npm run test:verify-s3` |
| [JWT Management](./docs/jwt/README.md) | Generate and decode JWT tokens | `npm run test:jwt` |

---

# 🏗️ System Architecture

```text
StorageDeckAPI/
├── src/
│   ├── api/                           # API routes and controllers
│   ├── config/                        # Environment configuration & Zod schema validation
│   ├── database/                      # MongoDB connection & repositories
│   │   ├── mongodb.ts                 # Native MongoClient connection lifecycle
│   │   ├── repositories/
│   │   │   ├── batchRepository.ts
│   │   │   ├── storageDeckRepository.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   └── services/                      # Core business logic & batch planning engines
│       ├── batchService.ts
│       ├── fileGeneratorService.ts
│       ├── jwtService.ts
│       ├── storageDeckService.ts
│       └── index.ts
├── test/                              # Interactive CLI testing & batch mapping scripts
├── scripts/                           # Verification & operational utilities
└── temp_test_files/                   # Generated dummy files for local testing
```

---

# ⚙️ Environment Variables

The application is configured using environment variables. Configure the following values in your `.env` file before running any CLI utilities or services.

| Category | Variable | Required | Default / Format | Description |
|:---------|:---------|:--------:|:-----------------|:------------|
| **Infrastructure** | `MONGODB_URI` | ✅ Yes | `mongodb://...` | Connection URI string for the MongoDB instance. |
| | `MONGODB_DATABASE` | ✅ Yes | `String` | Target database containing the `storage_deck_document` collection. |
| **App Settings** | `BATCH_DELETE_API_URL` | ✅ Yes | `URL` | Target worker endpoint invoked for batch deletion execution. |
| | `MAX_DOCUMENTS_PER_BATCH` | ✅ Yes | `1000` | Maximum number of documents per batch to avoid payload and memory limits. |
| **Purge Target** | `TARGET_STATUS` | ✅ Yes | `String` | Specific record status to target (e.g. `PROCESSING`, `FOR_VALIDATION`). |
| | `TARGET_DATE` | ✅ Yes | `ISO-8601 UTC` | Snapshot cutoff date ceiling (e.g. `2026-07-08T00:00:00Z`). |
| **Execution** | `DRY_RUN` | ✅ Yes | `true` / `false` | When `true`, simulates planning and logs outputs without mutating data. |
| **JWT / Auth** | `JWT_SECRET` | ✅ Yes | `String` | Secret key used to sign Bearer tokens (retrieve from AWS Parameter Store). |
| | `JWT_SUB` | ✅ Yes | `String` | JWT Subject (user ID or service account identifier). |
| | `JWT_TENANT_UUID` | ✅ Yes | `UUID` | Tenant UUID claim used for internal authorization. |
| | `JWT_TENANT_ID` | ✅ Yes | `String` / `Number` | Internal numeric Tenant ID claim. |
| | `JWT_SN` | ✅ Yes | `String` | System name identifier claim. |
| | `JWT_USER_SRN` | ✅ Yes | `SRN` | Service Resource Name claim (e.g. `srn:null:strato:...`). |
| | `JWT_EXPIRES_IN` | ✅ Yes | `5m` | Token expiration duration (e.g. `5m`, `1h`). |

### Example `.env`

```env
# Infrastructure
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=omvqa

# Application
BATCH_DELETE_API_URL=https://your-api-url
MAX_DOCUMENTS_PER_BATCH=1000

# Purge Target
TARGET_STATUS=FOR_VALIDATION
TARGET_DATE=2026-07-08T00:00:00Z

# Execution
DRY_RUN=true

# JWT
JWT_SECRET=your-secret
JWT_SUB=admin
JWT_TENANT_UUID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
JWT_TENANT_ID=1
JWT_SN=strato
JWT_USER_SRN=srn:null:strato:tenant:user
JWT_EXPIRES_IN=5m
```

---

# ⚙️ NPM Scripts & CLI Commands

Run any of the available utilities using:

```bash
npm run <command>
```

| Script | Executes | Purpose |
|:------|:---------|:--------|
| **`npm run test:batch-loop-non-stored`** | `tsx test/runNonStoredBatchProcessorTest.ts` | **Global Purge Test:** Maps all non-`STORED` files into time-windowed batches using a frozen ceiling date. |
| **`npm run test:batch-loop`** | `tsx test/runBatchProcessorLoopTest.ts` | **Status Batch Test:** Maps single-status files (e.g. `FOR_VALIDATION`) into batch date filters. |
| **`npm run test:jwt`** | `tsx test/testGenerateJwt.ts` | Interactive CLI to preview JWT payload and generate signed Bearer tokens after user confirmation. |
| **`npm run test:decode`** | `tsx test/decodeJwtTest.ts` | Decodes and prints claims from an active JWT token. |
| **`npm run test:batch-filters`** | `tsx test/test1000DocBatchFilters.ts` | Tests exact document boundary calculations (e.g. finding the cutoff for **N** documents). |
| **`npm run test:active-batches`** | `tsx test/checkActiveProcessingBatchesTest.ts` | Checks current active batch locks stored in MongoDB. |
| **`npm run verify:count`** | `tsx scripts/countDocumentsBeforeDate.ts` | Performs a direct database check of document counts before a specified date threshold. |

---

# 🛠️ Core Services (`src/services/`)

## 1. `storageDeckService.ts` / `batchPlannerService.ts`

### Batch Planning Engines

- **`generateBatchDeletePlan()`**
  - Maps status-specific records into strict, time-windowed batches.

- **`generateFullNonStoredDeletePlan()`**
  - Generates a global purge plan targeting **all non-`STORED` documents** (e.g. `FOR_VALIDATION`, `DELETE_ERROR`) up to a frozen cutoff timestamp.

- **Deterministic Keyset Pagination**
  - Prevents offset shifts and infinite loops caused by ongoing live database writes.

---

## 2. `batchService.ts`

Coordinates batch windows and worker processing locks to ensure zero overlapping executions during high-volume batch runs.

---

## 3. `jwtService.ts`

Handles JWT Bearer token creation and validation using claims defined in environment variables such as:

- `JWT_SUB`
- `JWT_TENANT_ID`
- etc.

---

## 4. `fileGeneratorService.ts`

Seeds dummy files or mock test records into `temp_test_files/` for local sandbox testing.

---

# 🗄️ Database Repositories (`src/database/repositories/`)

## 1. `storageDeckRepository.ts`

Optimized access methods for the `storage_deck_document` collection.

### Available Methods

- **`countDocumentsBeforeDate()`**
  - Counts matching status records before a specified date ceiling.

- **`countNonStoredDocumentsBeforeDate()`**
  - Counts all records where `status !== "STORED"`.

- **`getNextBatchAfterDate()`**
  - Retrieves status-specific FIFO batches using composite key tie-breaker logic (`{ createdOn: 1, _id: 1 }`).

- **`getNextBatchForNonStored()`**
  - Fetches non-`STORED` records using composite key pagination.

- **`getChronologicalHourlyBuckets()`**
  - Groups records chronologically by hour for database throughput analysis.

---

## 2. `batchRepository.ts`

Tracks batch execution statuses, active locks, and completion states in MongoDB.

---

## 3. `mongodb.ts`

Manages native `MongoClient` connection pooling and database handles.

---

# 🔒 Security & System Guarantees

### 1. Snapshot Date Ceiling (`targetCutoffDate`)

All deletion planning functions freeze a cutoff timestamp (`new Date()`). Records inserted after the snapshot date are excluded, preventing live incoming uploads from being accidentally deleted.

---

### 2. Deterministic Sort Order

Compound sorting using:

```javascript
{ createdOn: 1, _id: 1 }
```

eliminates duplicate processing and skipped documents when multiple records share identical timestamps.

---

### 3. Completion-Driven Loops

Batch processing loops rely directly on MongoDB responses:

```typescript
if (!batch || batch.length === 0) {
    break;
}
```

This ensures reliable execution regardless of dynamic dataset changes.