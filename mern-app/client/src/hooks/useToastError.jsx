import toast from 'react-hot-toast';

/**
 * Toast-based replacement for the original app's ErrorContext. Same call
 * shape ({ message, severity, retryAction }) so ported pages stay close to
 * the source. Severity maps to toast style; retryAction renders a button.
 */
export function useToastError() {
  const showError = ({ message, severity = 'error', retryAction }) => {
    if (severity === 'info') {
      toast(message, { icon: 'ℹ️' });
      return;
    }
    if (severity === 'warning') {
      toast(message, { icon: '⚠️' });
      return;
    }

    if (retryAction) {
      toast.error(
        (t) => (
          <span className="flex items-center gap-3">
            {message}
            <button
              className="font-bold text-indigo-600 hover:text-indigo-800"
              onClick={() => {
                toast.dismiss(t.id);
                retryAction();
              }}
            >
              Try Again
            </button>
          </span>
        ),
        { duration: 10000 }
      );
    } else {
      toast.error(message);
    }
  };

  return { showError };
}
