# Wise Transaction Sync Fix

## Product Requirements Document (PRD)

### Overview
Fix the Wise transaction synchronization endpoint to fetch complete transaction history (6+ months) without requiring SCA approval. The current implementation uses Balance Statements API which has SCA requirements and date range limitations. This fix switches to Activities API + Transfer API for full historical access.

### User Stories
- As a user, I want to sync my complete Wise transaction history without requiring SCA approval
- As a user, I want to see both income (CREDIT) and expense (DEBIT) transactions imported correctly
- As a user, I want transactions from September 2025 onwards to be available in my accounting system

### Functional Requirements
1. Fetch ALL transactions from Wise account (6+ months historical data)
2. Correctly classify transactions as CREDIT (income) or DEBIT (expense)
3. Import transactions without requiring SCA approval
4. Handle cursor-based pagination to fetch 100+ transactions
5. Prevent duplicate imports using transaction IDs
6. Auto-create accounting entries for imported transactions

### Technical Requirements
- **API Change**: Switch from Balance Statements API to Activities API + Transfer API
- **Pagination**: Implement cursor-based pagination loop for Activities API
- **Type Detection**: Use Transfer API to determine CREDIT vs DEBIT based on sourceValue/targetValue
- **Database**: Store transactions in wise_transactions table with proper type classification
- **Entry Creation**: Auto-create entries table records for each transaction

### Acceptance Criteria
- [ ] Sync fetches transactions from September 2025 onwards (6+ months)
- [ ] Both CREDIT and DEBIT transactions are imported correctly
- [ ] No SCA approval required for sync operation
- [ ] Pagination fetches all available transactions (100+)
- [ ] Duplicate prevention works correctly
- [ ] Each transaction creates a corresponding entry record

---

## Implementation Plan

### Tasks

#### Task 1: Replace Balance Statements API with Activities API
- [ ] Implementation complete
  - **Description**: Replace the Balance Statements API call (lines 103-120) with Activities API call
  - **Files**: `/Users/rafael/Windsurf/accounting/backend/src/routes/wiseSync_new.js`
  - **Dependencies**: None
  - **Technical Approach**: Change endpoint from `/v1/profiles/{profileId}/balance-statements/{balanceId}/statement.json` to `/v1/profiles/{profileId}/activities`, remove intervalStart/intervalEnd parameters
- [ ] **Test 1.1**: Activities API returns data
  - **Test Type**: Integration
  - **Success Criteria**: API call returns activities array with at least 1 activity
  - **Test Data**: Real Wise API credentials from environment variables

#### Task 2: Implement Cursor-Based Pagination
- [ ] Implementation complete
  - **Description**: Add pagination loop to fetch all activities using nextCursor parameter
  - **Files**: `/Users/rafael/Windsurf/accounting/backend/src/routes/wiseSync_new.js`
  - **Dependencies**: Task 1
  - **Technical Approach**: Implement while loop checking for data.nextCursor, append activities to array, continue until no more pages
- [ ] **Test 2.1**: Pagination fetches multiple pages
  - **Test Type**: Integration
  - **Success Criteria**: Fetch continues until all activities retrieved, logs show multiple page fetches
  - **Test Data**: Real Wise account with 100+ transactions

#### Task 3: Implement Transfer API Call
- [ ] Implementation complete
  - **Description**: For each TRANSFER activity, call Transfer API to get full transfer details
  - **Files**: `/Users/rafael/Windsurf/accounting/backend/src/routes/wiseSync_new.js`
  - **Dependencies**: Task 2
  - **Technical Approach**: Extract transfer ID from activity.resource.id, call GET /v1/transfers/{transferId}
- [ ] **Test 3.1**: Transfer API returns detailed data
  - **Test Type**: Integration
  - **Success Criteria**: For each TRANSFER activity, Transfer API call succeeds and returns sourceValue/targetValue fields
  - **Test Data**: Transfer IDs from Activities API response

#### Task 4: Fix CREDIT/DEBIT Detection Logic
- [ ] Implementation complete
  - **Description**: Use Transfer API response to correctly identify CREDIT vs DEBIT transactions
  - **Files**: `/Users/rafael/Windsurf/accounting/backend/src/routes/wiseSync_new.js`
  - **Dependencies**: Task 3
  - **Technical Approach**: If transfer.sourceValue exists = DEBIT (expense), if only transfer.targetValue exists = CREDIT (income)
- [ ] **Test 4.1**: CREDIT transactions detected correctly
  - **Test Type**: Unit
  - **Success Criteria**: Incoming transfers (only targetValue) marked as CREDIT
  - **Test Data**: Mock transfer with targetValue only
