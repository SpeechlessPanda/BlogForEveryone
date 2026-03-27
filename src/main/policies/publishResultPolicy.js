const {
    COMBINED_OPERATION_STATUS,
    RESULT_CODES,
    RESULT_CATEGORIES
} = require('../../shared/operationResultContract');

function isOutcomeRecord(value) {
    return value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'ok');
}

function normalizeCombinedPublishResult(source) {
    const deployRepoEnsure = isOutcomeRecord(source.deployRepoEnsure)
        ? source.deployRepoEnsure
        : { ok: false, code: RESULT_CODES.runtimeError, category: RESULT_CATEGORIES.runtime, userMessage: '发布仓库检查未执行。' };
    const backupRepoEnsure = isOutcomeRecord(source.backupRepoEnsure)
        ? source.backupRepoEnsure
        : { ok: false, code: RESULT_CODES.runtimeError, category: RESULT_CATEGORIES.runtime, userMessage: '备份仓库检查未执行。' };
    const deployPublish = isOutcomeRecord(source.deployPublish)
        ? source.deployPublish
        : { ok: false, code: RESULT_CODES.runtimeError, category: RESULT_CATEGORIES.runtime, userMessage: '发布执行未完成。' };
    const backupPush = isOutcomeRecord(source.backupPush)
        ? source.backupPush
        : { ok: false, code: RESULT_CODES.runtimeError, category: RESULT_CATEGORIES.runtime, userMessage: '备份推送未完成。' };

    const ensureOk = Boolean(deployRepoEnsure.ok && backupRepoEnsure.ok);
    const deployOk = Boolean(deployPublish.ok);
    const backupOk = Boolean(backupPush.ok);

    let status = COMBINED_OPERATION_STATUS.failed;
    if (ensureOk && deployOk && backupOk) {
        status = COMBINED_OPERATION_STATUS.success;
    } else if (ensureOk && ((deployOk && !backupOk) || (!deployOk && backupOk))) {
        status = COMBINED_OPERATION_STATUS.partialSuccess;
    }

    return {
        ...source,
        ok: status === COMBINED_OPERATION_STATUS.success,
        status,
        deployRepoEnsure,
        backupRepoEnsure,
        deployPublish,
        backupPush
    };
}

function normalizePublishResult(input) {
    const source = input && typeof input === 'object' ? input : {};

    const hasCombinedChildren = ['deployRepoEnsure', 'backupRepoEnsure', 'deployPublish', 'backupPush']
        .some((key) => Object.prototype.hasOwnProperty.call(source, key));
    if (hasCombinedChildren) {
        return normalizeCombinedPublishResult(source);
    }

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
