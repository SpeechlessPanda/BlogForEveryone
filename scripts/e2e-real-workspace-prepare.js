const fs = require('fs');
const path = require('path');

const { initProject } = require('../src/main/services/frameworkService');
const { installAndApplyTheme, readThemeConfig, saveThemeConfig, saveLocalAssetToBlog, applyPreviewOverrides } = require('../src/main/services/themeService');
const { ensureFrameworkPublishPackages } = require('../src/main/services/frameworkToolingService');
const { installDependenciesWithRetry } = require('../src/main/services/envService');

const ROOT = path.resolve(__dirname, '..');
const E2E_ROOT = path.join(ROOT, 'e2e-real-workspaces');
const ASSET_IMAGE = path.join(ROOT, 'src', 'img', 'icon.jpg');
const MANIFEST_PATH = path.join(E2E_ROOT, 'manifest.json');
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');

const THEMES = [
    { framework: 'hexo', themeId: 'landscape', dir: 'hexo-landscape' },
    { framework: 'hexo', themeId: 'next', dir: 'hexo-next' },
    { framework: 'hexo', themeId: 'butterfly', dir: 'hexo-butterfly' },
    { framework: 'hexo', themeId: 'fluid', dir: 'hexo-fluid' },
    { framework: 'hexo', themeId: 'volantis', dir: 'hexo-volantis' },
    { framework: 'hugo', themeId: 'papermod', dir: 'hugo-papermod' },
    { framework: 'hugo', themeId: 'loveit', dir: 'hugo-loveit' },
    { framework: 'hugo', themeId: 'stack', dir: 'hugo-stack' },
    { framework: 'hugo', themeId: 'mainroad', dir: 'hugo-mainroad' },
    { framework: 'hugo', themeId: 'anatole', dir: 'hugo-anatole' }
];

function setByPath(target, dotPath, value) {
    const keys = dotPath.split('.');
    let pointer = target;
    for (let i = 0; i < keys.length - 1; i += 1) {
        const key = keys[i];
        if (pointer[key] == null || typeof pointer[key] !== 'object') {
            pointer[key] = {};
        }
        pointer = pointer[key];
    }
    pointer[keys[keys.length - 1]] = value;
}

function ensureContentForTheme(projectDir, framework, themeId) {
    if (framework === 'hexo') {
        const postDir = path.join(projectDir, 'source', '_posts');
        fs.mkdirSync(postDir, { recursive: true });
        const postPath = path.join(postDir, 'e2e-theme-check.md');
        fs.writeFileSync(postPath, [
            '---',
            'title: E2E Theme Check',
            'date: 2026-03-19 12:00:00',
            'categories:',
            '- e2e',
            'tags:',
            '- qa',
            '- verify',
            '---',
            '',
            `content for ${themeId}`
        ].join('\n'), 'utf8');
        return;
    }

    const sectionName = themeId === 'loveit' ? 'posts' : 'post';
    const postDir = path.join(projectDir, 'content', sectionName);
    fs.mkdirSync(postDir, { recursive: true });
    const postPath = path.join(postDir, 'e2e-theme-check.md');
    fs.writeFileSync(postPath, [
        '---',
        'title: "E2E Theme Check"',
        'date: 2026-03-19T12:00:00+08:00',
        'draft: false',
        'tags: ["qa", "verify"]',
        'categories: ["e2e"]',
        '---',
        '',
        `content for ${themeId}`
    ].join('\n'), 'utf8');
}

