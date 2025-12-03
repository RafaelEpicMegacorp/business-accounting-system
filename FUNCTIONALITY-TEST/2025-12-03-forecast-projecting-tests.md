# Forecast and Projecting Feature - Functional Tests

Created: 2025-12-03
Related Tasks: /Users/rafael/Documents/Programs/accounting/TASKS/2025-12-03-forecast-projecting-tasks.md

---

## Test Suite: Tax Calculations

### CIT (Corporate Income Tax)
- [ ] TEST-001: Calculate CIT at 9% for small taxpayer - Expected: 9% of taxable profit when revenue < 2M EUR
- [ ] TEST-002: Calculate CIT at 19% for standard taxpayer - Expected: 19% of taxable profit when revenue >= 2M EUR
- [ ] TEST-003: Taxable profit calculation - Expected: Revenue - Expenses = Taxable Profit
- [ ] TEST-004: Zero profit scenario - Expected: No CIT when expenses >= revenue
- [ ] TEST-005: Negative profit (loss) - Expected: No CIT, loss carried forward indicator

### ZUS (Social Security)
- [ ] TEST-006: Calculate employer ZUS on salary - Expected: ~20.48% of gross salary
- [ ] TEST-007: ZUS breakdown accuracy - Expected: Pension 9.76% + Disability 6.50% + Accident 1.67% + FP 2.45% + FGSP 0.10%
- [ ] TEST-008: Multiple employees ZUS total - Expected: Sum of individual ZUS calculations
- [ ] TEST-009: Weekly employee ZUS - Expected: ZUS calculated on weekly amount * weeks in month
- [ ] TEST-010: Monthly employee ZUS - Expected: ZUS calculated on full monthly salary

### VAT (Value Added Tax)
- [ ] TEST-011: Standard VAT rate (23%) - Expected: 23% applied to applicable entries
- [ ] TEST-012: VAT in projection display - Expected: VAT shown as separate line item
- [ ] TEST-013: VAT toggle setting - Expected: VAT can be excluded from calculations

### Effective Tax Rate
- [ ] TEST-014: Calculate effective rate - Expected: (Total Taxes / Revenue) * 100
- [ ] TEST-015: Display effective rate - Expected: Shown with 2 decimal precision

---

## Test Suite: Recurring Expense Detection

### Pattern Recognition
- [ ] TEST-016: Detect monthly pattern - Expected: Expenses occurring 11+ times in 12 months with 25-35 day intervals
- [ ] TEST-017: Detect weekly pattern - Expected: Expenses occurring 48+ times in 12 months with 5-9 day intervals
- [ ] TEST-018: Detect quarterly pattern - Expected: Expenses occurring 3+ times in 12 months with 80-100 day intervals
- [ ] TEST-019: Exclude irregular patterns - Expected: Patterns with inconsistent intervals not detected

### Confidence Scoring
- [ ] TEST-020: High confidence (95%) - Expected: Amount variance < 10%
- [ ] TEST-021: Medium confidence (85%) - Expected: Amount variance 10-20%
- [ ] TEST-022: Low confidence (70%) - Expected: Amount variance 20-50%
- [ ] TEST-023: Excluded patterns - Expected: Confidence < 70% not shown in forecast

### Amount Calculation
- [ ] TEST-024: Calculate typical amount - Expected: Average of historical amounts
- [ ] TEST-025: Handle currency conversion - Expected: Amounts converted to USD for comparison

### Pattern Management
- [ ] TEST-026: Display detected patterns - Expected: List shows description, amount, frequency, confidence
- [ ] TEST-027: Toggle pattern inclusion - Expected: User can include/exclude patterns from forecast
- [ ] TEST-028: Total recurring amount - Expected: Sum of included pattern amounts

---

## Test Suite: Multi-Month Projections

### Period Selection
- [ ] TEST-029: Select 1 month - Expected: Show projection for current month only
- [ ] TEST-030: Select 3 months - Expected: Show projection for 3 months ahead
- [ ] TEST-031: Select 6 months - Expected: Show projection for 6 months ahead
- [ ] TEST-032: Select 12 months - Expected: Show projection for 12 months ahead

