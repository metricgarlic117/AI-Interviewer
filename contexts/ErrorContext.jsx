"use client";
import React, { createContext, useContext, useState, useCallback } from "react";
import { ErrorSeverity, ErrorCode } from "../types";

const ErrorContext = createContext(undefined);

export const ErrorProvider = ({ children }) => {
  const [error, setError] = useState(null);

  const showError = useCallback((partialError) => {
    const fullError = {
      code: partialError.code || ErrorCode.UNKNOWN_ERROR,
      message: partialError.message || "An unexpected error occurred.",
      severity: partialError.severity || ErrorSeverity.ERROR,
      retryAction: partialError.retryAction,
      originalError: partialError.originalError,
    };

    console.error(
      `[AppError] ${fullError.code}:`,
      fullError.message,
      fullError.originalError,
    );
    setError(fullError);

    // Auto-dismiss info and warning messages
    if (
      fullError.severity === ErrorSeverity.INFO ||
      fullError.severity === ErrorSeverity.WARNING
    ) {
      setTimeout(() => {
        setError((prev) => (prev === fullError ? null : prev));
      }, 5000);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <ErrorContext.Provider value={{ error, showError, clearError }}>
      {children}
      {/* Global Toast Notification */}
      {error && (
        <div
          className={`fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white rounded-xl shadow-2xl border-l-4 overflow-hidden animate-slide-up ${
            error.severity === ErrorSeverity.FATAL
              ? "border-red-600"
              : error.severity === ErrorSeverity.ERROR
                ? "border-red-500"
                : error.severity === ErrorSeverity.WARNING
                  ? "border-amber-500"
                  : "border-blue-500"
          }`}
        >
          <div className="p-4 flex items-start gap-4">
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                error.severity === ErrorSeverity.FATAL ||
                error.severity === ErrorSeverity.ERROR
                  ? "bg-red-100 text-red-600"
                  : error.severity === ErrorSeverity.WARNING
                    ? "bg-amber-100 text-amber-600"
                    : "bg-blue-100 text-blue-600"
              }`}
            >
              <i
                className={`fa-solid ${
                  error.severity === ErrorSeverity.FATAL
                    ? "fa-bomb"
                    : error.severity === ErrorSeverity.ERROR
                      ? "fa-circle-exclamation"
                      : error.severity === ErrorSeverity.WARNING
                        ? "fa-triangle-exclamation"
                        : "fa-circle-info"
                }`}
              ></i>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-900">
                {error.severity === ErrorSeverity.FATAL
                  ? "Critical Error"
                  : error.severity === ErrorSeverity.ERROR
                    ? "Error"
                    : error.severity === ErrorSeverity.WARNING
                      ? "Warning"
                      : "Info"}
              </h3>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                {error.message}
              </p>

              <div className="flex gap-3 mt-3">
                {error.retryAction && (
                  <button
                    onClick={() => {
                      error.retryAction();
                      clearError();
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    Try Again
                  </button>
                )}
                <button
                  onClick={clearError}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ErrorContext.Provider>
  );
};

export const useError = () => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error("useError must be used within an ErrorProvider");
  }
  return context;
};

export const useErrorHandler = () => {
  return useContext(ErrorContext);
};
