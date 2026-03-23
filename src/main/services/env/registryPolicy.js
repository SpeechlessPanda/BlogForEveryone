const MIRROR_REGISTRY = 'https://registry.npmmirror.com';

function getWingetPackageIds(tool) {
    if (tool === 'git') {
        return ['Git.Git'];
    }
    if (tool === 'node') {
        return ['OpenJS.NodeJS.LTS'];
    }
    if (tool === 'hugo') {
        return ['Hugo.Hugo.Extended', 'Hugo.Hugo'];
    }
    if (tool === 'hugo-extended') {
        return ['Hugo.Hugo.Extended'];
    }
    return null;
}

module.exports = {
    MIRROR_REGISTRY,
    getWingetPackageIds
};
