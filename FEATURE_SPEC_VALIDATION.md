# Data Validation & Error Feedback System

## Product Requirements Document (PRD)

### Overview
Implement comprehensive data validation and user feedback system across the accounting application to improve user experience, prevent data entry errors, and provide clear, actionable feedback for all operations. This includes real-time validation, toast notifications, loading states, and standardized error handling.

### User Stories
- As a user, I want to see which fields are required before I start filling out a form, so I don't waste time
- As a user, I want to see validation errors as I type, so I can fix issues immediately
- As a user, I want to see why my entry failed to save with specific field-level errors
- As a user, I want confirmation when my action succeeds, so I know it worked
- As a user, I want to see loading indicators, so I know the app is working and I don't click multiple times
- As a user, I want clear, helpful error messages (not technical jargon), so I can understand and fix issues

### Functional Requirements
1. **Required Field Indicators**: All required fields must display asterisk (*) next to label
2. **Real-time Validation**: Validate fields as user types (debounced to avoid excessive checking)
3. **Inline Error Messages**: Display field-specific errors below the input with red border
4. **Submit Prevention**: Disable submit buttons when validation errors exist
5. **Success Notifications**: Show toast notification for all successful operations (create, update, delete, bulk)
6. **Error Notifications**: Show toast notification for all failed operations with specific reason
7. **Loading States**: Disable buttons and show spinner during API calls
8. **Structured Backend Errors**: Return consistent error format with field names and codes
9. **Validation Coverage**: All forms must have validation (entries, employees, contracts)

### Technical Requirements
- **Frontend**: React 18, Vite 5, Tailwind CSS 3.3 (existing stack)
- **Toast Library**: react-hot-toast (lightweight, easy to integrate)
- **Validation Strategy**: Custom hooks (no additional form library dependencies)
- **Backend**: Express middleware for centralized error handling
- **Error Format**: JSON with `{ error: string, field?: string, code?: string }`
- **Performance**: Debounced validation (300ms delay) to avoid excessive re-renders

### Acceptance Criteria
- [ ] All required fields marked with asterisk (*) in all forms
- [ ] Real-time validation shows errors as user types (debounced 300ms)
- [ ] Invalid fields have red border and error message below field
- [ ] Submit button disabled while validation errors exist or during loading
- [ ] Success toast notifications appear for all successful actions (auto-dismiss 3 seconds)
- [ ] Error toast notifications appear for all failed actions with clear message
- [ ] Loading spinners show on buttons during API calls
- [ ] Buttons disabled during loading to prevent double-submit
- [ ] Backend returns structured error responses (400 for validation, 404 for not found, 409 for conflicts, 500 for server errors)
- [ ] All forms have consistent validation behavior (entries, employees, contracts)
- [ ] Validation messages are clear and actionable (e.g., "Amount must be greater than 0" not "Invalid input")
- [ ] No technical error messages or stack traces shown to users
- [ ] Email format validation for employee email field
- [ ] Date validation for valid date formats and ranges
- [ ] Amount validation for positive numbers only
- [ ] Foreign key validation (employee_id, contract_id must exist)

---

## Implementation Plan

### Tasks

#### Task 1: Install and Configure Toast Notification System
- [ ] Implementation complete
  - **Description**: Install react-hot-toast library and create centralized toast configuration
  - **Files**:
    - `frontend/package.json` (add dependency)
    - `frontend/src/utils/toast.js` (new file - toast wrapper)
    - `frontend/src/components/App.jsx` (add Toaster component)
  - **Dependencies**: None
  - **Technical Approach**:
    - Install react-hot-toast: `npm install react-hot-toast`
    - Create toast utility with success/error/loading helpers
    - Add Toaster component to App.jsx root
    - Configure default options (position, duration, styling)
- [ ] **Test 1.1**: Toast notification displays and auto-dismisses
  - **Test Type**: Integration
  - **Success Criteria**: Toast appears on screen, displays message, auto-dismisses after 3 seconds
  - **Test Data**: Test with success and error message variants

#### Task 2: Create Frontend Validation Utilities
- [ ] Implementation complete
  - **Description**: Build reusable validation functions and custom hooks for form validation
  - **Files**:
    - `frontend/src/utils/validation.js` (new file - validation functions)
    - `frontend/src/hooks/useFormValidation.js` (new file - validation hook)
  - **Dependencies**: Task 1 (for error toast integration)
  - **Technical Approach**:
    - Create validation functions: isValidEmail, isValidAmount, isValidDate, isRequired
    - Build useFormValidation hook with state management and debouncing
    - Return validation state, errors object, and validation trigger functions
    - Implement debounced validation (300ms delay)
