import js from '@eslint/js';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  {
    plugins: {
      prettier: prettier,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        chrome: 'readonly',
        browser: 'readonly',
        console: 'readonly',
        document: 'readonly',
        window: 'readonly',
        location: 'readonly',
        navigator: 'readonly',
        performance: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        MutationObserver: 'readonly',
        WeakSet: 'readonly',
        HTMLElement: 'readonly',
      },
    },
    rules: {
      ...prettierConfig.rules,
      'prettier/prettier': 'error',
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    files: ['tests/**/*.js', 'e2e/**/*.js'],
    languageOptions: {
      globals: {
        test: 'readonly',
        expect: 'readonly',
        describe: 'readonly',
        beforeEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
        global: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        import: 'readonly',
      },
    },
  },
];
