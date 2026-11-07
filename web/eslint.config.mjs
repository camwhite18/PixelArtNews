// Airbnb style for TypeScript + Preact, via eslint-config-airbnb-extended
// (the maintained flat-config port of eslint-config-airbnb). Its stylistic
// rules also do the formatting: `pnpm format` runs `eslint --fix`.
import { configs, plugins } from 'eslint-config-airbnb-extended';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'src/generated/**', 'src/scenes/data.ts'],
  },
  plugins.stylistic,
  plugins.importX,
  plugins.react,
  plugins.reactA11y,
  plugins.reactHooks,
  plugins.typescriptEslint,
  ...configs.base.recommended,
  ...configs.base.typescript,
  ...configs.react.recommended,
  ...configs.react.typescript,
  {
    name: 'pixelartnews/typed-linting',
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    name: 'pixelartnews/preact',
    settings: {
      // eslint-plugin-react needs a React version to pick rule behaviour;
      // Preact matches the modern (automatic JSX runtime) behaviour.
      react: { version: '18.3' },
    },
    rules: {
      // Preact's automatic JSX runtime: no React import in scope.
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      // TypeScript types the props.
      'react/prop-types': 'off',
      'react/require-default-props': 'off',
      // Named exports keep imports greppable.
      'import-x/prefer-default-export': 'off',
    },
  },
  {
    name: 'pixelartnews/tests',
    files: ['**/*.test.ts', 'vite.config.ts', 'eslint.config.mjs'],
    rules: {
      'import-x/no-extraneous-dependencies': ['error', { devDependencies: true }],
    },
  },
];
