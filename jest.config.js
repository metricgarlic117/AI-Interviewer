/** @type {import('jest').Config} */
const customJestConfig = {
    testEnvironment: 'jest-environment-jsdom',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '^next/server$': '<rootDir>/__mocks__/next/server.js',
        // Handle CSS modules and other static assets
        '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
        '\\.(jpg|jpeg|png|gif|svg|webp)$': '<rootDir>/__mocks__/fileMock.js',
    },
    testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
    coverageProvider: 'v8',
    collectCoverageFrom: [
        'services/**/*.ts',
        'app/api/**/*.ts',
        'contexts/**/*.tsx',
        'components/**/*.tsx',
        'types.ts',
        '!**/*.d.ts',
    ],
    transform: {
        '^.+\\.(ts|tsx|js|jsx)$': ['ts-jest', {
            tsconfig: {
                jsx: 'react-jsx',
                esModuleInterop: true,
                allowSyntheticDefaultImports: true,
            },
        }],
    },
    transformIgnorePatterns: [
        '/node_modules/(?!(firebase|@firebase|@google/genai)/)',
    ],
};

module.exports = customJestConfig;
