const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', '**/*.bak*'],
  },
  ...expoConfig,
  {
    rules: {
      'no-unused-vars': 'warn',
      'no-var': 'warn',
      'no-undef': 'warn',
      'no-empty': 'warn',
      'no-dupe-keys': 'warn',
      'no-useless-escape': 'warn',
      'react/display-name': 'warn',
      'react/no-unescaped-entities': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Existing React Native Animated.Value refs are intentionally read during
      // render to feed Animated styles; this rule is not applicable here.
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/set-state-in-render': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/incompatible-library': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/unsupported-syntax': 'warn',
      'react-hooks/globals': 'warn',
      'react-hooks/component-hook-factories': 'warn',
      'react-hooks/error-boundaries': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-hooks/void-use-memo': 'warn',
    },
  },
];