- [ ] **Test 4.2**: DEBIT transactions detected correctly
  - **Test Type**: Unit
  - **Success Criteria**: Outgoing transfers (sourceValue exists) marked as DEBIT
  - **Test Data**: Mock transfer with sourceValue

#### Task 5: Update Database Insertion Logic
- [ ] Implementation complete
  - **Description**: Store transaction with correct type (CREDIT/DEBIT) in wise_transactions table
  - **Files**: `/Users/rafael/Windsurf/accounting/backend/src/routes/wiseSync_new.js`
  - **Dependencies**: Task 4
  - **Technical Approach**: Pass correct type to WiseTransactionModel.create(), use transfer data for amount/currency/description
- [ ] **Test 5.1**: Transaction stored with correct type
  - **Test Type**: Integration
  - **Success Criteria**: Query wise_transactions table, verify type field matches expected CREDIT/DEBIT
  - **Test Data**: Sample transfer from API response

#### Task 6: Update Entry Creation Logic
- [ ] Implementation complete
  - **Description**: Create entries table record with correct type (income/expense) based on transaction type
  - **Files**: `/Users/rafael/Windsurf/accounting/backend/src/routes/wiseSync_new.js`
  - **Dependencies**: Task 5
  - **Technical Approach**: Map CREDIT → income, DEBIT → expense, insert into entries table with proper category
- [ ] **Test 6.1**: Entry created with correct type
  - **Test Type**: Integration
  - **Success Criteria**: Query entries table, verify type field is 'income' for CREDIT, 'expense' for DEBIT
  - **Test Data**: Sample CREDIT and DEBIT transactions

#### Task 7: Update Statistics Tracking
- [ ] Implementation complete
  - **Description**: Update stats object to track activities processed, transfers fetched, pagination pages
  - **Files**: `/Users/rafael/Windsurf/accounting/backend/src/routes/wiseSync_new.js`
  - **Dependencies**: Task 6
  - **Technical Approach**: Add new counters to stats object, increment in appropriate places, include in console logs
- [ ] **Test 7.1**: Statistics are accurate
  - **Test Type**: Integration
  - **Success Criteria**: Response stats match actual database inserts, logs show correct counts
  - **Test Data**: Run full sync and verify all counts

#### Task 8: Remove Deprecated Code
- [ ] Implementation complete
  - **Description**: Remove SCA handling code (lines 122-152) and date range logic (lines 82-92)
  - **Files**: `/Users/rafael/Windsurf/accounting/backend/src/routes/wiseSync_new.js`
  - **Dependencies**: Task 7
  - **Technical Approach**: Delete unused code sections, clean up comments referencing old API
- [ ] **Test 8.1**: Code cleanup complete
  - **Test Type**: Code Review
  - **Success Criteria**: No references to Balance Statements API, SCA, or intervalStart/intervalEnd remain
  - **Test Data**: Manual code inspection

---

### Integration Testing
- [ ] **Integration Test 1**: Complete sync workflow
  - **Purpose**: Validate end-to-end sync process from Activities API to database
  - **Components Involved**: Activities API, Transfer API, wiseTransactionModel, entryModel, PostgreSQL
  - **Success Criteria**: Sync completes without errors, transactions appear in database with correct types

- [ ] **Integration Test 2**: Pagination handles large datasets
  - **Purpose**: Verify pagination fetches all available transactions
  - **Components Involved**: Activities API with cursor parameter, pagination loop
  - **Success Criteria**: All transactions from 6+ months are fetched and stored

- [ ] **Integration Test 3**: Duplicate prevention
  - **Purpose**: Verify running sync twice doesn't create duplicates
  - **Components Involved**: WiseTransactionModel.exists(), database unique constraints
  - **Success Criteria**: Second sync skips all transactions, duplicatesSkipped count matches total

---

### End-to-End Validation
- [ ] **E2E Test**: Wise sync complete workflow
  - **Test Steps**:
    1. Clear wise_transactions and related entries from test database
    2. Call POST /api/wise/sync endpoint with valid JWT token
    3. Wait for sync to complete (may take 30-60 seconds)
    4. Query wise_transactions table - verify transactions exist with both CREDIT and DEBIT types
    5. Query entries table - verify corresponding entries created with correct income/expense types
    6. Check transaction dates - verify oldest transaction is from September 2025 or earlier
    7. Run sync again - verify all transactions are marked as duplicates
  - **Expected Result**: 100+ transactions imported, both income and expenses present, no SCA required, no errors
  - **Validation Points**:
    - stats.transactionsFound >= 100
    - stats.newTransactions >= 100 (first run)
    - stats.duplicatesSkipped >= 100 (second run)
    - Database shows mix of CREDIT and DEBIT transactions
    - Oldest transaction date is September 2025 or earlier
