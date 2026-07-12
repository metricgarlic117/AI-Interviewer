/** @type {import('jest').Config} */
const customJestConfig = {
    testEnvironment: 'jest-environment-jsdom',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '^next/server$': '<rootDir>/__mocks__/next/server.js',
        // Handle CSS modules and other static assets
        '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
        '\\.(jpg|jpeg|png|gif|svg|webp)$': '<rootDir>/__mocks__/fileMock.js',
    },
    testMatch: ['**/__tests__/**/*.test.{js,jsx}'],
    testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
    coverageProvider: 'v8',
    collectCoverageFrom: [
        'services/**/*.js',
        'app/api/**/*.js',
        'lib/**/*.js',
        'contexts/**/*.jsx',
        'components/**/*.jsx',
        'types.js',
    ],
    transform: {
        '^.+\\.(js|jsx)$': ['babel-jest', { presets: ['next/babel'] }],
    },
    transformIgnorePatterns: [
        '/node_modules/(?!(firebase|@firebase|@google/genai)/)',
    ],
};

module.exports = customJestConfig;
