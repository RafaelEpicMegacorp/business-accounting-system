# Wise Transaction Sync - Complete History with Income

## Product Requirements Document (PRD)

### Overview
Replace the existing Balance Statements API implementation with the Activities API to enable complete historical transaction sync without SCA requirements. The current implementation only shows 3 days of transactions (Oct 27-29, 2025) and incorrectly classifies ALL transactions as expenses. The new implementation will fetch 6+ months of history and correctly identify both income (CREDIT) and expense (DEBIT) transactions.

### User Stories
- As a user, I want to sync my complete Wise transaction history (6+ months) so that I can see all my financial data in one place
- As a user, I want income transactions to be correctly classified so that my financial reports are accurate
- As a user, I want expense transactions to be correctly classified so that I can track my spending accurately
- As a user, I want the sync to work without manual SCA approval so that I can sync anytime without friction
- As a user, I want to see 100+ historical transactions so that I have a complete view of my financial history

### Functional Requirements
1. Fetch complete transaction history dating back to September 2025 or earlier (6+ months minimum)
2. Correctly classify CREDIT transactions as income entries
3. Correctly classify DEBIT transactions as expense entries
4. Support cursor-based pagination to fetch 100+ transactions
5. Remove SCA requirement for transaction sync
6. Maintain duplicate detection by `wise_transaction_id`
7. Preserve existing database schema and classification logic
8. Keep CSV import functionality as fallback option

### Technical Requirements
- **API Migration**: Replace Balance Statements API (`/v1/profiles/{profileId}/balance-statements/{balanceId}/statement.json`) with Activities API (`/v1/profiles/{profileId}/activities`)
- **Authentication**: Use existing Bearer token authentication (`WISE_API_TOKEN`)
- **Database**: PostgreSQL with existing schema (no changes required)
- **Models**: Use existing `WiseTransactionModel` and `EntryModel`
- **Classification**: Use existing `wiseClassifier.js` service
- **Performance**: Complete sync should finish in <30 seconds
- **Error Handling**: Graceful handling of API failures with detailed logging

### Acceptance Criteria
- [ ] Database `wise_transactions` table contains transactions dating back to Sept 2025 or earlier
- [ ] Database `wise_transactions` table contains both CREDIT and DEBIT type transactions
- [ ] Database `wise_transactions` table contains 100+ total transactions
- [ ] Database `entries` table contains income entries (type='income') created from Wise CREDIT transactions
- [ ] Database `entries` table contains expense entries (type='expense') created from Wise DEBIT transactions
- [ ] Frontend application displays complete transaction history (6+ months date range)
- [ ] Frontend application displays income transactions in list view
- [ ] Frontend application displays expense transactions in list view
- [ ] API sync endpoint completes without SCA errors
- [ ] API sync endpoint returns success response with accurate statistics
- [ ] API sync endpoint handles pagination correctly (fetches all pages)
- [ ] Sync process completes in less than 30 seconds

---

## Implementation Plan

### Tasks

#### Task 1: Replace Balance Statements API with Activities API
- [ ] Implementation complete
  - **Description**: Replace the Balance Statements API call (lines 103-168 in wiseSync_new.js) with Activities API pattern from sync-wise-full-history.js. Remove SCA handling code and balance creation date logic.
  - **Files**: `/Users/rafael/Windsurf/accounting/backend/src/routes/wiseSync_new.js` (lines 82-168)
  - **Dependencies**: None
  - **Technical Approach**:
    1. Remove lines 82-92 (balance creationTime date range logic)
    2. Remove lines 103-168 (Balance Statements API call and SCA handling)
    3. Add Activities API call pattern: `GET /v1/profiles/{profileId}/activities`
    4. Extract `resource.id` from each activity where `type === 'TRANSFER'`
- [ ] **Test 1.1**: Activities API returns data without SCA error
  - **Test Type**: Integration
  - **Success Criteria**: API call returns 200 OK with activities array
  - **Test Data**: Use production credentials (WISE_API_TOKEN, WISE_PROFILE_ID)

