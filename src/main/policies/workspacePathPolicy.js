const fs = require('fs');
const path = require('path');

function normalizePath(inputPath) {
    const resolved = path.resolve(String(inputPath || ''));
    if (fs.existsSync(resolved)) {
        try {
            return fs.realpathSync.native(resolved);
        } catch {
            return fs.realpathSync(resolved);
        }
    }
    return resolved;
}

function normalizeForCompare(inputPath) {
    const normalized = normalizePath(inputPath);
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
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

function assertPathWithinRoots(candidatePath, allowedRoots, action = '访问内容') {
    if (!Array.isArray(allowedRoots) || !allowedRoots.length) {
        throw new Error(`缺少受管内容路径白名单，拒绝${action}操作。`);
    }

    if (!allowedRoots.some((root) => isSubPath(root, candidatePath))) {
        throw new Error(`内容路径越界，拒绝${action}操作。`);
    }

    return normalizePath(candidatePath);
}

function getFrameworkContentRoots(workspace) {
    const projectDir = normalizePath(workspace.projectDir);
    if (workspace.framework === 'hexo') {
        return [
            path.join(projectDir, 'source'),
            path.join(projectDir, 'source', '_posts'),
            path.join(projectDir, 'source', 'about'),
            path.join(projectDir, 'source', 'links'),
            path.join(projectDir, 'source', 'announcement')
        ];
    }

    if (workspace.framework === 'hugo') {
        return [
            path.join(projectDir, 'content'),
            path.join(projectDir, 'content', 'posts'),
            path.join(projectDir, 'content', 'about'),
            path.join(projectDir, 'content', 'links'),
            path.join(projectDir, 'content', 'announcement')
        ];
    }

    return [];
}

function getFrameworkAssetRoots(workspace) {
    const projectDir = normalizePath(workspace.projectDir);
    if (workspace.framework === 'hexo') {
        return [path.join(projectDir, 'source', 'images')];
    }

    if (workspace.framework === 'hugo') {
        return [
            path.join(projectDir, 'static', 'uploads'),
            path.join(projectDir, 'assets', 'img')
        ];
    }

    return [];
}

function createWorkspacePathPolicy(options = {}) {
    const getManagedWorkspaces = typeof options.getManagedWorkspaces === 'function'
        ? options.getManagedWorkspaces
        : () => [];

    function listManagedWorkspaces() {
        return (getManagedWorkspaces() || []).filter((workspace) => workspace && workspace.id && workspace.projectDir);
    }

    function getManagedWorkspace(workspaceId) {
        if (!workspaceId) {
            throw new Error('缺少受管工作区 ID。');
        }

        const workspace = listManagedWorkspaces().find((item) => item.id === workspaceId);
        if (!workspace) {
            throw new Error('未找到受管工作区。');
        }

        return workspace;
    }

    function isPathWithinWorkspace(workspaceId, candidatePath) {
        const workspace = getManagedWorkspace(workspaceId);
        return isSubPath(workspace.projectDir, candidatePath);
    }

    function assertPathWithinWorkspace(workspaceId, candidatePath, action = '访问') {
        if (!isPathWithinWorkspace(workspaceId, candidatePath)) {
            throw new Error(`路径越界，拒绝${action}操作。`);
        }
        return normalizePath(candidatePath);
    }

    function getAllowedContentRoots(workspaceId) {
        const workspace = getManagedWorkspace(workspaceId);
        return [
            ...getFrameworkContentRoots(workspace),
            ...getFrameworkAssetRoots(workspace)
        ];
    }

    function isContentPathAllowed(workspaceId, candidatePath) {
        const roots = getAllowedContentRoots(workspaceId);
        return roots.some((root) => isSubPath(root, candidatePath));
    }

    function assertContentPathAllowed(workspaceId, candidatePath, action = '访问内容') {
        if (!isContentPathAllowed(workspaceId, candidatePath)) {
            throw new Error(`内容路径越界，拒绝${action}操作。`);
        }
        return normalizePath(candidatePath);
    }

    return {
        normalizePath,
        isSubPath,
        assertPathWithinRoots,
        listManagedWorkspaces,
        getManagedWorkspace,
        isPathWithinWorkspace,
        assertPathWithinWorkspace,
        getAllowedContentRoots,
        isContentPathAllowed,
        assertContentPathAllowed
    };
}

module.exports = {
    createWorkspacePathPolicy,
    normalizePath,
    normalizeForCompare,
    isSubPath,
    assertPathWithinRoots
};
