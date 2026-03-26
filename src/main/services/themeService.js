const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const YAML = require('yaml');
const TOML = require('@iarna/toml');
const { MIRROR_REGISTRY } = require('./envService');

const themeCatalogPath = path.join(__dirname, '../../shared/data/themeCatalog.json');

const HEXO_THEME_INSTALLERS = {
    landscape: { builtin: true, themeName: 'landscape' },
    next: { pnpmPackage: 'hexo-theme-next', themeName: 'next' },
    butterfly: { pnpmPackage: 'hexo-theme-butterfly', themeName: 'butterfly' },
    fluid: { pnpmPackage: 'hexo-theme-fluid', themeName: 'fluid' },
    volantis: { pnpmPackage: 'hexo-theme-volantis', themeName: 'volantis' }
};

const HUGO_THEME_INSTALLERS = {
    papermod: { repo: 'github.com/adityatelange/hugo-PaperMod', dirName: 'PaperMod', themeName: 'PaperMod' },
    loveit: { repo: 'github.com/dillonzq/LoveIt', dirName: 'LoveIt', themeName: 'LoveIt' },
    stack: { repo: 'github.com/CaiJimmy/hugo-theme-stack', dirName: 'hugo-theme-stack', themeName: 'hugo-theme-stack' },
    mainroad: { repo: 'github.com/Vimux/Mainroad', dirName: 'Mainroad', themeName: 'Mainroad' },
    anatole: { repo: 'github.com/lxndrblz/anatole', dirName: 'anatole', themeName: 'anatole' }
};

function buildRecognizedThemeLookup(framework) {
    const installers = framework === 'hexo' ? HEXO_THEME_INSTALLERS : framework === 'hugo' ? HUGO_THEME_INSTALLERS : null;
    if (!installers) {
        return new Map();
    }

    const lookup = new Map();
    for (const [themeId, installer] of Object.entries(installers)) {
        lookup.set(themeId.toLowerCase(), themeId);
        if (installer?.themeName) {
            lookup.set(String(installer.themeName).toLowerCase(), themeId);
        }
    }

    const catalog = getThemeCatalog()[framework] || [];
    for (const item of catalog) {
        if (item?.id) {
            lookup.set(String(item.id).toLowerCase(), String(item.id));
        }
        if (item?.name) {
            lookup.set(String(item.name).toLowerCase(), String(item.id));
        }
    }

    return lookup;
}

function inferRecognizedThemeIdFromProject(projectDir, framework) {
    if (!projectDir || !framework || framework === 'unknown') {
        return 'unknown';
    }

    const config = readThemeConfig(projectDir, framework);
    const rawTheme = Array.isArray(config.theme) ? config.theme[0] : config.theme;
    const normalized = String(rawTheme || '').trim().toLowerCase();
    if (!normalized) {
        return 'unknown';
    }

    const lookup = buildRecognizedThemeLookup(framework);
    return lookup.get(normalized) || 'unknown';
}

