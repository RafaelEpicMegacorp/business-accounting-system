# Search and Advanced Filtering Feature

## Product Requirements Document (PRD)

### Overview
Add comprehensive search and filtering capabilities to the accounting system, enabling users to quickly find specific transactions by description, employee, category, amount range, status, currency, and date range. This feature will significantly improve usability and data discovery across all entry views (Income, Expenses, Salaries).

### User Stories
- As a user, I want to search for "office supplies" to see all related expenses across all time periods
- As a user, I want to filter expenses by multiple categories at once to analyze spending patterns
- As a user, I want to find all transactions over $1000 in the last quarter for auditing purposes
- As a user, I want to filter by specific employees to see their salary history
- As a user, I want to clear all filters with one click to reset my view
- As a user, I want to see how many filters are active without opening the filter panel
- As a user, I want search results to update in real-time as I type

### Functional Requirements
1. **Global Search**
   - Search across entry description field (partial match, case-insensitive)
   - Search across employee names (when entry has employee association)
   - Search across category names
   - Debounced search (300ms) to reduce API calls
   - Search works across all entry types (income, expenses, salaries)

2. **Advanced Filtering**
   - Filter by amount range (min/max values)
   - Filter by multiple categories (multi-select)
   - Filter by employee (dropdown selection)
   - Filter by status (completed/pending)
   - Filter by currency (USD, EUR, PLN, GBP)
   - Filter by date range (existing functionality, enhance if needed)
   - All filters can be combined

3. **Filter Management**
   - "Clear All Filters" button resets all search and filter state
   - Active filter count badge (e.g., "3 filters active")
   - Visual indicators for which filters are active
   - Filter panel can be collapsed/expanded
   - Filters persist across tab switches (optional)

4. **User Experience**
   - Loading state while fetching filtered results
   - "No results found" empty state with helpful message
   - Results count display (e.g., "Showing 15 of 247 entries")
   - Filter panel accessible from all entry views
   - Search bar prominent at top of entry tables

### Technical Requirements
- **Backend**: PostgreSQL queries with WHERE clauses for efficient filtering
- **Frontend**: React state management for filter state
- **API**: RESTful query parameters following existing patterns
- **Performance**: Debounced search, optimized SQL queries
- **Security**: JWT authentication required for all endpoints
- **Compatibility**: Works with existing entry endpoints

### Acceptance Criteria
- [ ] Search bar is visible and functional in Income, Expenses, and Salaries tabs
- [ ] Search works across description, employee name, and category fields
- [ ] Amount range filter accepts min/max values and filters correctly
- [ ] Category filter allows multiple selections
- [ ] Employee filter shows all active employees
- [ ] Status filter toggles between completed/pending/all
- [ ] Currency filter shows all supported currencies
- [ ] Clear all filters button resets all state
- [ ] Active filter count is displayed when filters are applied
- [ ] Loading state appears during API calls
- [ ] "No results found" state shows when query returns empty
- [ ] Results count displays total matching entries
- [ ] Search is debounced to avoid excessive API calls
- [ ] All filters can be combined (e.g., search + amount + category)
- [ ] Existing date range filtering continues to work

---

## Implementation Plan

### Tasks

#### Task 1: Backend - Enhance Entry Query Endpoint
- [ ] Implementation complete
  - **Description**: Modify GET /api/entries endpoints (getAll, getIncome, getExpenses, getSalaries) to accept search and filter query parameters
  - **Files**:
    - `backend/src/controllers/entryController.js`
    - `backend/src/models/entryModel.js`
  - **Dependencies**: None
  - **Technical Approach**:
    - Add query parameters: `search`, `categories[]`, `employeeId`, `minAmount`, `maxAmount`, `status`, `currency`
    - Update SQL queries with dynamic WHERE clauses
    - Use parameterized queries to prevent SQL injection
    - Return total count for results display
    - Maintain backward compatibility with existing date filters
- [ ] **Test 1.1**: Test search parameter
  - **Test Type**: Integration
  - **Success Criteria**: GET /api/entries?search=office returns only entries with "office" in description, employee name, or category
  - **Test Data**: Create test entries with various descriptions

