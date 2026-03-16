const fs = require('fs');
const path = require('path');
const { shell } = require('electron');
const { publishToGitHub } = require('./publishService');

const publishJobs = new Map();

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

    const pageName = safeSlug || type;
    if (framework === 'hexo') {
        return path.join(projectDir, 'source', pageName, 'index.md');
    }
    return path.join(projectDir, 'content', pageName, 'index.md');
}

function createAndOpenContent(payload) {
    const { projectDir, framework, type = 'post', title = '新内容', slug = '' } = payload;
    const filePath = resolveContentPath({ projectDir, framework, type, title, slug });
    const content = type === 'post' ? postTemplate(title) : pageTemplate(title);

    ensureFile(filePath, content);
    shell.openPath(filePath);

    return { ok: true, filePath };
}

function watchSaveAndAutoPublish(payload) {
    const { filePath, projectDir, framework, repoUrl, timeoutMs = 10 * 60 * 1000 } = payload;
    if (!filePath || !repoUrl) {
        throw new Error('自动发布需要 filePath 与 repoUrl');
    }

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
            job.status = 'done';
            job.message = '自动发布完成。';
            job.publishResult = publishResult;
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
    watchSaveAndAutoPublish,
    getPublishJobStatus
};