function applyThemeSpecificConfig(config, row, assets) {
    const { framework, themeId } = row;

    setByPath(config, 'title', `E2E ${framework} ${themeId}`);

    if (framework === 'hexo') {
        setByPath(config, 'subtitle', 'End-to-end preview validation');
        if (themeId === 'landscape') {
            setByPath(config, 'theme_config.favicon', assets.favicon);
            setByPath(config, 'theme_config.banner', assets.background);
        } else {
            setByPath(config, 'favicon', assets.favicon);
            setByPath(config, 'theme_config.background_image', assets.background);
        }

        if (themeId === 'next') {
            setByPath(config, 'theme_config.scheme', 'Muse');
            setByPath(config, 'theme_config.sidebar.position', 'left');
            setByPath(config, 'theme_config.sidebar.display', 'always');
            setByPath(config, 'theme_config.favicon.small', assets.favicon);
            setByPath(config, 'theme_config.favicon.medium', assets.favicon);
            setByPath(config, 'theme_config.favicon.apple_touch_icon', assets.favicon);
        }

        if (themeId === 'butterfly') {
            setByPath(config, 'theme_config.nav.enable', true);
            setByPath(config, 'theme_config.cover.index_enable', true);
            setByPath(config, 'theme_config.footer.owner.enable', true);
        }

        if (themeId === 'fluid') {
            setByPath(config, 'theme_config.banner_img', assets.background);
            setByPath(config, 'theme_config.post.default_index_img', assets.background);
        }

        if (themeId === 'volantis') {
            setByPath(config, 'theme_config.cover.type', 'half');
            setByPath(config, 'theme_config.search.enable', true);
            setByPath(config, 'theme_config.sidebar.for_page', ['blogger', 'category', 'tagcloud']);
        }

        return;
    }

    setByPath(config, 'params.description', 'End-to-end preview validation');
    setByPath(config, 'params.backgroundImage', assets.background);
    setByPath(config, 'params.favicon', assets.favicon);

    if (themeId === 'papermod') {
        setByPath(config, 'params.assets.favicon', assets.favicon);
        setByPath(config, 'params.assets.favicon16x16', assets.favicon);
        setByPath(config, 'params.assets.favicon32x32', assets.favicon);
        setByPath(config, 'params.assets.disableFingerprinting', true);
        setByPath(config, 'params.homeInfoParams.Title', 'E2E Home');
        setByPath(config, 'params.homeInfoParams.Content', 'PaperMod verification');
        setByPath(config, 'params.socialIcons', [
            { name: 'github', url: 'https://github.com/speechlesspanda' },
            { name: 'email', url: 'mailto:e2e@example.com' }
        ]);
        setByPath(config, 'menu.main', [
            { identifier: 'archives', name: 'Archives', url: '/archives/', weight: 10 },
            { identifier: 'tags', name: 'Tags', url: '/tags/', weight: 20 }
        ]);
    }

    if (themeId === 'loveit') {
        setByPath(config, 'params.header.desktopMode', 'fixed');
        setByPath(config, 'params.page.share.enable', true);
        setByPath(config, 'params.home.profile.enable', false);
        setByPath(config, 'params.home.posts.enable', true);
        setByPath(config, 'params.home.posts.paginate', 6);
        setByPath(config, 'params.social.GitHub', 'https://github.com/speechlesspanda');
        setByPath(config, 'mainSections', ['posts', 'post']);
        setByPath(config, 'menu.main', [
            { identifier: 'posts', name: 'Posts', url: '/posts/', weight: 1 },
            { identifier: 'tags', name: 'Tags', url: '/tags/', weight: 2 },
            { identifier: 'categories', name: 'Categories', url: '/categories/', weight: 3 }
        ]);
    }

    if (themeId === 'stack') {
        setByPath(config, 'taxonomies.tag', 'tags');
        setByPath(config, 'taxonomies.category', 'categories');
        setByPath(config, 'params.sidebar.subtitle', 'Stack verification');
        setByPath(config, 'params.sidebar.avatar', assets.avatar);
        setByPath(config, 'params.widgets.homepage', [
            { type: 'archives', params: { limit: 5 } },
            { type: 'tag-cloud', params: { limit: 15 } }
        ]);
        setByPath(config, 'params.widgets.page', [{ type: 'toc' }]);
        setByPath(config, 'menu.main', [
            { identifier: 'home', name: 'Home', url: '/', weight: 10, params: { icon: 'home' } },
            { identifier: 'about', name: 'About', url: '/about/', weight: 20, params: { icon: 'user' } },
            { identifier: 'archives', name: 'Archives', url: '/archives/', weight: 30, params: { icon: 'archives' } }
        ]);
    }

    if (themeId === 'mainroad') {
        setByPath(config, 'Params.description', 'Mainroad verification');
        setByPath(config, 'Params.highlightColor', 'blue');
        setByPath(config, 'Params.mainSections', ['post']);
        setByPath(config, 'Params.sidebar.home', 'right');
        setByPath(config, 'Params.sidebar.list', 'right');
        setByPath(config, 'Params.sidebar.single', 'right');
        setByPath(config, 'Params.sidebar.widgets', ['search', 'recent', 'categories', 'taglist']);
        setByPath(config, 'Params.widgets.recent_num', 5);
        setByPath(config, 'Params.widgets.tags_counter', true);
    }

    if (themeId === 'anatole') {
        setByPath(config, 'params.profilePicture', assets.avatar);
        setByPath(config, 'params.socialIcons', [
            { icon: 'fa-brands fa-github', title: 'GitHub', url: 'https://github.com/speechlesspanda' },
            { icon: 'fa-solid fa-envelope', title: 'Email', url: 'mailto:e2e@example.com' }
        ]);
        setByPath(config, 'menu.main', [
            { name: 'Home', url: '/', weight: 10 },
            { name: 'Posts', url: '/post/', weight: 20 },
            { name: 'About', url: '/about/', weight: 30 }
        ]);
    }
}