- [ ] **Test 1.2**: Test category filter
  - **Test Type**: Integration
  - **Success Criteria**: GET /api/entries?categories=Software,Marketing returns only entries in those categories
  - **Test Data**: Entries with multiple categories

- [ ] **Test 1.3**: Test amount range filter
  - **Test Type**: Integration
  - **Success Criteria**: GET /api/entries?minAmount=100&maxAmount=500 returns only entries in that range
  - **Test Data**: Entries with amounts below, within, and above range

- [ ] **Test 1.4**: Test combined filters
  - **Test Type**: Integration
  - **Success Criteria**: Multiple filters applied together work correctly
  - **Test Data**: Mix of all filter types

#### Task 2: Backend - Add Employee List Endpoint (if not exists)
- [ ] Implementation complete
  - **Description**: Ensure there's an endpoint to fetch all employees for the employee filter dropdown
  - **Files**:
    - `backend/src/controllers/employeeController.js`
    - `backend/src/routes/employeeRoutes.js`
  - **Dependencies**: Task 1
  - **Technical Approach**:
    - Verify GET /api/employees endpoint exists and returns active employees
    - If needed, add query parameter to filter by active status
    - Return minimal data (id, name) for dropdown efficiency
- [ ] **Test 2.1**: Test employee list endpoint
  - **Test Type**: Unit
  - **Success Criteria**: GET /api/employees returns array of employees with id and name
  - **Test Data**: Database with active and terminated employees

#### Task 3: Frontend - Create SearchBar Component
- [ ] Implementation complete
  - **Description**: Build reusable search bar component with debouncing
  - **Files**:
    - `frontend/src/components/SearchBar.jsx` (new file)
  - **Dependencies**: Task 1, Task 2
  - **Technical Approach**:
    - Create controlled input component
    - Implement 300ms debounce using useEffect and setTimeout
    - Emit search query changes to parent component
    - Include clear button (X icon) when text is present
    - Add search icon (Search from lucide-react)
    - Tailwind CSS styling matching existing design
- [ ] **Test 3.1**: Test search input updates
  - **Test Type**: Unit
  - **Success Criteria**: Typing in search bar updates parent state after 300ms debounce
  - **Test Data**: Simulated typing events

- [ ] **Test 3.2**: Test clear button
  - **Test Type**: Unit
  - **Success Criteria**: Clicking X icon clears search and notifies parent
  - **Test Data**: Search bar with text

#### Task 4: Frontend - Create FilterPanel Component
- [ ] Implementation complete
  - **Description**: Build comprehensive filter panel with all filter controls
  - **Files**:
    - `frontend/src/components/FilterPanel.jsx` (new file)
  - **Dependencies**: Task 1, Task 2, Task 3
  - **Technical Approach**:
    - Collapsible panel (collapsed by default on mobile, expanded on desktop)
    - Amount range inputs (min/max)
    - Multi-select category checkboxes
    - Employee dropdown (fetched from API)
    - Status radio buttons (All/Completed/Pending)
    - Currency radio buttons (All/USD/EUR/PLN/GBP)
    - "Clear All Filters" button
    - Active filter count badge
    - Responsive grid layout
    - Tailwind CSS styling
- [ ] **Test 4.1**: Test filter state management
  - **Test Type**: Unit
  - **Success Criteria**: Changing any filter updates parent state correctly
  - **Test Data**: Various filter combinations

- [ ] **Test 4.2**: Test clear all filters
  - **Test Type**: Unit
  - **Success Criteria**: Clear button resets all filter state to defaults
  - **Test Data**: Panel with multiple active filters

- [ ] **Test 4.3**: Test active filter count
  - **Test Type**: Unit
  - **Success Criteria**: Badge shows correct count of active filters
  - **Test Data**: 0, 1, 3, 5 active filters

#### Task 5: Frontend - Update entryService for Search/Filter
- [ ] Implementation complete
  - **Description**: Enhance entryService to pass search and filter parameters to API
  - **Files**:
    - `frontend/src/services/entryService.js`
  - **Dependencies**: Task 1, Task 2, Task 3, Task 4
  - **Technical Approach**:
    - Update getIncome, getExpenses, getSalaries, getAll methods
    - Accept filters object parameter with all filter options
    - Build URLSearchParams dynamically
    - Handle array parameters (categories) correctly
    - Maintain backward compatibility with existing date filters