#### Task 2: Implement Cursor-Based Pagination
- [ ] Implementation complete
  - **Description**: Add pagination loop to fetch all pages of activities using the cursor field from API responses
  - **Files**: `/Users/rafael/Windsurf/accounting/backend/src/routes/wiseSync_new.js` (new code after Task 1)
  - **Dependencies**: Task 1 (Activities API call must be working)
  - **Technical Approach**:
    1. Initialize `cursor = null` before API loop
    2. Build URL with cursor if present: `?cursor=${cursor}`
    3. Extract `cursor` from response: `const { cursor, activities } = await response.json()`
    4. Continue loop while `cursor !== null`
    5. Track `stats.activitiesProcessed` across all pages
- [ ] **Test 2.1**: Pagination fetches all activity pages
  - **Test Type**: Integration
  - **Success Criteria**: Total activities processed equals x-total-count header value, cursor eventually becomes null
  - **Test Data**: Production account with 100+ transactions

#### Task 3: Implement Transfer API Call for Activity Details
- [ ] Implementation complete
  - **Description**: For each activity with type='TRANSFER', call the Transfer API to get full transaction details including sourceValue/targetValue for CREDIT/DEBIT detection
  - **Files**: `/Users/rafael/Windsurf/accounting/backend/src/routes/wiseSync_new.js` (inside activity processing loop)
  - **Dependencies**: Task 2 (Pagination must be working)
  - **Technical Approach**:
    1. Filter activities: `if (activity.type === 'TRANSFER' && activity.resource?.id)`
    2. Extract transfer ID: `const transferId = activity.resource.id`
    3. Call Transfer API: `GET /v1/transfers/{transferId}`
    4. Parse response to get: `sourceValue`, `targetValue`, `sourceCurrency`, `targetCurrency`, `created`, `details.reference`, `status`, `customerTransactionId`
    5. Pass transfer object to transaction processing function
- [ ] **Test 3.1**: Transfer API returns complete transaction details
  - **Test Type**: Integration
  - **Success Criteria**: Transfer object contains all required fields (id, sourceValue OR targetValue, currency, created date, reference, status)
  - **Test Data**: Single known transfer ID from production

#### Task 4: Fix CREDIT/DEBIT Detection Logic
- [ ] Implementation complete
  - **Description**: Implement correct type detection logic using Transfer API response fields to distinguish income (CREDIT) from expenses (DEBIT)
  - **Files**: `/Users/rafael/Windsurf/accounting/backend/src/routes/wiseSync_new.js` (transaction processing function)
  - **Dependencies**: Task 3 (Transfer API data must be available)
  - **Technical Approach**:
    1. Check if `transfer.sourceValue` exists → DEBIT (money sent out = expense)
    2. Check if only `transfer.targetValue` exists → CREDIT (money received = income)
    3. Use correct field for amount: `Math.abs(transfer.sourceValue || transfer.targetValue)`
    4. Use correct field for currency: `transfer.sourceCurrency || transfer.targetCurrency`
    5. Set transaction type: `const type = transfer.sourceValue ? 'DEBIT' : 'CREDIT'`
    6. Set entry type: `const entryType = type === 'CREDIT' ? 'income' : 'expense'`
- [ ] **Test 4.1**: DEBIT transactions classified as expenses
  - **Test Type**: Unit
  - **Success Criteria**: Transactions with sourceValue are stored with type='DEBIT' and create entries with type='expense'
  - **Test Data**: Mock transfer object with sourceValue=100, no targetValue
- [ ] **Test 4.2**: CREDIT transactions classified as income
  - **Test Type**: Unit
  - **Success Criteria**: Transactions with only targetValue are stored with type='CREDIT' and create entries with type='income'
  - **Test Data**: Mock transfer object with targetValue=100, no sourceValue

#### Task 5: Update Database Insertion Logic
- [ ] Implementation complete
  - **Description**: Ensure all transaction fields are correctly mapped from Transfer API response to database schema, including proper handling of customerTransactionId for duplicate detection
  - **Files**: `/Users/rafael/Windsurf/accounting/backend/src/routes/wiseSync_new.js` (WiseTransactionModel.create call)
  - **Dependencies**: Task 4 (Type detection must be working)
  - **Technical Approach**:
    1. Generate transaction ID: `const transactionId = transfer.customerTransactionId || 'TRANSFER-${transfer.id}'`
    2. Check duplicate: `const existing = await WiseTransactionModel.exists(transactionId)`
    3. If duplicate, skip with stats update: `stats.duplicatesSkipped++`
    4. Extract fields: `amount`, `currency`, `description`, `referenceNumber`, `transactionDate`, `type`, `state`
    5. Call: `await WiseTransactionModel.create({...})`
    6. Create entry: `await pool.query('INSERT INTO entries ...')`
    7. Link entry: `await WiseTransactionModel.updateStatus(transactionId, { entryId: ... })`
