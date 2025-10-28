import toast from 'react-hot-toast';

/**
 * Show success toast notification
 * @param {string} message - Success message to display
 */
export const showSuccess = (message) => {
  toast.success(message, {
    duration: 3000,
    position: 'top-right',
    style: {
      background: '#10b981',
      color: '#fff',
    },
  });
};

/**
 * Show error toast notification
 * @param {string} message - Error message to display
 */
export const showError = (message) => {
  toast.error(message, {
    duration: 4000,
    position: 'top-right',
    style: {
      background: '#ef4444',
      color: '#fff',
    },
  });
};

/**
 * Show loading toast notification
 * @param {string} message - Loading message to display
 * @returns {string} Toast ID for dismissal
 */
export const showLoading = (message) => {
  return toast.loading(message, {
    position: 'top-right',
  });
};

/**
 * Dismiss a specific toast by ID
 * @param {string} toastId - The ID of the toast to dismiss
 */
export const dismissToast = (toastId) => {
  toast.dismiss(toastId);
};

/**
 * Update an existing loading toast to success
 * @param {string} toastId - The ID of the toast to update
 * @param {string} message - Success message
 */
export const updateToastSuccess = (toastId, message) => {
  toast.success(message, {
    id: toastId,
    duration: 3000,
  });
};

/**
 * Update an existing loading toast to error
 * @param {string} toastId - The ID of the toast to update
 * @param {string} message - Error message
 */
export const updateToastError = (toastId, message) => {
  toast.error(message, {
    id: toastId,
    duration: 4000,
  });
};

export default {
  showSuccess,
  showError,
  showLoading,
  dismissToast,
  updateToastSuccess,
  updateToastError,
};