function createAsyncCommandRunnerTools(options = {}) {
    const spawnImpl = options.spawnImpl || spawn;
    const mirrorRegistry = options.mirrorRegistry || MIRROR_REGISTRY;
    const platform = options.platform || process.platform;
    const pnpmCommand = platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

    function shouldUseWindowsCmdWrapper(command) {
        return platform === 'win32' && /\.(cmd|bat)$/i.test(String(command || ''));
    }

    function runCommandAsync(command, args = [], commandOptions = {}) {
        return new Promise((resolve) => {
            const timeoutMs = Number(commandOptions.timeoutMs || 0);
            const spawnOptions = { ...commandOptions };
            delete spawnOptions.timeoutMs;

            const actualCommand = shouldUseWindowsCmdWrapper(command)
                ? (process.env.ComSpec || 'cmd.exe')
                : command;
            const actualArgs = shouldUseWindowsCmdWrapper(command)
                ? ['/d', '/s', '/c', command, ...args]
                : args;

            const child = spawnImpl(actualCommand, actualArgs, {
                shell: false,
                windowsHide: true,
                ...spawnOptions
            });

            let stdout = '';
            let stderr = '';

            child.stdout?.on('data', (chunk) => {
                stdout += chunk.toString();
            });

            child.stderr?.on('data', (chunk) => {
                stderr += chunk.toString();
            });

            let timer = null;
            if (timeoutMs > 0) {
                timer = setTimeout(() => {
                    child.kill();
                    resolve({
                        status: 1,
                        stdout,
                        stderr: `${stderr}${stderr ? '\n' : ''}Command timed out after ${timeoutMs}ms`
                    });
                }, timeoutMs);
            }

            child.on('error', (error) => {
                if (timer) {
                    clearTimeout(timer);
                }
                resolve({
                    status: 1,
                    stdout,
                    stderr: `${stderr}${stderr ? '\n' : ''}${String(error.message || error)}`
                });
            });

            child.on('close', (code) => {
                if (timer) {
                    clearTimeout(timer);
                }
                resolve({ status: code ?? 1, stdout, stderr });
            });
        });
    }

    async function runPnpmWithMirrorRetry(args, commandOptions = {}) {
        const logs = [];
        const first = await runCommandAsync(pnpmCommand, args, { timeoutMs: 180000, ...commandOptions });
        logs.push({ command: `pnpm ${args.join(' ')}`, status: first.status, stdout: first.stdout, stderr: first.stderr });
        if (first.status === 0) {
            return { ok: true, retried: false, logs };
        }

        logs.push({
            event: 'mirror-fallback',
            message: '主题下载首次失败，已切换 pnpm 镜像源后重试。',
            registry: mirrorRegistry
        });

        const second = await runCommandAsync(pnpmCommand, args, {
            timeoutMs: 180000,
            ...commandOptions,
            env: {
                ...(commandOptions.env || {}),
                npm_config_registry: mirrorRegistry
            }
        });
        logs.push({
            command: `pnpm ${args.join(' ')} (retry with registry env ${mirrorRegistry})`,
            status: second.status,
            stdout: second.stdout,
            stderr: second.stderr
        });

        return {
            ok: second.status === 0,
            retried: true,
            logs
        };
    }

    async function runPnpmDlxWithMirrorRetry(args, commandOptions = {}) {
        const logs = [];

        const first = await runCommandAsync(pnpmCommand, ['dlx', ...args], { timeoutMs: 240000, ...commandOptions });
        logs.push({ command: `pnpm dlx ${args.join(' ')}`, status: first.status, stdout: first.stdout, stderr: first.stderr });

        if (first.status === 0) {
            return { ok: true, retried: false, logs };
        }

        logs.push({
            event: 'mirror-fallback',
            message: 'pnpm dlx 首次失败，已切换镜像源后重试。',
            registry: mirrorRegistry
        });

        const second = await runCommandAsync(pnpmCommand, ['dlx', ...args], {
            timeoutMs: 240000,
            ...commandOptions,
            env: {
                ...(commandOptions.env || {}),
                npm_config_registry: mirrorRegistry
            }
        });
        logs.push({
            command: `pnpm dlx ${args.join(' ')} (retry with registry env ${mirrorRegistry})`,
            status: second.status,
            stdout: second.stdout,
            stderr: second.stderr
        });

        return {
            ok: second.status === 0,
            retried: true,
            logs
        };
    }

    return {
        runCommandAsync,
        runPnpmWithMirrorRetry,
        runPnpmDlxWithMirrorRetry
    };
}

const asyncCommandRunnerTools = createAsyncCommandRunnerTools();
const runCommandAsync = asyncCommandRunnerTools.runCommandAsync;

async function runPnpmWithMirrorRetry(args, options = {}) {
    return asyncCommandRunnerTools.runPnpmWithMirrorRetry(args, options);
}

function setHexoTheme(projectDir, themeName) {
    const config = readThemeConfig(projectDir, 'hexo');
    config.theme = themeName;
    saveThemeConfig(projectDir, 'hexo', config);
}

function setHugoTheme(projectDir, themeName) {
    const config = readThemeConfig(projectDir, 'hugo');
    config.theme = themeName;
    saveThemeConfig(projectDir, 'hugo', config);
}

async function runPnpmDlxWithMirrorRetry(args, options = {}) {
    return asyncCommandRunnerTools.runPnpmDlxWithMirrorRetry(args, options);
}

async function installHexoTheme(projectDir, themeId) {
    const installer = HEXO_THEME_INSTALLERS[themeId];
    if (!installer) {
        return {
            ok: false,
            framework: 'hexo',
            reason: 'UNSUPPORTED_THEME',
            message: `不支持的 Hexo 主题：${themeId}`,
            logs: []
        };
    }

    const logs = [];
    if (!installer.builtin) {
        const installResult = await runPnpmWithMirrorRetry(['add', installer.pnpmPackage], { cwd: projectDir });
        logs.push(...installResult.logs);
        if (!installResult.ok) {
            return {
                ok: false,
                framework: 'hexo',
                reason: 'THEME_INSTALL_FAILED',
                message: `Hexo 主题 ${themeId} 下载失败，请检查网络后重试。`,
                logs
            };
        }
    }

    setHexoTheme(projectDir, installer.themeName);
    logs.push({ stage: 'theme-config', message: `Hexo 已切换主题为 ${installer.themeName}` });
    return { ok: true, framework: 'hexo', theme: installer.themeName, logs };
}