### Balance Calculation
- [ ] TEST-033: Starting balance accuracy - Expected: Matches current Wise balance
- [ ] TEST-034: Month-over-month balance - Expected: Ending balance = Starting + Income - Expenses - Taxes
- [ ] TEST-035: Running balance consistency - Expected: Each month's starting balance = previous month's ending balance

### Income Projection
- [ ] TEST-036: Contract income included - Expected: Active monthly contracts included in each month
- [ ] TEST-037: Contract payment day respected - Expected: Contracts assigned to correct month based on payment_day
- [ ] TEST-038: Yearly contracts handled - Expected: Yearly contracts appear in correct month only
- [ ] TEST-039: Expired contracts excluded - Expected: Contracts past end_date not included

### Expense Projection
- [ ] TEST-040: Employee salaries included - Expected: All active employee salaries in projection
- [ ] TEST-041: Weekly salary calculation - Expected: Weekly employees = (monthly rate / 4) * weeks in month
- [ ] TEST-042: Monthly salary calculation - Expected: Monthly employees = full pay_rate * multiplier
- [ ] TEST-043: Recurring expenses included - Expected: Detected patterns added to expense projections
- [ ] TEST-044: Transfers excluded - Expected: Category "Transfers" not counted as expense

---

## Test Suite: Tax Settings

### Settings Management
- [ ] TEST-045: Retrieve settings - Expected: API returns current tax settings
- [ ] TEST-046: Update CIT rate - Expected: Setting saved and applied to calculations
- [ ] TEST-047: Update ZUS rate - Expected: Setting saved and applied to calculations
- [ ] TEST-048: Persist settings - Expected: Settings retained after page reload

### UI Controls
- [ ] TEST-049: Settings modal opens - Expected: Click settings button opens modal
- [ ] TEST-050: CIT rate selector - Expected: Radio buttons for 9% and 19%
- [ ] TEST-051: Save settings - Expected: Save button updates settings via API
- [ ] TEST-052: Cancel without saving - Expected: Cancel button closes modal without changes

---

## Test Suite: Frontend Components

### ForecastView Integration
- [ ] TEST-053: Page loads successfully - Expected: ForecastView renders without errors
- [ ] TEST-054: Period selector visible - Expected: 1, 3, 6, 12 month buttons displayed
- [ ] TEST-055: Default period selection - Expected: 3 months selected by default
- [ ] TEST-056: Data loads on mount - Expected: Projection data fetched and displayed

### Projection Table
- [ ] TEST-057: Table renders - Expected: Table with columns for Month, Income, Expenses, Taxes, Balance
- [ ] TEST-058: Correct row count - Expected: Rows match selected period (1, 3, 6, or 12)
- [ ] TEST-059: Currency formatting - Expected: All amounts show $ with 2 decimal places
- [ ] TEST-060: Color coding - Expected: Positive balance blue, negative balance red

### Recurring Expenses Display
- [ ] TEST-061: List renders - Expected: Detected patterns displayed in list
- [ ] TEST-062: Confidence indicator - Expected: Visual indicator showing confidence level
- [ ] TEST-063: Total displayed - Expected: Sum of recurring expenses shown
- [ ] TEST-064: Empty state - Expected: Friendly message when no patterns detected

### Tax Breakdown Panel
- [ ] TEST-065: Panel renders - Expected: Tax breakdown visible on page
- [ ] TEST-066: CIT calculation shown - Expected: CIT amount and rate displayed
- [ ] TEST-067: ZUS breakdown shown - Expected: Individual ZUS components listed
- [ ] TEST-068: Effective rate shown - Expected: Percentage displayed with explanation

