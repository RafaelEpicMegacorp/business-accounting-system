# AI Learning from User Decisions - Functional Tests

Created: 2025-12-03
Related Tasks: /TASKS/2025-12-03-ai-learning-tasks.md

## Test Suite: Database Migration

- [ ] TEST-DB-001: Migration creates all new columns - Expected: No errors, columns exist in ai_decision_feedback
- [ ] TEST-DB-002: Migration creates indexes - Expected: idx_ai_feedback_description and idx_ai_feedback_rejection_reason exist
- [ ] TEST-DB-003: Backfill populates existing records - Expected: description column filled for existing feedback rows
- [ ] TEST-DB-004: Migration is idempotent - Expected: Running migration twice causes no errors

## Test Suite: Accept Flow

- [ ] TEST-ACC-001: Accept stores description - Expected: ai_decision_feedback.description matches suggestion.description
- [ ] TEST-ACC-002: Accept stores suggested classification name - Expected: suggested_classification_name populated
- [ ] TEST-ACC-003: Accept stores final classification name - Expected: final_classification_name matches user selection
- [ ] TEST-ACC-004: Accept stores frequency - Expected: suggested_frequency populated
- [ ] TEST-ACC-005: Accept stores currency - Expected: currency matches suggestion currency
- [ ] TEST-ACC-006: Accept stores notes if provided - Expected: user_notes populated when modifications.notes provided

## Test Suite: Reject Flow

- [ ] TEST-REJ-001: Reject stores description - Expected: ai_decision_feedback.description matches suggestion.description
- [ ] TEST-REJ-002: Reject stores structured reason - Expected: rejection_reason is one of allowed values
- [ ] TEST-REJ-003: Reject stores user notes - Expected: user_notes populated when provided
- [ ] TEST-REJ-004: Reject with invalid reason fails - Expected: 400 error for invalid rejection_reason
- [ ] TEST-REJ-005: Reject without reason defaults to null - Expected: rejection_reason is NULL when not provided

## Test Suite: Decision History API

- [ ] TEST-HIST-001: Get all decisions - Expected: Returns array of decisions with all fields
- [ ] TEST-HIST-002: Filter by accepted - Expected: Only accepted decisions returned
- [ ] TEST-HIST-003: Filter by rejected - Expected: Only rejected decisions returned
- [ ] TEST-HIST-004: Pagination works - Expected: limit=10, offset=10 returns next 10 items
- [ ] TEST-HIST-005: Total count correct - Expected: total field matches actual count
- [ ] TEST-HIST-006: Sort by date descending - Expected: Most recent decisions first
- [ ] TEST-HIST-007: Date range filter works - Expected: Only decisions in date range returned

## Test Suite: Decision Statistics API

- [ ] TEST-STAT-001: Total decisions correct - Expected: total_decisions matches COUNT(*)
- [ ] TEST-STAT-002: Accepted count correct - Expected: accepted matches actual accepted count
- [ ] TEST-STAT-003: Rejected count correct - Expected: rejected matches actual rejected count
- [ ] TEST-STAT-004: Acceptance rate calculated - Expected: acceptance_rate = accepted/total * 100
- [ ] TEST-STAT-005: Common rejections populated - Expected: Array of top rejected descriptions
- [ ] TEST-STAT-006: Classification corrections populated - Expected: Array of original->corrected pairs
- [ ] TEST-STAT-007: Empty database returns zeros - Expected: All counts zero, no errors

## Test Suite: Learning Context API

- [ ] TEST-LEARN-001: Rejected patterns returned - Expected: Array with description, times_rejected, rejection_reason
- [ ] TEST-LEARN-002: Classification corrections returned - Expected: Array with description, original, corrected
- [ ] TEST-LEARN-003: Amount adjustments returned - Expected: Array with description, original_amount, modified_amount
- [ ] TEST-LEARN-004: User preferences returned - Expected: acceptance_rate and avg_accepted_confidence
- [ ] TEST-LEARN-005: Limits respected - Expected: Max 30 rejected, 20 corrections, 15 amounts
- [ ] TEST-LEARN-006: Empty database returns empty arrays - Expected: Empty arrays, no errors

