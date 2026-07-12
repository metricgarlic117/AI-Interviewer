import coreWebVitals from 'eslint-config-next/core-web-vitals';

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'out/**'],
  },
  ...coreWebVitals,
  {
    rules: {
      // Stylistic preference: apostrophes in JSX copy are fine.
      'react/no-unescaped-entities': 'off',
      // The compiler-powered rules from eslint-plugin-react-hooks v7 flag
      // pre-existing patterns in the live-session UI (decorative Math.random
      // visualizer, setState-in-effect data loading). Keep them visible as
      // warnings; promote back to errors once those components are refactored.
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
];

export default config;
