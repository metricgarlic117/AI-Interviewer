/**
 * White Box Unit Tests: contexts/ErrorContext.tsx
 * Tests useError hook, ErrorProvider state management, and toast behavior.
 */

import React from 'react';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { ErrorProvider, useError } from '../../contexts/ErrorContext';
import { ErrorCode, ErrorSeverity } from '../../types';

// Helper component that uses the hook to trigger errors
const ErrorTrigger = ({
    code,
    message,
    severity,
    retryAction,
}: {
    code?: ErrorCode;
    message?: string;
    severity?: ErrorSeverity;
    retryAction?: () => void;
}) => {
    const { showError, clearError, error } = useError();
    return (
        <div>
            <span data-testid="error-message">{error?.message || 'none'}</span>
            <span data-testid="error-code">{error?.code || 'none'}</span>
            <button
                data-testid="trigger-error"
                onClick={() => showError({ code, message, severity, retryAction })}
            >
                Trigger
            </button>
            <button data-testid="clear-error" onClick={clearError}>
                Clear
            </button>
        </div>
    );
};

describe('useError hook', () => {
    it('throws when used outside ErrorProvider', () => {
        // Suppress expected console.error from React
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        expect(() => render(<ErrorTrigger />)).toThrow(
            'useError must be used within an ErrorProvider'
        );
        consoleSpy.mockRestore();
    });
});