### Projection Chart
- [ ] TEST-069: Chart renders - Expected: Recharts line chart displayed
- [ ] TEST-070: Income line visible - Expected: Green line showing projected income
- [ ] TEST-071: Expense line visible - Expected: Red line showing projected expenses
- [ ] TEST-072: Balance area visible - Expected: Blue/red area showing balance over time
- [ ] TEST-073: Tooltips work - Expected: Hover shows detailed values
- [ ] TEST-074: Responsive sizing - Expected: Chart adjusts to container width

---

## Test Suite: Edge Cases

### Empty Data Scenarios
- [ ] TEST-075: No contracts - Expected: Projection shows zero income
- [ ] TEST-076: No employees - Expected: Projection shows zero salary expenses
- [ ] TEST-077: No historical expenses - Expected: Recurring detection returns empty
- [ ] TEST-078: New user/empty database - Expected: Graceful handling with helpful message

### Extreme Values
- [ ] TEST-079: Very large amounts - Expected: Proper formatting (millions, thousands separators)
- [ ] TEST-080: Very small amounts - Expected: Proper decimal handling
- [ ] TEST-081: Negative balance projection - Expected: Displayed in red with warning

### Date Edge Cases
- [ ] TEST-082: End of year projection - Expected: Year transition handled correctly (Dec to Jan)
- [ ] TEST-083: February handling - Expected: 28/29 days handled correctly
- [ ] TEST-084: Month with 31 days - Expected: Payment days handled correctly

### Currency Handling
- [ ] TEST-085: Multi-currency entries - Expected: Converted to USD for projection
- [ ] TEST-086: EUR contracts - Expected: Converted to USD using exchange rates
- [ ] TEST-087: PLN expenses - Expected: Converted to USD for consistency

---

## Test Suite: API Endpoints

### GET /api/forecast/projection
- [ ] TEST-088: Returns data for default period (3 months) - Expected: 200 OK with projections array
- [ ] TEST-089: Accepts months parameter - Expected: Returns correct number of months
- [ ] TEST-090: Invalid months parameter - Expected: 400 Bad Request with error message
- [ ] TEST-091: Authentication required - Expected: 401 Unauthorized without token

### GET /api/forecast/recurring-expenses
- [ ] TEST-092: Returns detected patterns - Expected: 200 OK with patterns array
- [ ] TEST-093: Empty result handling - Expected: 200 OK with empty array
- [ ] TEST-094: Authentication required - Expected: 401 Unauthorized without token

### GET /api/forecast/tax-settings
- [ ] TEST-095: Returns current settings - Expected: 200 OK with settings object
- [ ] TEST-096: Default values present - Expected: CIT, VAT, ZUS rates returned
- [ ] TEST-097: Authentication required - Expected: 401 Unauthorized without token

### PUT /api/forecast/tax-settings
- [ ] TEST-098: Updates settings successfully - Expected: 200 OK with updated settings
- [ ] TEST-099: Invalid rate value - Expected: 400 Bad Request
- [ ] TEST-100: Authentication required - Expected: 401 Unauthorized without token

### POST /api/forecast/calculate-taxes
- [ ] TEST-101: Calculates taxes correctly - Expected: 200 OK with tax breakdown
- [ ] TEST-102: Handles zero values - Expected: Returns zero taxes
- [ ] TEST-103: Missing required fields - Expected: 400 Bad Request

---

## Test Execution Checklist

### Pre-Testing
- [ ] Database migrations applied
- [ ] Backend server running
- [ ] Frontend dev server running
- [ ] Test data available

### Test Execution
- [ ] Run all API endpoint tests
- [ ] Run all tax calculation tests
- [ ] Run all UI component tests
- [ ] Run edge case tests

### Post-Testing
- [ ] Document any failures
- [ ] Create bug reports for failures
- [ ] Verify fixes pass tests
- [ ] Update test results

---

## Notes

**Testing Priority**:
1. Tax calculations (accuracy critical)
2. Recurring expense detection
3. Multi-month projections
4. UI components
5. Edge cases

**Test Data Requirements**:
- At least 12 months of historical expenses
- Multiple active contracts
- Weekly and monthly employees
- Various expense categories