- [ ] **Test 5.1**: Transactions inserted with correct fields
  - **Test Type**: Integration
  - **Success Criteria**: wise_transactions table row contains all expected fields with correct values matching Transfer API response
  - **Test Data**: Single test transaction synced to local database
- [ ] **Test 5.2**: Duplicate detection works correctly
  - **Test Type**: Integration
  - **Success Criteria**: Syncing same transaction twice results in one database row and stats.duplicatesSkipped increments
  - **Test Data**: Sync same transfer ID twice in a row

#### Task 6: Update Entry Creation Logic
- [ ] Implementation complete
  - **Description**: Ensure accounting entries are created with correct type (income/expense), category, and linked to wise_transaction_id
  - **Files**: `/Users/rafael/Windsurf/accounting/backend/src/routes/wiseSync_new.js` (entry creation code block)
  - **Dependencies**: Task 5 (Transaction insertion must be working)
  - **Technical Approach**:
    1. Determine entry type: `const entryType = type === 'CREDIT' ? 'income' : 'expense'`
    2. Set category: `const category = entryType === 'income' ? 'other_income' : 'other_expenses'`
    3. Format date: `entry_date = transactionDate.split('T')[0]`
    4. Use transaction fields: `description`, `referenceNumber`, `amount`, `currency`
    5. Insert entry with: `type`, `category`, `description`, `detail`, `base_amount`, `total`, `entry_date`, `status='completed'`, `currency`, `amount_original`, `wise_transaction_id`
    6. Return entry ID and link to transaction
- [ ] **Test 6.1**: Income entries created correctly
  - **Test Type**: Integration
  - **Success Criteria**: CREDIT transactions create entries with type='income' and category='other_income'
  - **Test Data**: Single CREDIT transaction synced to local database
- [ ] **Test 6.2**: Expense entries created correctly
  - **Test Type**: Integration
  - **Success Criteria**: DEBIT transactions create entries with type='expense' and category='other_expenses'
  - **Test Data**: Single DEBIT transaction synced to local database

#### Task 7: Update Statistics Tracking
- [ ] Implementation complete
  - **Description**: Update statistics object to track pagination metrics and provide accurate counts for activities, transfers, and entries created
  - **Files**: `/Users/rafael/Windsurf/accounting/backend/src/routes/wiseSync_new.js` (stats object and console logs)
  - **Dependencies**: All previous tasks (complete implementation required)
  - **Technical Approach**:
    1. Add stats fields: `activitiesProcessed`, `transfersProcessed`, `pagesProcessed`
    2. Remove stats fields: `balancesProcessed`, `scaRequired`
    3. Update console logs with pagination info: "Processing page X, cursor: Y"
    4. Add final summary: "Fetched X pages, Y activities, Z transfers processed"
    5. Include date range in logs: "Oldest: X, Newest: Y"
    6. Keep existing: `transactionsFound`, `newTransactions`, `duplicatesSkipped`, `entriesCreated`, `errors`
- [ ] **Test 7.1**: Statistics accurately reflect sync results
  - **Test Type**: Integration
  - **Success Criteria**: Response stats match actual database counts for new transactions and entries created
  - **Test Data**: Complete sync with verification queries on database

#### Task 8: Update Response Format and Logging
- [ ] Implementation complete
  - **Description**: Update API response and console logging to reflect new Activities API flow and remove SCA-related messages
  - **Files**: `/Users/rafael/Windsurf/accounting/backend/src/routes/wiseSync_new.js` (console.log statements and response JSON)
  - **Dependencies**: Task 7 (Statistics must be accurate)
  - **Technical Approach**:
    1. Update header logs: Change "Balance Statements API" to "Activities API"
    2. Remove SCA warning logs (lines 80, 129-147)
    3. Add pagination progress logs: "Page X/? - Cursor: Y"
    4. Update success message: "Complete historical sync finished: X new transactions from Y activities across Z pages"
    5. Update response JSON: Remove `requiresSCA`, `approvalId`, `approvalResult` fields
    6. Add response fields: `pagesProcessed`, `activitiesProcessed`, `dateRange: { oldest, newest }`
    7. Keep error response format: `{ success: false, error, message, stats }`
