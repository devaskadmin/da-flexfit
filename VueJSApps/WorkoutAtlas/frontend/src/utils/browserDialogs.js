import Swal from 'sweetalert2';

const buildConfirmOptions = (message, options = {}) => ({
  title: options.title || 'Please confirm',
  text: message,
  icon: options.icon || 'warning',
  showCancelButton: true,
  confirmButtonText: options.confirmButtonText || 'Confirm',
  ...(options.confirmButtonColor ? { confirmButtonColor: options.confirmButtonColor } : {}),
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

export const showWorkoutSessionConflictDialog = async ({
  title = 'You Have a Workout in Progress',
  message = 'You already have a workout started. Would you like to continue your existing workout or end it and start a new one?',
} = {}) => {
  const result = await Swal.fire({
    title,
    text: message,
    icon: 'warning',
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: 'Continue Existing Workout',
    denyButtonText: 'End Existing & Start New Workout',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
    allowOutsideClick: false,
    allowEscapeKey: true,
  });

  if (result?.isConfirmed) {
    return 'continue';
  }

  if (result?.isDenied) {
    return 'end_and_start_new';
  }

  return 'cancel';
};
