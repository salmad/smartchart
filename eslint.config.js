import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import hooks from 'eslint-plugin-react-hooks'
import refresh from 'eslint-plugin-react-refresh'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: [
      'dist',
      'docs',
      'node_modules',
      'tests/agent-harness',
      '.superpowers',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': hooks, 'react-refresh': refresh },
    rules: {
      ...hooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      // `const { omitted, ...rest } = x` is how the engine drops a field
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true, argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Slides are JSON: patches and fixes remove fields by path or by name
      '@typescript-eslint/no-dynamic-delete': 'off',
      'react/forbid-component-props': 'off',
      'no-restricted-syntax': ['error', { selector: "JSXAttribute[name.name='style']", message: 'No inline styles (CLAUDE.md).' }],
    },
  },
)
