/**
 * Shared test utilities for API route tests.
 */

/**
 * Builds a minimal request object compatible with the route handlers:
 * headers.get(), text(), json().
 *
 * Pass `authorization: null` to simulate an unauthenticated request.
 */
export function makeRequest(body, { authorization = 'Bearer test-token' } = {}) {
    const headers = new Map();
    if (authorization) {
        headers.set('authorization', authorization);
    }
    return {
        headers,
        text: async () => (body === undefined ? '' : JSON.stringify(body)),
        json: async () => body,
    };
}

/**
 * jest.mock factory for '@/lib/server/auth' that accepts any Bearer token
 * without touching firebase-admin. Rejects requests with no token, so 401
 * behavior stays testable.
 */
export function fakeAuthModule() {
    class ApiError extends Error {
        constructor(message, status) {
            super(message);
            this.name = 'ApiError';
            this.status = status;
        }
    }

    return {
        ApiError,
        requireAuth: jest.fn(async (request) => {
            const header = request.headers.get('authorization') || '';
            if (!/^Bearer\s+.+$/i.test(header)) {
                throw new ApiError('Authentication required', 401);
            }
            return { uid: 'test-user' };
        }),
    };
}