## Test Suite: Clear Rejected History

- [ ] TEST-CLEAR-001: Clear all rejected - Expected: All rejected feedback deleted
- [ ] TEST-CLEAR-002: Clear older than days - Expected: Only old rejected feedback deleted
- [ ] TEST-CLEAR-003: Clear returns count - Expected: Response includes deleted count
- [ ] TEST-CLEAR-004: Accepted decisions unchanged - Expected: Accepted feedback not deleted
- [ ] TEST-CLEAR-005: Modified decisions unchanged - Expected: Modified feedback not deleted

## Test Suite: OpenAI Prompt Integration

- [ ] TEST-PROMPT-001: Learning context included - Expected: Prompt contains "Learning from User Feedback"
- [ ] TEST-PROMPT-002: Rejected patterns in prompt - Expected: Rejected items listed under "REJECTED PATTERNS"
- [ ] TEST-PROMPT-003: Corrections in prompt - Expected: Classification corrections listed
- [ ] TEST-PROMPT-004: Amounts in prompt - Expected: Amount adjustments listed
- [ ] TEST-PROMPT-005: Empty learning handled - Expected: "No user feedback available yet" when empty
- [ ] TEST-PROMPT-006: AI avoids rejected items - Expected: New analysis does not suggest previously rejected items

## Test Suite: Frontend Settings UI

- [ ] TEST-UI-001: Decision History section loads - Expected: Section visible in Settings page
- [ ] TEST-UI-002: Stats cards display - Expected: Total, Accepted, Rejected, Rate cards shown
- [ ] TEST-UI-003: Common rejections display - Expected: Yellow warning box with rejection list
- [ ] TEST-UI-004: History table loads - Expected: Table with columns: Date, Description, AI Class, User Class, Decision, Reason
- [ ] TEST-UI-005: Filter dropdown works - Expected: Selecting filter updates table
- [ ] TEST-UI-006: Pagination works - Expected: Previous/Next buttons navigate pages
- [ ] TEST-UI-007: Learning Context modal opens - Expected: Modal shows rejected, corrections, amounts
- [ ] TEST-UI-008: Clear Rejected shows confirmation - Expected: Confirm dialog before delete
- [ ] TEST-UI-009: Clear Rejected updates table - Expected: Table refreshes after clear
- [ ] TEST-UI-010: Section collapses - Expected: ChevronDown/Up toggles section visibility
- [ ] TEST-UI-011: Loading state shown - Expected: Spinner while fetching data

## Test Suite: End-to-End Flow

- [ ] TEST-E2E-001: Full accept flow - Expected: Accept suggestion -> feedback stored -> appears in history
- [ ] TEST-E2E-002: Full reject flow - Expected: Reject with reason -> feedback stored -> appears in history
- [ ] TEST-E2E-003: Learning applied - Expected: Reject item -> run analysis -> item not suggested again
- [ ] TEST-E2E-004: Classification correction learned - Expected: Correct classification -> next analysis uses correction
- [ ] TEST-E2E-005: Amount correction learned - Expected: Correct amount -> next analysis uses corrected amount

## Authentication Tests

- [ ] TEST-AUTH-001: Decision history requires auth - Expected: 401 without token
- [ ] TEST-AUTH-002: Decision stats requires auth - Expected: 401 without token
- [ ] TEST-AUTH-003: Learning context requires auth - Expected: 401 without token
- [ ] TEST-AUTH-004: Clear rejected requires auth - Expected: 401 without token

## Performance Tests

- [ ] TEST-PERF-001: History with 1000+ records - Expected: Response < 2 seconds with pagination
- [ ] TEST-PERF-002: Learning context generation - Expected: Response < 1 second
- [ ] TEST-PERF-003: Stats calculation - Expected: Response < 1 second

## Error Handling Tests

- [ ] TEST-ERR-001: Invalid suggestion ID - Expected: 404 error
- [ ] TEST-ERR-002: Database connection failure - Expected: 500 with descriptive error
- [ ] TEST-ERR-003: Invalid filter values - Expected: 400 with validation message