async function installHugoTheme(projectDir, themeId) {
    const installer = HUGO_THEME_INSTALLERS[themeId];
    if (!installer) {
        return {
            ok: false,
            framework: 'hugo',
            reason: 'UNSUPPORTED_THEME',
            message: `不支持的 Hugo 主题：${themeId}`,
            logs: []
        };
    }

    const logs = [];
    const targetThemeDir = path.join(projectDir, 'themes', installer.dirName);
    if (!fs.existsSync(targetThemeDir)) {
        const cloneResult = await runPnpmDlxWithMirrorRetry(['degit', installer.repo, `themes/${installer.dirName}`], {
            cwd: projectDir
        });
        logs.push(...(cloneResult.logs || []));
        if (!cloneResult.ok) {
            return {
                ok: false,
                framework: 'hugo',
                reason: 'THEME_INSTALL_FAILED',
                message: `Hugo 主题 ${themeId} 下载失败，请检查网络后重试。`,
                logs
            };
        }
    } else {
        logs.push({ stage: 'theme-install', message: `主题目录已存在，跳过下载：themes/${installer.dirName}` });
    }

    setHugoTheme(projectDir, installer.themeName);
    logs.push({ stage: 'theme-config', message: `Hugo 已切换主题为 ${installer.themeName}` });
    return { ok: true, framework: 'hugo', theme: installer.themeName, logs };
}

async function installAndApplyTheme({ projectDir, framework, themeId }) {
    if (!themeId) {
        return { ok: true, skipped: true, logs: [] };
    }

    if (framework === 'hexo') {
        return installHexoTheme(projectDir, themeId);
    }

    if (framework === 'hugo') {
        return installHugoTheme(projectDir, themeId);
    }

    return {
        ok: false,
        reason: 'UNSUPPORTED_FRAMEWORK',
        message: `不支持的框架：${framework}`,
        logs: []
    };
}

function getThemeCatalog() {
    const raw = fs.readFileSync(themeCatalogPath, 'utf-8');
    return JSON.parse(raw);
}

function readThemeConfig(projectDir, framework) {
    if (framework === 'hexo') {
        const filePath = path.join(projectDir, '_config.yml');
        if (!fs.existsSync(filePath)) {
            return {};
        }
        return YAML.parse(fs.readFileSync(filePath, 'utf-8')) || {};
    }

    if (framework === 'hugo') {
        const fileCandidates = ['hugo.toml', 'config.toml'];
        const fileName = fileCandidates.find((name) => fs.existsSync(path.join(projectDir, name)));
        if (!fileName) {
            return {};
        }
        return TOML.parse(fs.readFileSync(path.join(projectDir, fileName), 'utf-8')) || {};
    }

    return {};
}

function saveThemeConfig(projectDir, framework, nextConfig) {
    if (framework === 'hexo') {
        const filePath = path.join(projectDir, '_config.yml');
        fs.writeFileSync(filePath, YAML.stringify(nextConfig), 'utf-8');
        return;
    }

    if (framework === 'hugo') {
        const filePath = fs.existsSync(path.join(projectDir, 'hugo.toml'))
            ? path.join(projectDir, 'hugo.toml')
            : path.join(projectDir, 'config.toml');
        fs.writeFileSync(filePath, TOML.stringify(nextConfig), 'utf-8');
    }
}

