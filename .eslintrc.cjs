/** ESLint config: typescript-eslint + React hooks, Google-style conventions, Prettier for formatting. */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react-refresh'],
  ignorePatterns: ['dist', 'node_modules', 'coverage', 'src-tauri'],
  rules: {
    eqeqeq: ['error', 'always'],
    curly: ['error', 'all'],
    'no-var': 'error',
    'prefer-const': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/consistent-type-imports': 'error',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
};
