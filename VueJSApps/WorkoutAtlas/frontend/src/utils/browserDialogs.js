import Swal from 'sweetalert2';

const buildConfirmOptions = (message, options = {}) => ({
  title: options.title || 'Please confirm',
  text: message,
  icon: options.icon || 'warning',
  showCancelButton: true,
  confirmButtonText: options.confirmButtonText || 'Confirm',
  cancelButtonText: options.cancelButtonText || 'Cancel',
  reverseButtons: options.reverseButtons !== false,
  focusCancel: options.focusCancel !== false,
  allowOutsideClick: options.allowOutsideClick ?? false,
  allowEscapeKey: options.allowEscapeKey ?? true,
});

const buildAlertOptions = (message, options = {}) => ({
  title: options.title || 'Notice',
  text: message,
  icon: options.icon || 'info',
  confirmButtonText: options.confirmButtonText || 'OK',
  allowOutsideClick: options.allowOutsideClick ?? true,
  allowEscapeKey: options.allowEscapeKey ?? true,
});

export const showConfirmDialog = async (message, options = {}) => {
  const result = await Swal.fire(buildConfirmOptions(message, options));
  return Boolean(result?.isConfirmed);
};

export const showAlertDialog = async (message, options = {}) => {
  await Swal.fire(buildAlertOptions(message, options));
};
