module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  plugins: ['prettier', 'react', '@typescript-eslint'],
  extends: [
    'tui/es6',
    'plugin:@typescript-eslint/recommended',
    'prettier/@typescript-eslint',
    'plugin:react/recommended',
    'plugin:prettier/recommended',
  ],
  parserOptions: {
    parser: 'typescript-eslint-parser',
  },
  rules: {
    'prefer-destructuring': 0,
    'newline-before-return': 0,
    'padding-line-between-statements': 0,
    'no-useless-constructor': 0,
    'default-param-last': 1,
    '@typescript-eslint/no-non-null-assertion': 0,
    '@typescript-eslint/explicit-function-return-type': 0,
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/no-triple-slash-reference': 0,
    '@typescript-eslint/no-object-literal-type-assertion': 0,
    '@typescript-eslint/no-use-before-define': 0,
    '@typescript-eslint/triple-slash-reference': 0,
    '@typescript-eslint/interface-name-prefix': 0,
    '@typescript-eslint/no-useless-constructor': 2,
    '@typescript-eslint/ban-ts-ignore': 0,
    '@typescript-eslint/no-unused-vars': 2,
    'react/no-unknown-property': 0,
    'accessor-pairs': 0,
    'require-jsdoc': 0,
    'no-new': 0,
    'spaced-comment': 0,
    curly: 2,
    complexity: 0,
    // add by liq
    // '@typescript-eslint/no-empty-function': 'off',
    'no-plusplus': 'off', // 关闭禁止使用自增运算符的规则
  },
  settings: {
    react: {
      pragma: 'h',
      version: '16.3',
    },
  },
};