describe('ErrorProvider', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    it('renders children without error initially', () => {
        render(
            <ErrorProvider>
                <div data-testid="child">Hello</div>
            </ErrorProvider>
        );
        expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('shows error with default code and severity when not provided', () => {
        render(
            <ErrorProvider>
                <ErrorTrigger message="Something went wrong" />
            </ErrorProvider>
        );

        act(() => {
            fireEvent.click(screen.getByTestId('trigger-error'));
        });

        expect(screen.getByTestId('error-code').textContent).toBe(ErrorCode.UNKNOWN_ERROR);
        expect(screen.getByTestId('error-message').textContent).toBe('Something went wrong');
    });

    it('shows error with the provided code and severity', () => {
        render(
            <ErrorProvider>
                <ErrorTrigger
                    code={ErrorCode.GEMINI_API_ERROR}
                    message="Gemini unavailable"
                    severity={ErrorSeverity.ERROR}
                />
            </ErrorProvider>
        );

        act(() => {
            fireEvent.click(screen.getByTestId('trigger-error'));
        });

        expect(screen.getByTestId('error-code').textContent).toBe(ErrorCode.GEMINI_API_ERROR);
    });

    it('uses "An unexpected error occurred." as default message when none provided', () => {
        render(
            <ErrorProvider>
                <ErrorTrigger />
            </ErrorProvider>
        );

        act(() => {
            fireEvent.click(screen.getByTestId('trigger-error'));
        });

        expect(screen.getByTestId('error-message').textContent).toBe('An unexpected error occurred.');
    });

    it('clearError resets error to null', () => {
        render(
            <ErrorProvider>
                <ErrorTrigger message="Test error" />
            </ErrorProvider>
        );

        act(() => {
            fireEvent.click(screen.getByTestId('trigger-error'));
        });
        expect(screen.getByTestId('error-message').textContent).toBe('Test error');

        act(() => {
            fireEvent.click(screen.getByTestId('clear-error'));
        });
        expect(screen.getByTestId('error-message').textContent).toBe('none');
    });

    it('auto-dismisses INFO severity errors after 5 seconds', () => {
        render(
            <ErrorProvider>
                <ErrorTrigger severity={ErrorSeverity.INFO} message="Info message" />
            </ErrorProvider>
        );

        act(() => {
            fireEvent.click(screen.getByTestId('trigger-error'));
        });
        expect(screen.getByTestId('error-message').textContent).toBe('Info message');

        act(() => {
            jest.advanceTimersByTime(5000);
        });

        expect(screen.getByTestId('error-message').textContent).toBe('none');
    });

    it('auto-dismisses WARNING severity errors after 5 seconds', () => {
        render(
            <ErrorProvider>
                <ErrorTrigger severity={ErrorSeverity.WARNING} message="Warning message" />
            </ErrorProvider>
        );

        act(() => {
            fireEvent.click(screen.getByTestId('trigger-error'));
        });

        act(() => {
            jest.advanceTimersByTime(5000);
        });

        expect(screen.getByTestId('error-message').textContent).toBe('none');
    });

    it('does NOT auto-dismiss ERROR severity errors', () => {
        render(
            <ErrorProvider>
                <ErrorTrigger severity={ErrorSeverity.ERROR} message="Error message" />
            </ErrorProvider>
        );

        act(() => {
            fireEvent.click(screen.getByTestId('trigger-error'));
        });

        act(() => {
            jest.advanceTimersByTime(10000);
        });

        expect(screen.getByTestId('error-message').textContent).toBe('Error message');
    });

    it('does NOT auto-dismiss FATAL severity errors', () => {
        render(
            <ErrorProvider>
                <ErrorTrigger severity={ErrorSeverity.FATAL} message="Fatal error" />
            </ErrorProvider>
        );

        act(() => {
            fireEvent.click(screen.getByTestId('trigger-error'));
        });

        act(() => {
            jest.advanceTimersByTime(10000);
        });

        expect(screen.getByTestId('error-message').textContent).toBe('Fatal error');
    });

    it('renders the toast notification when an error is set', () => {
        render(
            <ErrorProvider>
                <ErrorTrigger severity={ErrorSeverity.ERROR} message="Visible error toast" />
            </ErrorProvider>
        );

        act(() => {
            fireEvent.click(screen.getByTestId('trigger-error'));
        });

        // The message appears in both the data-testid span and the toast paragraph
        const matches = screen.getAllByText('Visible error toast');
        expect(matches.length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('shows "Warning" label for WARNING severity in the toast', () => {
        render(
            <ErrorProvider>
                <ErrorTrigger severity={ErrorSeverity.WARNING} message="A warning" />
            </ErrorProvider>
        );

        act(() => {
            fireEvent.click(screen.getByTestId('trigger-error'));
        });

        expect(screen.getByText('Warning')).toBeInTheDocument();
    });

    it('shows "Critical Error" label for FATAL severity in the toast', () => {
        render(
            <ErrorProvider>
                <ErrorTrigger severity={ErrorSeverity.FATAL} message="Fatal error" />
            </ErrorProvider>
        );

        act(() => {
            fireEvent.click(screen.getByTestId('trigger-error'));
        });

        expect(screen.getByText('Critical Error')).toBeInTheDocument();
    });

    it('shows "Info" label for INFO severity in the toast', () => {
        render(
            <ErrorProvider>
                <ErrorTrigger severity={ErrorSeverity.INFO} message="Info msg" />
            </ErrorProvider>
        );

        act(() => {
            fireEvent.click(screen.getByTestId('trigger-error'));
        });

        expect(screen.getByText('Info')).toBeInTheDocument();
    });

    it('Dismiss button clears the error toast', () => {
        render(
            <ErrorProvider>
                <ErrorTrigger severity={ErrorSeverity.ERROR} message="To dismiss" />
            </ErrorProvider>
        );

        act(() => {
            fireEvent.click(screen.getByTestId('trigger-error'));
        });

        // Verify the toast message appears (may match multiple elements)
        expect(screen.getAllByText('To dismiss').length).toBeGreaterThanOrEqual(1);

        act(() => {
            fireEvent.click(screen.getByText('Dismiss'));
        });

        expect(screen.queryByText('To dismiss')).not.toBeInTheDocument();
    });

    it('calls retryAction and clears error when Try Again is clicked', () => {
        const retryMock = jest.fn();

        render(
            <ErrorProvider>
                <ErrorTrigger
                    severity={ErrorSeverity.ERROR}
                    message="Retry this"
                    retryAction={retryMock}
                />
            </ErrorProvider>
        );

        act(() => {
            fireEvent.click(screen.getByTestId('trigger-error'));
        });

        act(() => {
            fireEvent.click(screen.getByText('Try Again'));
        });

        expect(retryMock).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('Retry this')).not.toBeInTheDocument();
    });

    it('does not show Try Again button when no retryAction provided', () => {
        render(
            <ErrorProvider>
                <ErrorTrigger severity={ErrorSeverity.ERROR} message="No retry" />
            </ErrorProvider>
        );

        act(() => {
            fireEvent.click(screen.getByTestId('trigger-error'));
        });

        expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
    });
});
