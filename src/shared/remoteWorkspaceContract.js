const FIXED_BACKUP_REPO_NAME = 'BFE';

const REMOTE_SITE_TYPES = Object.freeze({
    userPages: 'user-pages',
    projectPages: 'project-pages'
});

const REMOTE_IMPORT_SOURCES = Object.freeze({
    localDirectory: 'local-directory',
    githubRemote: 'github-remote'
});

const REMOTE_REPO_VISIBILITY = Object.freeze({
    public: 'public',
    private: 'private'
});

const REMOTE_REPO_SOURCE_TYPES = Object.freeze({
    existing: 'existing',
    autoCreated: 'auto-created',
    manualEntry: 'manual-entry'
});

function normalizeAllowedValue(value, allowedValues, fallbackValue) {
    return allowedValues.includes(value) ? value : fallbackValue;
}

function normalizeStringValue(value, fallbackValue = '') {
    return typeof value === 'string' ? value : fallbackValue;
}

function normalizeFixedRepoUrl(url, fixedName) {
    const normalizedUrl = normalizeStringValue(url);
    if (!normalizedUrl) {
        return '';
    }

    const httpsMatch = normalizedUrl.match(/^(https?:\/\/(?:www\.)?github\.com\/[^/]+\/)([^/]+?)(\.git)?\/?$/i);
    if (httpsMatch) {
        const [, prefix, , suffix = ''] = httpsMatch;
        return `${prefix}${fixedName}${suffix}`;
    }

    const sshMatch = normalizedUrl.match(/^(git@github\.com:[^/]+\/)([^/]+?)(\.git)?$/i);
    if (sshMatch) {
        const [, prefix, , suffix = ''] = sshMatch;
        return `${prefix}${fixedName}${suffix}`;
    }

    const gitSshMatch = normalizedUrl.match(/^(git\+ssh:\/\/git@github\.com\/[^/]+\/)([^/]+?)(\.git)?\/?$/i);
    if (gitSshMatch) {
        const [, prefix, , suffix = ''] = gitSshMatch;
        return `${prefix}${fixedName}${suffix}`;
    }

    return normalizedUrl;
}

function hydrateRepoMetadata(repo, options = {}) {
    const source = repo && typeof repo === 'object' ? repo : {};
    const fixedName = options.fixedName || null;
    const repoName = fixedName || normalizeStringValue(source.name);
    return {
        ...source,
        owner: normalizeStringValue(source.owner),
        name: repoName,
        url: fixedName
            ? normalizeFixedRepoUrl(source.url, fixedName)
            : normalizeStringValue(source.url),
        visibility: normalizeAllowedValue(
            source.visibility,
            Object.values(REMOTE_REPO_VISIBILITY),
            REMOTE_REPO_VISIBILITY.public
        ),
        sourceType: normalizeAllowedValue(
            source.sourceType,
            Object.values(REMOTE_REPO_SOURCE_TYPES),
            REMOTE_REPO_SOURCE_TYPES.manualEntry
        )
    };
}

function hydrateWorkspaceRemoteMetadata(workspace) {
    const source = workspace && typeof workspace === 'object' ? workspace : {};
    return {
        ...source,
        siteType: normalizeAllowedValue(source.siteType, Object.values(REMOTE_SITE_TYPES), null),
        deployRepo: hydrateRepoMetadata(source.deployRepo),
        backupRepo: hydrateRepoMetadata(source.backupRepo, { fixedName: FIXED_BACKUP_REPO_NAME }),
        importSource: normalizeAllowedValue(
            source.importSource,
            Object.values(REMOTE_IMPORT_SOURCES),
            REMOTE_IMPORT_SOURCES.localDirectory
        ),
        localProjectPath: normalizeStringValue(source.localProjectPath, normalizeStringValue(source.projectDir))
    };
}

module.exports = {
    FIXED_BACKUP_REPO_NAME,
    REMOTE_SITE_TYPES,
    REMOTE_IMPORT_SOURCES,
    REMOTE_REPO_VISIBILITY,
    REMOTE_REPO_SOURCE_TYPES,
    hydrateWorkspaceRemoteMetadata
};