function hasLocalHexoExecutable(projectDir, options = {}) {
    const platform = options.platform || process.platform;
    const existsSync = options.existsSync || fs.existsSync;
    const binName = platform === 'win32' ? 'hexo.cmd' : 'hexo';
    return existsSync(path.join(projectDir, 'node_modules', '.bin', binName));
}

function ensureHexoDependenciesReady(projectDir, options = {}) {
    const existsSync = options.existsSync || fs.existsSync;
    const installDependencies = options.installDependencies || installDependenciesWithRetry;
    const platform = options.platform || process.platform;

    if (hasLocalHexoExecutable(projectDir, { existsSync, platform })) {
        return {
            ok: true,
            repaired: false,
            logs: []
        };
    }

    const installResult = installDependencies(projectDir);
    return {
        ok: Boolean(installResult && installResult.ok),
        repaired: true,
        logs: Array.isArray(installResult && installResult.logs) ? installResult.logs : []
    };
}

async function prepareTheme(row) {
    const projectDir = path.join(E2E_ROOT, 'runs', RUN_ID, row.dir);
    fs.mkdirSync(projectDir, { recursive: true });

    const initResult = await initProject({ framework: row.framework, projectDir });
    if (initResult.status !== 0) {
        throw new Error(`init failed: ${row.framework}/${row.themeId}\n${initResult.stderr || initResult.stdout}`);
    }

    const themeResult = await installAndApplyTheme({
        projectDir,
        framework: row.framework,
        themeId: row.themeId
    });
    if (!themeResult.ok) {
        throw new Error(`theme setup failed: ${row.framework}/${row.themeId}\n${themeResult.message || themeResult.reason}`);
    }

    await ensureFrameworkPublishPackages({
        projectDir,
        framework: row.framework,
        themeId: row.themeId
    });

    if (row.framework === 'hexo') {
        const dependencyReady = ensureHexoDependenciesReady(projectDir);
        if (!dependencyReady.ok) {
            throw new Error(`hexo dependencies install failed: ${row.framework}/${row.themeId}`);
        }
    }

    const background = saveLocalAssetToBlog({
        projectDir,
        framework: row.framework,
        localFilePath: ASSET_IMAGE,
        assetType: 'background',
        preferredFileName: 'e2e-bg'
    }).webPath;

    const favicon = saveLocalAssetToBlog({
        projectDir,
        framework: row.framework,
        localFilePath: ASSET_IMAGE,
        assetType: 'favicon',
        preferredFileName: 'e2e-favicon'
    }).webPath;

    const avatar = saveLocalAssetToBlog({
        projectDir,
        framework: row.framework,
        localFilePath: ASSET_IMAGE,
        assetType: 'avatar',
        preferredFileName: 'e2e-avatar'
    }).webPath;

    ensureContentForTheme(projectDir, row.framework, row.themeId);

    const config = readThemeConfig(projectDir, row.framework) || {};
    applyThemeSpecificConfig(config, row, { background, favicon, avatar });
    saveThemeConfig(projectDir, row.framework, config);

    if (row.framework === 'hugo') {
        applyPreviewOverrides({
            projectDir,
            framework: row.framework,
            themeId: row.themeId,
            backgroundImage: background,
            favicon
        });
    }

    return {
        ...row,
        projectDir,
        assets: { background, favicon, avatar }
    };
}

async function main() {
    fs.mkdirSync(E2E_ROOT, { recursive: true });
    const prepared = [];

    for (const row of THEMES) {
        // eslint-disable-next-line no-await-in-loop
        const item = await prepareTheme(row);
        prepared.push(item);
        console.log(`prepared: ${row.framework}/${row.themeId}`);
    }

    fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), runId: RUN_ID, themes: prepared }, null, 2)}\n`, 'utf8');
    console.log(`manifest: ${MANIFEST_PATH}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