function saveLocalAssetToBlog(payload) {
    const {
        projectDir,
        framework,
        localFilePath,
        assetType = 'image',
        preferredDir,
        preferredFileName
    } = payload;
    if (!localFilePath || !fs.existsSync(localFilePath)) {
        throw new Error('本地资源文件不存在');
    }

    const ext = path.extname(localFilePath) || '.png';
    const sanitizedName = String(preferredFileName || '').trim().replace(/[\\/:*?"<>|]/g, '');
    const baseName = sanitizedName
        ? (path.extname(sanitizedName) ? sanitizedName : `${sanitizedName}${ext}`)
        : (assetType === 'favicon' ? `favicon${ext}` : `${Date.now()}${ext}`);

    const fallbackDir = framework === 'hexo' ? path.join('source', 'img') : path.join('static', 'img');
    const normalizedPreferredDir = String(preferredDir || '').trim().replace(/^[/\\]+/, '').replace(/\.\./g, '');
    const relativeDir = normalizedPreferredDir || fallbackDir;
    const targetRoot = path.join(projectDir, relativeDir);
    fs.mkdirSync(targetRoot, { recursive: true });

    const targetPath = path.join(targetRoot, baseName);
    fs.copyFileSync(localFilePath, targetPath);

    const webPrefix = framework === 'hexo' ? relativeDir.replace(/^source[\\/]/, '') : relativeDir.replace(/^static[\\/]/, '');
    const webPath = `/${webPrefix.replace(/\\/g, '/')}/${baseName}`.replace(/\/+/g, '/');

    return {
        savedPath: targetPath,
        webPath
    };
}

function upsertManagedBlock(origin, block, startTag, endTag) {
    const startIndex = origin.indexOf(startTag);
    const endIndex = origin.indexOf(endTag);
    if (startIndex >= 0 && endIndex > startIndex) {
        const head = origin.slice(0, startIndex);
        const tail = origin.slice(endIndex + endTag.length);
        return `${head}${block}${tail}`.trim() + '\n';
    }

    const normalized = origin.trim();
    if (!normalized) {
        return `${block}\n`;
    }
    return `${normalized}\n\n${block}\n`;
}

function applyPreviewOverrides(payload) {
    const { projectDir, framework, themeId, backgroundImage, favicon } = payload || {};
    if (!projectDir || framework !== 'hugo') {
        return { ok: true, skipped: true };
    }

    const startTag = '<!-- bfe-preview-overrides:start -->';
    const endTag = '<!-- bfe-preview-overrides:end -->';
    const lines = [startTag];
    const escapedFavicon = String(favicon || '').replace(/"/g, '&quot;');
    const escapedBackground = String(backgroundImage || '').replace(/'/g, "\\'");

    if (escapedFavicon) {
        lines.push(`<link rel="icon" href="${escapedFavicon}" />`);
        lines.push(`<link rel="shortcut icon" href="${escapedFavicon}" />`);
        lines.push(`<link rel="apple-touch-icon" href="${escapedFavicon}" />`);
    }

    if (escapedBackground) {
        lines.push('<style>');
        lines.push(`html, body { background-image: url('${escapedBackground}') !important; background-size: cover !important; background-position: center !important; background-attachment: fixed !important; background-repeat: no-repeat !important; background-color: transparent !important; }`);
        lines.push('.main, .post-content, .list, .article-content, .entry, .first-entry, #main, .container, .widget, .article-list article, .main-article, .left-sidebar, .right-sidebar, .site-info { background-color: transparent !important; }');
        lines.push('</style>');
    }

    lines.push(endTag);
    const block = lines.join('\n');

    const partialDir = path.join(projectDir, 'layouts', 'partials');
    fs.mkdirSync(partialDir, { recursive: true });
    const partialPath = path.join(partialDir, 'extend_head.html');
    const origin = fs.existsSync(partialPath)
        ? fs.readFileSync(partialPath, 'utf-8')
        : '';
    const next = upsertManagedBlock(origin, block, startTag, endTag);
    fs.writeFileSync(partialPath, next, 'utf-8');

    let generatedCssPath = '';
    if (String(themeId || '').toLowerCase() === 'papermod') {
        const cssDir = path.join(projectDir, 'assets', 'css', 'extended');
        fs.mkdirSync(cssDir, { recursive: true });
        generatedCssPath = path.join(cssDir, 'bfe-background.css');

        if (escapedBackground) {
            fs.writeFileSync(
                generatedCssPath,
                [
                    `html, body { background-image: url('${escapedBackground}'); background-size: cover; background-position: center; background-attachment: fixed; background-repeat: no-repeat; background-color: transparent; }`,
                    '.main, .first-entry, .entry, #main, .post-content { background-color: transparent !important; }'
                ].join('\n'),
                'utf-8'
            );
        } else if (fs.existsSync(generatedCssPath)) {
            fs.unlinkSync(generatedCssPath);
        }
    }

    return {
        ok: true,
        framework,
        partialPath,
        generatedCssPath,
        applied: { backgroundImage: Boolean(backgroundImage), favicon: Boolean(favicon) }
    };
}

module.exports = {
    getThemeCatalog,
    readThemeConfig,
    saveThemeConfig,
    saveLocalAssetToBlog,
    installAndApplyTheme,
    applyPreviewOverrides,
    inferRecognizedThemeIdFromProject
};
