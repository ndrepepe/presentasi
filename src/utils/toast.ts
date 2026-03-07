import { toast } from "sonner";

export const showSuccess = (message: string) => {
  toast.success(message, {
    duration: 2000,
  });
};

export const showError = (message: string) => {
  toast.error(message, {
    duration: 2000,
  });
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};