const fs = require('fs');
const path = require('path');
const { shell } = require('electron');
const YAML = require('yaml');
const { publishToGitHub } = require('./publishService');

const publishJobs = new Map();
let openPathImpl = (filePath) => shell.openPath(filePath);

function normalizeForCompare(inputPath) {
    const resolved = path.resolve(String(inputPath || ''));
    if (fs.existsSync(resolved)) {
        try {
            const real = fs.realpathSync.native(resolved);
            return process.platform === 'win32' ? real.toLowerCase() : real;
        } catch {
            const real = fs.realpathSync(resolved);
            return process.platform === 'win32' ? real.toLowerCase() : real;
        }
    }
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isSubPath(parentPath, childPath) {
    const parent = normalizeForCompare(parentPath);
    const child = normalizeForCompare(childPath);
    if (!parent || !child) {
        return false;
    }

    if (parent === child) {
        return true;
    }

    const relative = path.relative(parent, child);
    return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function assertAllowedRoots(filePath, allowedRoots, actionLabel) {
    if (!Array.isArray(allowedRoots) || !allowedRoots.length) {
        throw new Error(`缺少受管内容路径白名单，拒绝${actionLabel}操作。`);
    }

    if (!allowedRoots.some((root) => isSubPath(root, filePath))) {
        throw new Error(`内容路径越界，拒绝${actionLabel}操作。`);
    }
}

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
    if (!text.startsWith('---\n')) {
        return {
            hasFrontMatter: false,
            frontMatter: {},
            body: text
        };
    }

    const closingMarker = '\n---\n';
    const markerIndex = text.indexOf(closingMarker, 4);
    if (markerIndex < 0) {
        return {
            hasFrontMatter: false,
            frontMatter: {},
            body: text
        };
    }

    const frontMatterRaw = text.slice(4, markerIndex);
    const body = text.slice(markerIndex + closingMarker.length);
    let parsed = {};
    try {
        parsed = YAML.parse(frontMatterRaw) || {};
    } catch {
        parsed = {};
    }

    return {
        hasFrontMatter: true,
        frontMatter: parsed,
        body
    };
}

function composeFrontMatter(frontMatter, body) {
    const fmText = YAML.stringify(frontMatter || {}).trim();
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

    return records.sort((a, b) => b.updatedAt - a.updatedAt);
}

function readExistingContent(payload) {
    const { filePath, allowedRoots } = payload || {};
    if (!filePath || !fs.existsSync(filePath)) {
        throw new Error('内容文件不存在。');
    }

    assertAllowedRoots(filePath, allowedRoots, 'read');

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

    assertAllowedRoots(filePath, allowedRoots, 'write');

    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = splitFrontMatter(raw);
    const nextFrontMatter = { ...(parsed.frontMatter || {}) };

    if (String(title || '').trim()) {
        nextFrontMatter.title = String(title).trim();
    }

    const nextBody = typeof body === 'string' ? body : parsed.body;
    const nextText = composeFrontMatter(nextFrontMatter, nextBody);
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

    assertAllowedRoots(filePath, allowedRoots, 'open');

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

function resolveContentPath({ projectDir, framework, type, title, slug }) {
    const safeSlug = slugify(slug || title || 'new-post');

    if (type === 'post') {
        if (framework === 'hexo') {
            return path.join(projectDir, 'source', '_posts', `${safeSlug}.md`);
        }
        return path.join(projectDir, 'content', 'posts', `${safeSlug}.md`);
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
    const filePath = resolveContentPath({ projectDir, framework, type, title, slug });
    const content = type === 'post' ? postTemplate(title) : pageTemplate(title);

    assertAllowedRoots(filePath, allowedRoots, 'write');

    if (typeof openPathImpl !== 'function') {
        throw new Error('当前环境不支持打开文件。');
    }

    ensureFile(filePath, content);
    openPathImpl(filePath);

    return { ok: true, filePath };
}

function watchSaveAndAutoPublish(payload) {
    const { filePath, projectDir, framework, repoUrl, timeoutMs = 10 * 60 * 1000, allowedRoots } = payload;
    if (!filePath || !repoUrl) {
        throw new Error('自动发布需要 filePath 与 repoUrl');
    }

    assertAllowedRoots(filePath, allowedRoots, 'watch');

    const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const initialMtime = fs.existsSync(filePath) ? fs.statSync(filePath).mtimeMs : 0;
    const startedAt = Date.now();

    publishJobs.set(jobId, {
        status: 'watching',
        message: '等待文件保存中...',
        filePath,
        startedAt,
        publishResult: null
    });

    const timer = setInterval(() => {
        const job = publishJobs.get(jobId);
        if (!job) {
            clearInterval(timer);
            return;
        }

        if (Date.now() - startedAt > timeoutMs) {
            job.status = 'timeout';
            job.message = '等待保存超时，请重新触发自动发布。';
            clearInterval(timer);
            return;
        }

        if (!fs.existsSync(filePath)) {
            return;
        }

        const currentMtime = fs.statSync(filePath).mtimeMs;
        if (currentMtime <= initialMtime) {
            return;
        }

        clearInterval(timer);
        job.status = 'publishing';
        job.message = '检测到保存，开始自动发布...';

        try {
            const publishResult = publishToGitHub({ projectDir, framework, repoUrl });
            job.publishResult = publishResult;
            if (publishResult?.ok) {
                job.status = 'done';
                job.message = '自动发布完成。';
            } else {
                job.status = 'error';
                job.message = publishResult?.message || '自动发布失败。';
            }
        } catch (error) {
            job.status = 'error';
            job.message = error.message;
        }
    }, 3000);

    return { jobId, status: 'watching' };
}

function getPublishJobStatus(jobId) {
    return publishJobs.get(jobId) || null;
}

module.exports = {
    createAndOpenContent,
    listExistingContents,
    readExistingContent,
    saveExistingContent,
    openExistingContent,
    watchSaveAndAutoPublish,
    getPublishJobStatus,
    __test__: {
        setOpenPathForTests(nextImpl) {
            openPathImpl = typeof nextImpl === 'function'
                ? nextImpl
                : ((filePath) => shell.openPath(filePath));
        }
    }
};