- [ ] **Test 8.1**: Response format is correct and informative
  - **Test Type**: Integration
  - **Success Criteria**: API returns success response with all expected fields and no SCA-related fields
  - **Test Data**: Complete sync with inspection of JSON response

---

### Integration Testing
- [ ] **Integration Test 1**: Complete sync process end-to-end
  - **Purpose**: Validate entire flow from Activities API through Transfer API to database insertion
  - **Components Involved**: wiseSync_new.js, WiseTransactionModel, pool (database), Activities API, Transfer API
  - **Success Criteria**:
    - Sync completes without errors
    - Database contains 100+ transactions
    - Both CREDIT and DEBIT transactions present
    - Entries table contains both income and expense entries
    - No SCA errors or 403 responses
    - Sync completes in <30 seconds

- [ ] **Integration Test 2**: Pagination handles multiple pages correctly
  - **Purpose**: Validate cursor-based pagination fetches all available data
  - **Components Involved**: wiseSync_new.js pagination loop, Activities API
  - **Success Criteria**:
    - All pages fetched (cursor eventually null)
    - No duplicate activities across pages
    - Total activities matches x-total-count header
    - Stats reflect correct page count

- [ ] **Integration Test 3**: Type detection works across real data
  - **Purpose**: Validate CREDIT/DEBIT classification on diverse transaction types
  - **Components Involved**: Transfer API, type detection logic, database insertion
  - **Success Criteria**:
    - Money-out transactions are DEBIT/expense
    - Money-in transactions are CREDIT/income
    - All transactions have correct type field
    - Entries match transaction types

---

### End-to-End Validation
- [ ] **E2E Test**: Wise sync complete workflow
  - **Test Steps**:
    1. Start local development environment: `./start-local-dev.sh`
    2. Verify backend is running: `curl http://localhost:7393/health`
    3. Login to get JWT token: `curl -X POST http://localhost:7393/api/auth/login -d '{"username":"rafael","password":"asdflkj@3!"}'`
    4. Clear existing Wise data: `psql -U accounting_user -d accounting_db -c "DELETE FROM entries WHERE wise_transaction_id IS NOT NULL; DELETE FROM wise_transactions;"`
    5. Trigger sync: `curl -X POST http://localhost:7393/api/wise/sync -H "Authorization: Bearer <token>"`
    6. Verify response: Check success=true, newTransactions > 100, no SCA errors
    7. Query database for transactions: `psql -U accounting_user -d accounting_db -c "SELECT type, COUNT(*) FROM wise_transactions GROUP BY type;"`
    8. Query database for entries: `psql -U accounting_user -d accounting_db -c "SELECT type, COUNT(*) FROM entries WHERE wise_transaction_id IS NOT NULL GROUP BY type;"`
    9. Check date range: `psql -U accounting_user -d accounting_db -c "SELECT MIN(transaction_date), MAX(transaction_date) FROM wise_transactions;"`
    10. Open frontend: http://localhost:7392 and navigate to Entries view
    11. Verify both income and expense entries are visible in list
    12. Verify date range shows Sept 2025 - present
    13. Run sync again and verify duplicates are skipped correctly
  - **Expected Result**:
    - Complete sync without errors
    - 100+ transactions in database
    - Both CREDIT and DEBIT types present in wise_transactions table
    - Both income and expense types present in entries table
    - Date range spans Sept 2025 to present
    - Frontend displays all transactions with correct classifications
    - Duplicate sync results in 0 new transactions
    - Sync completes in <30 seconds
  - **Validation Points**:
    - API response contains accurate statistics
    - Database queries confirm both transaction types
    - Date range covers 6+ months of history
    - Frontend UI shows complete history
    - No SCA approval required
    - Performance meets <30 second requirement

---

**Implementation Status**: Ready to begin
**Estimated Time**: 2-3 hours
**Risk Level**: Medium (API migration, but well-documented pattern exists)
**Reference Implementation**: `/Users/rafael/Windsurf/accounting/backend/scripts/sync-wise-full-history.js`
**Reference Documentation**: `/Users/rafael/Windsurf/accounting/DOCS/API/WISE_API_WORKING_PATTERNS.md` (lines 159-232)
