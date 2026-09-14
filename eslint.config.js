import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
    { ignores: ['dist', 'node_modules', 'coverage', 'dev-dist'] },
    {
        files: ['**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: { ...globals.browser, ...globals.es2021 },
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
        },
        settings: { react: { version: 'detect' } },
        plugins: {
            react,
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...js.configs.recommended.rules,
            ...react.configs.recommended.rules,
            ...react.configs['jsx-runtime'].rules,
            ...reactHooks.configs.recommended.rules,

            // The rule that would have caught `onBan` being called but never
            // destructured in RestaurantCard.jsx. Non-negotiable.
            'no-undef': 'error',
            'no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                ignoreRestSiblings: true,
            }],

            'react/prop-types': 'off',
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
        },
    },
    {
        // Node-context config files
        files: ['*.config.js', 'vite.config.js', 'tailwind.config.js', 'postcss.config.js'],
        languageOptions: { globals: { ...globals.node } },
    },
];
