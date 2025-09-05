import { useState, useCallback } from "react";
import { Toast } from "../components/Toast";

export function useToast() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  const hideToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  const ToastComponent = toastMessage ? (
    <Toast message={toastMessage} onClose={hideToast} />
  ) : null;

  return { showToast, ToastComponent };
}
