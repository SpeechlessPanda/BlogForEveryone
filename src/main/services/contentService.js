const fs = require('fs');
const path = require('path');
const { shell } = require('electron');
const YAML = require('yaml');
const contentPublishWorkflowService = require('./contentPublishWorkflowService');
const workspacePathPolicy = require('../policies/workspacePathPolicy');
let openPathImpl = (filePath) => shell.openPath(filePath);

function slugify(text) {
    return String(text || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

function ensureFile(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, content, 'utf-8');
    }
}

function isMarkdownFile(filePath) {
    return String(filePath || '').toLowerCase().endsWith('.md');
}

function splitFrontMatter(raw) {
    const text = String(raw || '');
    const match = text.match(/^(---|\+\+\+)\r?\n([\s\S]*?)\r?\n\1\r?\n?/);
    if (!match) {
        return {
            hasFrontMatter: false,
            frontMatter: {},
            body: text,
            format: null,
            frontMatterRaw: ''
        };
    }

    const delimiter = match[1];
    const frontMatterRaw = match[2];
    const body = text.slice(match[0].length);
    let parsed = {};
    if (delimiter === '+++') {
        const titleMatch = frontMatterRaw.match(/^title\s*=\s*["']?(.+?)["']?\s*$/m);
        parsed = titleMatch ? { title: titleMatch[1] } : {};
    } else {
        try {
            parsed = YAML.parse(frontMatterRaw) || {};
        } catch {
            parsed = {};
        }
    }

    return {
        hasFrontMatter: true,
        frontMatter: parsed,
        body,
        format: delimiter === '+++' ? 'toml' : 'yaml',
        frontMatterRaw
    };
}

function composeTomlFrontMatter(frontMatter, rawFrontMatter) {
    const normalizedRaw = String(rawFrontMatter || '').replace(/\r\n/g, '\n').trim();
    const titleValue = JSON.stringify(String(frontMatter?.title || '').trim());
    const titlePattern = /^title\s*=\s*.+$/m;
    if (titlePattern.test(normalizedRaw)) {
        return normalizedRaw.replace(titlePattern, `title = ${titleValue}`);
    }

    if (!normalizedRaw) {
        return `title = ${titleValue}`;
    }

    return `title = ${titleValue}\n${normalizedRaw}`;
}

function composeFrontMatter(frontMatter, body, options = {}) {
    const { format = 'yaml', frontMatterRaw = '' } = options;
    const fmText = YAML.stringify(frontMatter || {}).trim();
    if (format === 'toml') {
        const tomlText = composeTomlFrontMatter(frontMatter, frontMatterRaw);
        return `+++\n${tomlText}\n+++\n\n${String(body || '').replace(/^\n+/, '')}`;
    }

    return `---\n${fmText}\n---\n\n${String(body || '').replace(/^\n+/, '')}`;
}

function walkMarkdownFiles(dirPath, collector) {
    if (!fs.existsSync(dirPath)) {
        return;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            walkMarkdownFiles(fullPath, collector);
            continue;
        }

        if (entry.isFile() && isMarkdownFile(fullPath)) {
            collector.push(fullPath);
        }
    }
}

function collectContentFiles(projectDir, framework) {
    const files = [];

    if (framework === 'hexo') {
        walkMarkdownFiles(path.join(projectDir, 'source', '_posts'), files);
        walkMarkdownFiles(path.join(projectDir, 'source'), files);

        const canonicalHexoPagePaths = new Set([
            path.join(projectDir, 'source', 'about', 'index.md'),
            path.join(projectDir, 'source', 'links', 'index.md'),
            path.join(projectDir, 'source', 'announcement', 'index.md')
        ].map((filePath) => path.resolve(filePath)));

        const dedupedPaths = new Set();
        const dedupedFiles = files.filter((filePath) => {
            const resolvedPath = path.resolve(filePath);
            if (dedupedPaths.has(resolvedPath)) {
                return false;
            }

            if (resolvedPath.includes(`${path.sep}source${path.sep}_posts${path.sep}`)) {
                dedupedPaths.add(resolvedPath);
                return true;
            }

            const keepGenericPage = resolvedPath.endsWith(`${path.sep}index.md`) && !canonicalHexoPagePaths.has(resolvedPath);
            if (keepGenericPage) {
                dedupedPaths.add(resolvedPath);
            }
            return keepGenericPage;
        });

        files.length = 0;
        files.push(...dedupedFiles);

        for (const pageName of ['about', 'links', 'announcement']) {
            const pagePath = path.join(projectDir, 'source', pageName, 'index.md');
            if (fs.existsSync(pagePath)) {
                files.push(pagePath);
            }
        }
        return files;
    }

    if (framework === 'hugo') {
        walkMarkdownFiles(path.join(projectDir, 'content'), files);
        return files;
    }

    return files;
}

function inferContentType(filePath, framework) {
    const normalized = String(filePath || '').replace(/\\/g, '/').toLowerCase();
    if (framework === 'hexo') {
        if (normalized.includes('/source/_posts/')) {
            return 'post';
        }
        if (normalized.endsWith('/source/about/index.md')) {
            return 'about';
        }
        if (normalized.endsWith('/source/links/index.md')) {
            return 'links';
        }
        if (normalized.endsWith('/source/announcement/index.md')) {
            return 'announcement';
        }
        return 'page';
    }

    if (framework === 'hugo') {
        if (normalized.includes('/content/posts/')) {
            return 'post';
        }
        if (normalized.endsWith('/content/about/index.md')) {
            return 'about';
        }
        if (normalized.endsWith('/content/links/index.md')) {
            return 'links';
        }
        if (normalized.endsWith('/content/announcement/index.md')) {
            return 'announcement';
        }
        return 'page';
    }

    return 'unknown';
}

function listExistingContents(payload) {
    const { projectDir, framework } = payload || {};
    if (!projectDir || !framework) {
        throw new Error('缺少工程路径或框架类型。');
    }

    const files = collectContentFiles(projectDir, framework);
    const records = files.map((filePath) => {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = splitFrontMatter(raw);
        const title = String(parsed.frontMatter?.title || path.basename(filePath, path.extname(filePath)));
        const stat = fs.statSync(filePath);
        const relPath = path.relative(projectDir, filePath).replace(/\\/g, '/');

        return {
            id: relPath,
            filePath,
            relativePath: relPath,
            type: inferContentType(filePath, framework),
            title,
            updatedAt: stat.mtimeMs
        };
    });

    return records.sort((a, b) => {
        const updatedAtDiff = b.updatedAt - a.updatedAt;
        if (updatedAtDiff !== 0) {
            return updatedAtDiff;
        }

        return a.relativePath.localeCompare(b.relativePath, 'en');
    });
}

function readExistingContent(payload) {
    const { filePath, allowedRoots } = payload || {};
    if (!filePath || !fs.existsSync(filePath)) {
        throw new Error('内容文件不存在。');
    }

    workspacePathPolicy.assertPathWithinRoots(filePath, allowedRoots, 'read');

    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = splitFrontMatter(raw);
    return {
        ok: true,
        filePath,
        title: String(parsed.frontMatter?.title || ''),
        body: parsed.body,
        frontMatter: parsed.frontMatter
    };
}

function saveExistingContent(payload) {
    const { filePath, title, body, allowedRoots } = payload || {};
    if (!filePath || !fs.existsSync(filePath)) {
        throw new Error('内容文件不存在，无法保存。');
    }

    workspacePathPolicy.assertPathWithinRoots(filePath, allowedRoots, 'write');

    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = splitFrontMatter(raw);
    const nextFrontMatter = { ...(parsed.frontMatter || {}) };

    if (String(title || '').trim()) {
        nextFrontMatter.title = String(title).trim();
    }

    const nextBody = typeof body === 'string' ? body : parsed.body;
    const nextText = composeFrontMatter(nextFrontMatter, nextBody, {
        format: parsed.format,
        frontMatterRaw: parsed.frontMatterRaw
    });
    fs.writeFileSync(filePath, nextText, 'utf-8');

    return {
        ok: true,
        filePath,
        title: String(nextFrontMatter.title || ''),
        body: nextBody
    };
}

function openExistingContent(payload) {
    const { filePath, allowedRoots } = payload || {};
    if (!filePath || !fs.existsSync(filePath)) {
        throw new Error('内容文件不存在，无法打开。');
    }

    workspacePathPolicy.assertPathWithinRoots(filePath, allowedRoots, 'open');

    if (typeof openPathImpl !== 'function') {
        throw new Error('当前环境不支持打开文件。');
    }

    openPathImpl(filePath);
    return {
        ok: true,
        filePath
    };
}

function postTemplate(title) {
    return `---\ntitle: ${title}\ndate: ${new Date().toISOString()}\ntags: []\ncategories: []\n---\n\n在这里开始写作。\n`;
}

function pageTemplate(title) {
    return `---\ntitle: ${title}\ndate: ${new Date().toISOString()}\n---\n\n请在这里填写页面内容。\n`;
}

function resolveContentTitle(type, title) {
    const trimmedTitle = String(title || '').trim();
    if (trimmedTitle) {
        return trimmedTitle;
    }

    if (type === 'about') {
        return '关于';
    }

    if (type === 'links') {
        return '友链';
    }

    if (type === 'announcement') {
        return '公告';
    }

    return '新内容';
}

function usesCanonicalSpecialPagePath(type) {
    return ['about', 'links', 'announcement'].includes(type);
}

function resolveContentPath({ projectDir, framework, type, title, slug }) {
    const safeSlug = slugify(slug || title || 'new-post');
    const safePostSlug = safeSlug || 'new-post';

    if (type === 'post') {
        if (framework === 'hexo') {
            return path.join(projectDir, 'source', '_posts', `${safePostSlug}.md`);
        }
        return path.join(projectDir, 'content', 'posts', `${safePostSlug}.md`);
    }

    const pageName = ['about', 'links', 'announcement'].includes(type)
        ? type
        : (safeSlug || type);
    if (framework === 'hexo') {
        return path.join(projectDir, 'source', pageName, 'index.md');
    }
    return path.join(projectDir, 'content', pageName, 'index.md');
}

function createAndOpenContent(payload) {
    const { projectDir, framework, type = 'post', title = '新内容', slug = '', allowedRoots } = payload;
    const resolvedTitle = resolveContentTitle(type, title);
    const resolvedSlug = usesCanonicalSpecialPagePath(type) ? '' : slug;
    const filePath = resolveContentPath({ projectDir, framework, type, title: resolvedTitle, slug: resolvedSlug });
    const content = type === 'post' ? postTemplate(resolvedTitle) : pageTemplate(resolvedTitle);

    workspacePathPolicy.assertPathWithinRoots(filePath, allowedRoots, 'write');

    if (!usesCanonicalSpecialPagePath(type) && fs.existsSync(filePath)) {
        throw new Error('slug 已存在，请更换标题或 slug 后重试。');
    }

    if (typeof openPathImpl !== 'function') {
        throw new Error('当前环境不支持打开文件。');
    }

    ensureFile(filePath, content);
    openPathImpl(filePath);

    return { ok: true, filePath };
}

function watchSaveAndAutoPublish(payload) {
    const { filePath, allowedRoots } = payload || {};
    workspacePathPolicy.assertPathWithinRoots(filePath, allowedRoots, 'watch');
    return contentPublishWorkflowService.watchSaveAndAutoPublish(payload);
}

function publishSavedContent(payload) {
    const { filePath, allowedRoots } = payload || {};
    workspacePathPolicy.assertPathWithinRoots(filePath, allowedRoots, 'publish');
    return contentPublishWorkflowService.publishSavedContent(payload);
}

function getPublishJobStatus(jobId) {
    return contentPublishWorkflowService.getPublishJobStatus(jobId);
}

module.exports = {
    createAndOpenContent,
    listExistingContents,
    readExistingContent,
    saveExistingContent,
    openExistingContent,
    watchSaveAndAutoPublish,
    publishSavedContent,
    getPublishJobStatus,
    __test__: {
        setOpenPathForTests(nextImpl) {
            openPathImpl = typeof nextImpl === 'function'
                ? nextImpl
                : ((filePath) => shell.openPath(filePath));
        }
    }
};
