import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for form validation with debouncing
 * @param {object} formData - Current form data object
 * @param {object} validationRules - Object mapping field names to arrays of validator functions
 * @param {number} debounceMs - Debounce delay in milliseconds (default: 300)
 * @returns {object} Validation state and helper functions
 */
export const useFormValidation = (formData, validationRules, debounceMs = 300) => {
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isValidating, setIsValidating] = useState(false);

  /**
   * Validate a single field
   * @param {string} fieldName - Name of the field to validate
   * @param {any} value - Value to validate
   * @returns {string|null} Error message or null if valid
   */
  const validateField = useCallback((fieldName, value) => {
    const rules = validationRules[fieldName];
    if (!rules) return null;

    // Handle both single validator function and array of validators
    const validators = Array.isArray(rules) ? rules : [rules];

    for (const validator of validators) {
      const error = validator(value);
      if (error) return error;
    }
    return null;
  }, [validationRules]);

  /**
   * Debounced validation effect
   * Validates all touched fields after debounce delay
   */
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
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [formData, touched, validateField, debounceMs]);

  /**
   * Mark a field as touched
   * @param {string} fieldName - Name of the field to mark as touched
   */
  const touchField = useCallback((fieldName) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }));
  }, []);

  /**
   * Mark multiple fields as touched
   * @param {array} fieldNames - Array of field names to mark as touched
   */
  const touchFields = useCallback((fieldNames) => {
    setTouched(prev => {
      const updated = { ...prev };
      fieldNames.forEach(name => {
        updated[name] = true;
      });
      return updated;
    });
  }, []);

  /**
   * Mark all fields as touched (useful for submit validation)
   */
  const touchAllFields = useCallback(() => {
    const allFields = Object.keys(formData);
    touchFields(allFields);
  }, [formData, touchFields]);

  /**
   * Reset validation state
   */
  const resetValidation = useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  /**
   * Validate all fields immediately (without debounce)
   * @returns {boolean} True if all fields are valid
   */
  const validateAll = useCallback(() => {
    const newErrors = {};
    const allFields = Object.keys(validationRules);

    allFields.forEach(field => {
      const error = validateField(field, formData[field]);
      if (error) newErrors[field] = error;
    });

    setErrors(newErrors);
    setTouched(
      allFields.reduce((acc, field) => ({ ...acc, [field]: true }), {})
    );

    return Object.keys(newErrors).length === 0;
  }, [formData, validationRules, validateField]);

  /**
   * Check if form is valid
   * - Returns true only if there are no errors AND at least one field has been touched
   */
  const isValid = Object.keys(errors).length === 0 && Object.keys(touched).length > 0;

  /**
   * Check if a specific field has an error
   * @param {string} fieldName - Name of the field to check
   * @returns {boolean} True if field has an error
   */
  const hasError = useCallback((fieldName) => {
    return touched[fieldName] && !!errors[fieldName];
  }, [touched, errors]);

  /**
   * Get error message for a specific field
   * @param {string} fieldName - Name of the field
   * @returns {string|null} Error message or null if no error
   */
  const getError = useCallback((fieldName) => {
    return touched[fieldName] ? errors[fieldName] : null;
  }, [touched, errors]);

  return {
    errors,
    touched,
    isValid,
    isValidating,
    touchField,
    touchFields,
    touchAllFields,
    resetValidation,
    validateAll,
    hasError,
    getError,
  };
};

export default useFormValidation;