- [ ] **Test 5.1**: Test filter parameter building
  - **Test Type**: Unit
  - **Success Criteria**: Service correctly builds query string with all active filters
  - **Test Data**: Various filter combinations

#### Task 6: Frontend - Integrate Search & Filters into AccountingApp
- [ ] Implementation complete
  - **Description**: Add SearchBar and FilterPanel to AccountingApp.jsx and wire up state management
  - **Files**:
    - `frontend/src/components/AccountingApp.jsx`
  - **Dependencies**: Task 1, Task 2, Task 3, Task 4, Task 5
  - **Technical Approach**:
    - Add search and filter state to AccountingApp
    - Place SearchBar above entry tables in Income, Expenses, Salaries views
    - Add FilterPanel in collapsible section or sidebar
    - Update loadEntries to include search/filter parameters
    - Add loading state management
    - Add "No results" empty state handling
    - Add results count display
    - Wire up "Clear All Filters" to reset state
- [ ] **Test 6.1**: Test search integration
  - **Test Type**: Integration
  - **Success Criteria**: Typing in search bar filters displayed entries
  - **Test Data**: Entries with searchable content

- [ ] **Test 6.2**: Test filter integration
  - **Test Type**: Integration
  - **Success Criteria**: Changing filters updates displayed entries
  - **Test Data**: Entries matching various filters

- [ ] **Test 6.3**: Test loading states
  - **Test Type**: Integration
  - **Success Criteria**: Loading indicator appears during API calls
  - **Test Data**: Slow API response simulation

- [ ] **Test 6.4**: Test empty state
  - **Test Type**: Integration
  - **Success Criteria**: "No results found" message appears when query returns empty
  - **Test Data**: Search/filter with no matches

#### Task 7: Frontend - Enhance UI/UX Polish
- [ ] Implementation complete
  - **Description**: Add final polish for professional user experience
  - **Files**:
    - `frontend/src/components/AccountingApp.jsx`
    - `frontend/src/components/FilterPanel.jsx`
    - `frontend/src/components/SearchBar.jsx`
  - **Dependencies**: Task 6
  - **Technical Approach**:
    - Add smooth transitions for filter panel collapse/expand
    - Add visual feedback for active filters (badges, highlights)
    - Ensure responsive design works on mobile/tablet
    - Add helpful empty state messages
    - Add tooltips for filter controls
    - Ensure keyboard navigation works
    - Test accessibility (ARIA labels)
- [ ] **Test 7.1**: Test responsive design
  - **Test Type**: E2E
  - **Success Criteria**: Search and filters work correctly on mobile and desktop viewports
  - **Test Data**: Various screen sizes

- [ ] **Test 7.2**: Test keyboard navigation
  - **Test Type**: E2E
  - **Success Criteria**: All filter controls accessible via keyboard
  - **Test Data**: Tab/Enter/Space key navigation

#### Task 8: Documentation Update
- [ ] Implementation complete
  - **Description**: Update project documentation with new endpoints and features
  - **Files**:
    - `DOCS/API/INTERNAL_API.md`
    - `DOCS/API/API_QUICK_REFERENCE.md`
    - `.claude/CLAUDE.md`
  - **Dependencies**: All previous tasks
  - **Technical Approach**:
    - Document new query parameters for GET /api/entries endpoints
    - Add examples of search and filter API calls
    - Update quick reference tables
    - Document new frontend components
    - Add usage examples
- [ ] **Test 8.1**: Documentation completeness check
  - **Test Type**: Manual review
  - **Success Criteria**: All new endpoints and parameters documented with examples
  - **Test Data**: N/A

---

### Integration Testing
- [ ] **Integration Test 1**: Full search workflow
  - **Purpose**: Validate complete search functionality across all entry types
  - **Components Involved**: SearchBar, AccountingApp, entryService, EntryController, EntryModel
  - **Success Criteria**:
    - User can type in search bar
    - Results update after 300ms debounce
    - Search works in Income, Expenses, Salaries tabs
    - Correct entries are returned
    - Results count is accurate

