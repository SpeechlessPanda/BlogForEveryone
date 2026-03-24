function normalizePublishResult(input) {
    const source = input && typeof input === 'object' ? input : {};
    const mode = source.mode || 'actions';
    const logs = Array.isArray(source.logs) ? source.logs : [];
    const pagesUrl = String(source.pagesUrl || '');

    if (mode === 'actions') {
        const failedGitStep = logs.find((entry) => {
            if (!entry || entry.bin !== 'git') {
                return false;
            }
            if (entry.error) {
                return true;
            }
            if (entry.code === null) {
                return true;
            }
            return typeof entry.code === 'number' && entry.code !== 0;
        });

        if (failedGitStep) {
            return {
                ok: false,
                mode,
                pagesUrl: '',
                logs,
                reason: 'PUBLISH_GIT_COMMAND_FAILED',
                message: 'Git 子命令执行失败，发布未完成。'
            };
        }
    }

    const success = source.ok !== false;
    return {
        ...source,
        ok: success,
        mode,
        pagesUrl: success ? pagesUrl : '',
        logs
    };
}

module.exports = {
    normalizePublishResult
};
