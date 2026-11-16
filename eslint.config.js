import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import hooks from 'eslint-plugin-react-hooks'
import refresh from 'eslint-plugin-react-refresh'
import globals from 'globals'

const NO_STYLE = { selector: "JSXAttribute[name.name='style']", message: 'No inline styles (CLAUDE.md).' }

export default tseslint.config(
  {
    ignores: [
      'dist',
      'docs',
      'node_modules',
      'tests/agent-harness',
      '.superpowers',
      '.claude',
      'shorts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  // Node scripts run by hand (npm run film:upload)
  { files: ['scripts/**/*.mjs'], languageOptions: { globals: globals.node } },
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
      'no-restricted-syntax': ['error', NO_STYLE],
    },
  },
  // One brand: app chrome takes its colours from the tokens (tailwind.config, --brand-* in index.css), never from a
  // colour written into a class. The files left out hold colours that are data, not chrome: the accent swatches a
  // user picks from, a brand's own colours, the site's deliberately default-looking chart, the presenter's laser
  // (drawn on a canvas) and Google's mark on the sign-in button.
  {
    files: ['src/app/**/*.{ts,tsx}'],
    ignores: ['src/app/components/AccentPicker.tsx', 'src/app/components/BrandColours.tsx', 'src/app/components/landing/DefaultChart.tsx', 'src/app/components/Ink.tsx', 'src/app/components/SignIn.tsx'],
    rules: {
      'no-restricted-syntax': ['error', NO_STYLE,
        { selector: 'Literal[value=/#[0-9A-Fa-f]{6}\\b|rgba?\\(255, ?255, ?255/]', message: 'Use a colour token (ink, line, gold, shadow-menu…), not a colour written out. See tailwind.config.js.' },
        { selector: 'TemplateElement[value.raw=/#[0-9A-Fa-f]{6}\\b|rgba?\\(255, ?255, ?255/]', message: 'Use a colour token (ink, line, gold, shadow-menu…), not a colour written out. See tailwind.config.js.' }],
    },
  },
)