- [ ] **Integration Test 2**: Full filter workflow
  - **Purpose**: Validate complete filtering functionality with all filter types
  - **Components Involved**: FilterPanel, AccountingApp, entryService, EntryController, EntryModel
  - **Success Criteria**:
    - All filter controls work independently
    - Multiple filters can be combined
    - Clear all filters resets correctly
    - Active filter count updates
    - Correct entries are returned

- [ ] **Integration Test 3**: Combined search and filter
  - **Purpose**: Validate search and filters work together correctly
  - **Components Involved**: SearchBar, FilterPanel, AccountingApp, entryService, EntryController, EntryModel
  - **Success Criteria**:
    - Search + category filter works
    - Search + amount range works
    - Search + employee filter works
    - All combinations return correct results

- [ ] **Integration Test 4**: Performance test
  - **Purpose**: Validate debouncing and query optimization
  - **Components Involved**: All components
  - **Success Criteria**:
    - Search debouncing prevents excessive API calls
    - SQL queries execute within acceptable time (<500ms)
    - UI remains responsive during filtering

---

### End-to-End Validation
- [ ] **E2E Test**: Search and Advanced Filtering complete workflow
  - **Test Steps**:
    1. Login to application (rafael / asdflkj@3!)
    2. Navigate to "Expenses" tab
    3. Verify search bar is visible at top of table
    4. Type "office" in search bar
    5. Wait for debounce (300ms)
    6. Verify only entries containing "office" are displayed
    7. Verify results count shows correct number
    8. Click "Filters" to expand filter panel
    9. Select "Software" and "Marketing" categories
    10. Enter amount range: min=100, max=1000
    11. Select "Completed" status
    12. Verify only entries matching all criteria are displayed
    13. Verify active filter count shows "4 filters active"
    14. Click "Clear All Filters"
    15. Verify all filters reset and all entries displayed
    16. Switch to "Income" tab
    17. Verify search and filters work on income entries
    18. Switch to "Salaries" tab
    19. Select an employee from employee filter
    20. Verify only that employee's salary entries displayed
    21. Test on mobile viewport (responsive design)
    22. Verify no console errors
  - **Expected Result**:
    - All search and filter functionality works as specified in PRD
    - UI is responsive and intuitive
    - Performance is acceptable (no lag or delays beyond debounce)
    - No bugs or errors encountered
  - **Validation Points**:
    - Search functionality works across all entry types
    - All filter types work independently and in combination
    - UI provides clear feedback (loading states, results count, empty state)
    - Clear all filters completely resets state
    - Feature works on mobile and desktop
    - Accessibility requirements met (keyboard navigation, ARIA labels)

---

## Estimated Timeline

- **Task 1**: 2 hours
- **Task 2**: 0.5 hours
- **Task 3**: 1.5 hours
- **Task 4**: 2.5 hours
- **Task 5**: 1 hour
- **Task 6**: 2 hours
- **Task 7**: 1 hour
- **Task 8**: 0.5 hours
- **Integration Testing**: 1 hour
- **E2E Testing**: 1 hour

**Total Estimated Time**: 13 hours (with buffer: 15 hours)

---

## Technical Notes

### Database Query Optimization
- Use proper indexes on `entries.description`, `entries.category`, `entries.entry_date` columns
- Parameterized queries to prevent SQL injection
- ILIKE for case-insensitive search (PostgreSQL)
- JOIN with employees table when searching by employee name

### Frontend State Management
- Use single `filters` state object to manage all filter state
- Debounce search using useEffect with cleanup
- Clear timeout on component unmount
- Use URLSearchParams for clean query string building

### Backward Compatibility
- Existing date filters must continue to work
- Existing API calls without search/filter params return all results
- No breaking changes to current functionality

### Performance Considerations
- 300ms debounce prevents excessive API calls during typing
- SQL queries optimized with proper WHERE clauses
- Consider pagination if result sets are very large (future enhancement)
- Cache employee list for dropdown (reuse across sessions)

### Error Handling
- Handle invalid amount ranges (min > max)
- Handle invalid date ranges
- Handle API errors gracefully with user-friendly messages
- Log errors for debugging

---

**Created**: October 28, 2025
**Status**: Ready for Implementation
**Assigned To**: Feature Supervisor Agent
