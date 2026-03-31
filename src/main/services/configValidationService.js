const path = require('path');
const { RESULT_CODES, RESULT_CATEGORIES } = require('../../shared/operationResultContract');

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function isValidEmail(value) {
    if (!value) {
        return true;
    }
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function isHttpUrl(value) {
    if (!value) {
        return true;
    }
    try {
        const parsed = new URL(String(value));
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function isAssetPathOrUrl(value) {
    if (!value) {
        return true;
    }
    const text = String(value).trim();
    return text.startsWith('/') || isHttpUrl(text);
}

function validateThemeSettings(payload) {
    const framework = String(payload?.framework || '').toLowerCase();
    const themeId = String(payload?.themeId || '').toLowerCase();
    const basicFields = payload?.basicFields || {};

    const errors = [];
    const warnings = [];

    if (!isNonEmptyString(basicFields.siteTitle)) {
        errors.push('网站标题不能为空。');
    }

    if (!isValidEmail(basicFields.email)) {
        errors.push('邮箱格式不正确。');
    }

    if (!isHttpUrl(basicFields.github)) {
        errors.push('GitHub 链接必须是 http 或 https 地址。');
    }

    if (!isAssetPathOrUrl(basicFields.backgroundImage)) {
        errors.push('背景图路径必须是 / 开头的站内路径或 http(s) 链接。');
    }

    if (!isAssetPathOrUrl(basicFields.favicon)) {
        errors.push('网站图标路径必须是 / 开头的站内路径或 http(s) 链接。');
    }

    if (framework === 'hugo' && themeId === 'papermod') {
        if (!basicFields.github && !basicFields.email) {
            warnings.push('PaperMod 建议至少配置 GitHub 或邮箱，以显示主页社交图标。');
        }
    }

    return {
        ok: errors.length === 0,
        errors,
        warnings
    };
}

function parseGithubRepo(repoUrl) {
    const clean = String(repoUrl || '').trim().replace(/\.git$/i, '');
    const match = clean.match(/github\.com[/:]([^/]+)\/([^/]+)$/i);
    if (!match) {
        return null;
    }
    return {
        owner: match[1],
        repo: match[2]
    };
}

function validatePublishPayload(payload) {
    const errors = [];
    const warnings = [];

    const framework = String(payload?.framework || '').toLowerCase();
    const mode = String(payload?.publishMode || 'actions');

    if (!parseGithubRepo(payload?.repoUrl)) {
        errors.push('发布仓库地址格式错误，请填写完整 GitHub 仓库地址。');
    }

    if (!['actions', 'hexo-deploy'].includes(mode)) {
        errors.push('发布模式无效。');
    }

    if (mode === 'hexo-deploy' && framework !== 'hexo') {
        errors.push('hexo-deploy 模式仅支持 Hexo 工程。');
    }

    if (!isValidEmail(payload?.gitUserEmail)) {
        errors.push('Git 提交邮箱格式不正确。');
    }

    if (payload?.gitUserName && !isNonEmptyString(payload.gitUserName)) {
        errors.push('Git 提交用户名不能为空字符串。');
    }

    const parsedRepo = parseGithubRepo(payload?.repoUrl);
    if (parsedRepo && parsedRepo.repo.toLowerCase() !== `${parsedRepo.owner.toLowerCase()}.github.io`) {
        warnings.push('当前仓库不是 用户名.github.io，将按 project page 路径发布。');
    }

    return {
        ok: errors.length === 0,
        errors,
        warnings,
        parsedRepo
    };
}

function createValidationFailure(key, message, normalizedPayload = null) {
    return {
        ok: false,
        code: RESULT_CODES.validationFailed,
        category: RESULT_CATEGORIES.validation,
        causes: [{ key, message }],
        normalizedPayload
    };
}

function validateGithubImportPayload(payload = {}) {
    const localDestinationPath = String(payload.localDestinationPath || '').trim();
    if (!localDestinationPath || !path.isAbsolute(localDestinationPath)) {
        return createValidationFailure('destination_path_invalid', '导入目标路径必须为绝对路径。');
    }

    const backupRepo = payload.backupRepo && typeof payload.backupRepo === 'object'
        ? payload.backupRepo
        : null;
    const backupRepoUrl = String(payload.backupRepoUrl || backupRepo?.url || '').trim();
    const parsedBackupRepo = parseGithubRepo(backupRepoUrl);
    if (!parsedBackupRepo) {
        return createValidationFailure('backup_repo_invalid', '备份仓库地址格式错误，无法执行 GitHub 导入。');
    }

    return {
        ok: true,
        normalizedPayload: {
            ...payload,
            localDestinationPath,
            backupRepo: backupRepo
                ? {
                    ...backupRepo,
                    owner: parsedBackupRepo.owner,
                    name: parsedBackupRepo.repo,
                    url: backupRepoUrl
                }
                : {
                    owner: parsedBackupRepo.owner,
                    name: parsedBackupRepo.repo,
                    url: backupRepoUrl
                }
        }
    };
}

function validateGithubImportRepositoryState(payload = {}) {
    const hasDeployRepo = Boolean(payload.hasDeployRepo);
    const hasBackupRepo = Boolean(payload.hasBackupRepo);
    if (hasDeployRepo && !hasBackupRepo) {
        return createValidationFailure(
            'github_import_backup_missing',
            '仅存在发布仓库且缺少 BFE 备份仓库时，不支持 GitHub 直连导入。'
        );
    }

    return { ok: true };
}

module.exports = {
    validateThemeSettings,
    validatePublishPayload,
    validateGithubImportPayload,
    validateGithubImportRepositoryState
};