- [ ] **Test 2.1**: Validation functions return correct results
  - **Test Type**: Unit
  - **Success Criteria**:
    - isValidEmail returns true for valid emails, false for invalid
    - isValidAmount returns true for positive numbers, false for zero/negative
    - isValidDate returns true for valid dates, false for invalid formats
    - isRequired returns true for non-empty values
  - **Test Data**: Valid/invalid emails, amounts, dates, empty/filled fields

- [ ] **Test 2.2**: useFormValidation hook manages validation state
  - **Test Type**: Integration
  - **Success Criteria**:
    - Hook returns errors object with field-specific errors
    - Validation is debounced (doesn't trigger immediately on keystroke)
    - isValid flag correctly reflects form state
  - **Test Data**: Mock form with multiple fields and validation rules

#### Task 3: Create Backend Error Handling Middleware
- [ ] Implementation complete
  - **Description**: Build centralized error handling middleware for consistent error responses
  - **Files**:
    - `backend/src/middleware/errorHandler.js` (new file)
    - `backend/src/utils/ApiError.js` (new file - custom error class)
    - `backend/src/server.js` (register middleware)
  - **Dependencies**: None
  - **Technical Approach**:
    - Create ApiError class extending Error with statusCode and field properties
    - Build error handler middleware catching all errors
    - Format errors consistently: { error: string, field?: string, code?: string }
    - Set appropriate HTTP status codes (400, 404, 409, 500)
    - Sanitize error messages (no stack traces in production)
- [ ] **Test 3.1**: Error middleware formats errors correctly
  - **Test Type**: Integration
  - **Success Criteria**:
    - 400 errors return validation error format
    - 404 errors return "not found" message
    - 500 errors return generic message without stack trace
    - All errors have consistent JSON structure
  - **Test Data**: Trigger various error types via API endpoints

#### Task 4: Add Backend Validation to Entry Endpoints
- [ ] Implementation complete
  - **Description**: Add comprehensive validation to all entry creation/update endpoints
  - **Files**:
    - `backend/src/controllers/entryController.js` (add validation)
    - `backend/src/utils/entryValidation.js` (new file - validation logic)
  - **Dependencies**: Task 3 (error handling middleware)
  - **Technical Approach**:
    - Validate required fields: type, category, description, base_amount, total, entry_date
    - Validate data types: base_amount > 0, total > 0, valid date format
    - Validate references: employee_id exists (if provided), contract_id exists (if provided)
    - Return ApiError with field name for specific validation failures
    - Prevent duplicate entries where applicable
- [ ] **Test 4.1**: Entry validation rejects invalid data
  - **Test Type**: Integration
  - **Success Criteria**:
    - POST /api/entries returns 400 for missing required fields
    - Returns 400 for negative amounts
    - Returns 400 for invalid date formats
    - Returns 404 for non-existent employee_id
    - Returns 200 for valid entry data
  - **Test Data**: Valid and invalid entry payloads

#### Task 5: Add Backend Validation to Employee Endpoints
- [ ] Implementation complete
  - **Description**: Add comprehensive validation to all employee creation/update endpoints
  - **Files**:
    - `backend/src/controllers/employeeController.js` (add validation)
    - `backend/src/utils/employeeValidation.js` (new file - validation logic)
  - **Dependencies**: Task 3 (error handling middleware)
  - **Technical Approach**:
    - Validate required fields: name, pay_type, pay_rate, start_date
    - Validate email format (if provided)
    - Validate pay_rate > 0
    - Validate pay_type is one of: monthly, weekly, hourly
    - Validate start_date is valid date format
    - Check for duplicate emails
    - Return ApiError with field name for specific failures
- [ ] **Test 5.1**: Employee validation rejects invalid data
  - **Test Type**: Integration
  - **Success Criteria**:
    - POST /api/employees returns 400 for missing required fields
    - Returns 400 for invalid email format
    - Returns 400 for negative pay_rate
    - Returns 400 for invalid pay_type
    - Returns 409 for duplicate email
    - Returns 200 for valid employee data
  - **Test Data**: Valid and invalid employee payloads

#### Task 6: Add Backend Validation to Contract Endpoints
- [ ] Implementation complete
  - **Description**: Add comprehensive validation to all contract creation/update endpoints
  - **Files**:
    - `backend/src/controllers/contractController.js` (add validation)
    - `backend/src/utils/contractValidation.js` (new file - validation logic)
  - **Dependencies**: Task 3 (error handling middleware)
  - **Technical Approach**:
    - Validate required fields: client_name, amount, contract_type, start_date
    - Validate amount > 0
    - Validate contract_type is one of: monthly, yearly, one-time
    - Validate payment_day is between 1-31 (if provided)
    - Validate start_date is valid date format
    - Validate end_date > start_date (if provided)
    - Return ApiError with field name for specific failures
- [ ] **Test 6.1**: Contract validation rejects invalid data
  - **Test Type**: Integration
  - **Success Criteria**:
    - POST /api/contracts returns 400 for missing required fields
    - Returns 400 for negative amount
    - Returns 400 for invalid contract_type
    - Returns 400 for payment_day outside 1-31 range
    - Returns 400 for end_date before start_date
    - Returns 200 for valid contract data
  - **Test Data**: Valid and invalid contract payloads

#### Task 7: Enhance EmployeeForm Component with Validation
- [ ] Implementation complete
  - **Description**: Add real-time validation, error messages, and loading states to employee form
  - **Files**:
    - `frontend/src/components/EmployeeForm.jsx` (enhance with validation)
  - **Dependencies**: Task 1 (toast), Task 2 (validation utilities)
  - **Technical Approach**:
    - Use useFormValidation hook for validation state
    - Add asterisk (*) to required field labels
    - Add red border and error message for invalid fields
    - Show inline error messages below each field
    - Disable submit button when validation errors exist
    - Add loading state during API call with spinner
    - Show success toast on successful create/update
    - Show error toast with backend error message on failure
- [ ] **Test 7.1**: Employee form validation works end-to-end
  - **Test Type**: E2E
  - **Success Criteria**:
    - Required fields show asterisk
    - Typing in field triggers validation after 300ms
    - Invalid fields show red border and error message
    - Submit button disabled when errors exist
    - Loading spinner shows during API call
    - Success toast appears on successful save
    - Error toast appears on validation failure with specific message
  - **Test Data**: Create/update employee with valid and invalid data

#### Task 8: Enhance ContractForm Component with Validation
- [ ] Implementation complete
  - **Description**: Add real-time validation, error messages, and loading states to contract form
  - **Files**:
    - `frontend/src/components/ContractForm.jsx` (enhance with validation)
  - **Dependencies**: Task 1 (toast), Task 2 (validation utilities)
  - **Technical Approach**:
    - Use useFormValidation hook for validation state
    - Add asterisk (*) to required field labels
    - Add red border and error message for invalid fields
    - Show inline error messages below each field
    - Disable submit button when validation errors exist
    - Add loading state during API call with spinner
    - Show success toast on successful create/update
    - Show error toast with backend error message on failure
- [ ] **Test 8.1**: Contract form validation works end-to-end
  - **Test Type**: E2E
  - **Success Criteria**:
    - Required fields show asterisk
    - Typing in field triggers validation after 300ms
    - Invalid fields show red border and error message
    - Submit button disabled when errors exist
    - Loading spinner shows during API call
    - Success toast appears on successful save
    - Error toast appears on validation failure with specific message
  - **Test Data**: Create/update contract with valid and invalid data

#### Task 9: Add Validation to Entry Creation/Edit in AccountingApp
- [ ] Implementation complete
  - **Description**: Add real-time validation and feedback to entry forms in main app component
  - **Files**:
    - `frontend/src/components/AccountingApp.jsx` (enhance entry forms)
  - **Dependencies**: Task 1 (toast), Task 2 (validation utilities)
  - **Technical Approach**:
    - Use useFormValidation hook for entry form validation
    - Add asterisk (*) to required field labels (type, category, description, amount, date)
    - Add red border and error message for invalid fields
    - Show inline error messages below each field
    - Disable submit button when validation errors exist
    - Add loading state during API call with spinner
    - Show success toast on successful create/update/delete
    - Show error toast with backend error message on failure
- [ ] **Test 9.1**: Entry form validation works end-to-end
  - **Test Type**: E2E
  - **Success Criteria**:
    - Required fields show asterisk
    - Typing in field triggers validation after 300ms
    - Invalid fields show red border and error message
    - Submit button disabled when errors exist
    - Loading spinner shows during API call
    - Success toast appears on successful save/delete
    - Error toast appears on validation failure with specific message
  - **Test Data**: Create/update/delete entry with valid and invalid data

#### Task 10: Add Toast Notifications to All Bulk Operations
- [ ] Implementation complete
  - **Description**: Add success/error toast notifications to all bulk operations across the app
  - **Files**:
    - `frontend/src/components/AccountingApp.jsx` (bulk entry operations)
    - `frontend/src/components/EmployeeList.jsx` (bulk employee operations)
  - **Dependencies**: Task 1 (toast)
  - **Technical Approach**:
    - Add loading toast during bulk operations (toast.loading)
    - Update to success toast on completion (toast.success)
    - Update to error toast on failure (toast.error)
    - Include count of affected items in success message
    - Show specific error message from backend on failure
    - Disable bulk action buttons during operation
- [ ] **Test 10.1**: Bulk operation toasts work correctly
  - **Test Type**: Integration
  - **Success Criteria**:
    - Loading toast shows during bulk delete/update
    - Success toast shows count of affected items (e.g., "3 entries deleted")
    - Error toast shows if bulk operation fails
    - Bulk action buttons disabled during operation
  - **Test Data**: Select multiple entries/employees and perform bulk operations

#### Task 11: Add Loading States to All API Calls
- [ ] Implementation complete
  - **Description**: Ensure all buttons making API calls show loading state and are disabled during operation
  - **Files**:
    - `frontend/src/components/DashboardView.jsx` (dashboard actions)
    - `frontend/src/components/WiseImport.jsx` (import operations)
    - `frontend/src/components/SalaryCalendar.jsx` (calendar actions)
  - **Dependencies**: None
  - **Technical Approach**:
    - Add loading state variable for each async operation
    - Set loading=true before API call, false after completion/error
    - Disable button when loading=true
    - Show spinner icon on button during loading
    - Prevent double-submission by checking loading state
- [ ] **Test 11.1**: Loading states prevent double-submission
  - **Test Type**: Integration
  - **Success Criteria**:
    - Button shows spinner during API call
    - Button is disabled and cannot be clicked multiple times
    - Loading state clears after success or error
    - Multiple rapid clicks don't trigger multiple API calls
  - **Test Data**: Test rapid clicking on action buttons

---

### Integration Testing
- [ ] **Integration Test 1**: Complete form submission flow with validation
  - **Purpose**: Validate entire user flow from form entry to backend validation to UI feedback
  - **Components Involved**: EmployeeForm, employeeService, employeeController, errorHandler middleware, toast notifications
  - **Success Criteria**:
    - User sees required field indicators before typing
    - Real-time validation shows errors as user types
    - Submit button disabled when errors exist
    - Backend validation catches invalid data
    - User sees specific error message in toast notification
    - Valid submission shows success toast and closes form

- [ ] **Integration Test 2**: Error handling across all form types
  - **Purpose**: Ensure consistent error handling behavior across entries, employees, and contracts
  - **Components Involved**: All forms, all controllers, errorHandler middleware, toast system
  - **Success Criteria**:
    - All forms show consistent validation behavior
    - All forms show consistent error messages
    - All forms show consistent loading states
    - Backend errors are properly formatted and displayed

- [ ] **Integration Test 3**: Bulk operations with feedback
  - **Purpose**: Validate bulk operation feedback and error handling
  - **Components Involved**: AccountingApp, EmployeeList, bulk endpoints, toast system
  - **Success Criteria**:
    - Bulk operations show loading state
    - Success message includes count of affected items
    - Errors are caught and displayed appropriately
    - UI updates after bulk operation completes

---

### End-to-End Validation
- [ ] **E2E Test**: Complete validation and feedback system
  - **Test Steps**:
    1. Start frontend and backend servers
    2. Login to application
    3. Navigate to Employees tab
    4. Click "Add Employee" button
    5. Observe required field indicators (asterisks)
    6. Start typing in name field (valid input)
    7. Verify no error appears after 300ms
    8. Type invalid email format
    9. Verify email field shows red border and error message below
    10. Clear email field (leave empty)
    11. Verify error message updates to "Email is required" if it's required
    12. Verify submit button is disabled
    13. Fill in valid data for all required fields
    14. Verify submit button becomes enabled
    15. Click submit button
    16. Verify loading spinner appears on button
    17. Verify button is disabled during submission
    18. Verify success toast appears with "Employee created successfully"
    19. Verify form closes
    20. Verify employee appears in list
    21. Repeat test for Contract form and Entry form
    22. Test bulk delete operation with loading and success toast
    23. Submit form with backend validation error (e.g., duplicate email)
    24. Verify error toast appears with specific backend error message
    25. Test all scenarios across entries, employees, and contracts
  - **Expected Result**:
    - All forms show consistent validation behavior
    - Real-time validation works correctly with debouncing
    - Loading states prevent double-submission
    - Success and error toasts provide clear feedback
    - Backend validation errors are displayed to user
    - No technical error messages visible
    - All acceptance criteria are met
  - **Validation Points**:
    - Required field indicators visible
    - Real-time validation triggers correctly
    - Error messages are clear and actionable
    - Loading states work properly
    - Toast notifications appear and dismiss correctly
    - Backend validation catches invalid data
    - Consistent behavior across all forms

---

## Estimated Timeline

- **Task 1**: 1 hour (install library, create toast wrapper)
- **Task 2**: 2 hours (validation functions + custom hook)
- **Task 3**: 1.5 hours (error middleware + ApiError class)
- **Task 4**: 1.5 hours (entry validation)
- **Task 5**: 1.5 hours (employee validation)
- **Task 6**: 1.5 hours (contract validation)
- **Task 7**: 2 hours (enhance EmployeeForm)
- **Task 8**: 2 hours (enhance ContractForm)
- **Task 9**: 2.5 hours (enhance AccountingApp entry forms)
- **Task 10**: 1.5 hours (bulk operation toasts)
- **Task 11**: 1.5 hours (loading states)
- **Integration Testing**: 1.5 hours
- **E2E Testing**: 1.5 hours

**Total Estimated Time**: 21.5 hours (with buffer: 24 hours)

---

## Technical Notes

### React Hook Implementation
```javascript
// frontend/src/hooks/useFormValidation.js
import { useState, useEffect, useCallback } from 'react';

export const useFormValidation = (formData, validationRules) => {
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isValidating, setIsValidating] = useState(false);

  const validateField = useCallback((fieldName, value) => {
    const rules = validationRules[fieldName];
    if (!rules) return null;

    for (const rule of rules) {
      const error = rule(value);
      if (error) return error;
    }
    return null;
  }, [validationRules]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsValidating(true);
      const newErrors = {};

      Object.keys(formData).forEach(field => {
        if (touched[field]) {
          const error = validateField(field, formData[field]);
          if (error) newErrors[field] = error;
        }
      });

      setErrors(newErrors);
      setIsValidating(false);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [formData, touched, validateField]);

  const touchField = (fieldName) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }));
  };

  const isValid = Object.keys(errors).length === 0 && Object.keys(touched).length > 0;

  return { errors, isValid, touchField, isValidating };
};
```

### Backend Error Class
```javascript
// backend/src/utils/ApiError.js
class ApiError extends Error {
  constructor(message, statusCode, field = null, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.field = field;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
```

### Error Handler Middleware
```javascript
// backend/src/middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Don't leak stack traces in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'An unexpected error occurred';
  }

  const response = {
    error: message,
    ...(err.field && { field: err.field }),
    ...(err.code && { code: err.code })
  };

  // Log error for debugging
  console.error('Error:', err);

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
```

### Toast Configuration
```javascript
// frontend/src/utils/toast.js
import toast from 'react-hot-toast';

export const showSuccess = (message) => {
  toast.success(message, {
    duration: 3000,
    position: 'top-right',
  });
};

export const showError = (message) => {
  toast.error(message, {
    duration: 4000,
    position: 'top-right',
  });
};

export const showLoading = (message) => {
  return toast.loading(message, {
    position: 'top-right',
  });
};

export const dismissToast = (toastId) => {
  toast.dismiss(toastId);
};
```

### Validation Functions
```javascript
// frontend/src/utils/validation.js

export const isRequired = (value) => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return 'This field is required';
  }
  return null;
};

export const isValidEmail = (value) => {
  if (!value) return null; // Only validate if value exists
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return 'Please enter a valid email address';
  }
  return null;
};

export const isValidAmount = (value) => {
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) {
    return 'Amount must be greater than 0';
  }
  return null;
};

export const isValidDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return 'Please enter a valid date';
  }
  return null;
};

export const isInRange = (min, max) => (value) => {
  const num = parseFloat(value);
  if (isNaN(num)) return 'Please enter a valid number';
  if (num < min || num > max) {
    return `Value must be between ${min} and ${max}`;
  }
  return null;
};
```

---

**Created**: October 28, 2025
**Status**: Ready for Implementation
**Estimated Effort**: 24 hours (with buffer)
