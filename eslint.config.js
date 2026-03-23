const js = require('@eslint/js');
const vuePlugin = require('eslint-plugin-vue');
const globals = require('globals');

module.exports = [
    {
        ignores: ['dist/**', 'node_modules/**']
    },
    js.configs.recommended,
    ...vuePlugin.configs['flat/essential'],
    {
        files: ['**/*.{js,mjs,cjs,vue}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node
            }
        }
    }
];
