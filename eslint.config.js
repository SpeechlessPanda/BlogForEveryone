const js = require('@eslint/js');
const vuePlugin = require('eslint-plugin-vue');
const globals = require('globals');

module.exports = [
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            '.qa/**',
            '.tmp-user-data/**',
            'test-results/**',
            'playwright-report/**'
        ]
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
    },
    {
        files: [
            'src/renderer/src/components/content/ExistingContentSection.vue',
            'src/renderer/src/components/theme-config/ThemeAdvancedConfigSection.vue',
            'src/renderer/src/components/theme-config/ThemeAssetStudioSection.vue',
            'src/renderer/src/components/theme-config/ThemeIdentitySection.vue'
        ],
        rules: {
            'vue/no-mutating-props': 'off'
        }
    }
];
