function evaluatePreviewOpenResult(result) {
    const source = result && typeof result === 'object' ? result : {};
    if (source.ok) {
        return {
            ...source,
            ok: true,
            phase: 'succeeded',
            message: source.message || '已打开本地预览地址。'
        };
    }

    return {
        ...source,
        ok: false,
        phase: 'failed',
        reason: source.reason || 'PREVIEW_OPEN_FAILED',
        message: source.message || '预览地址已被阻止。'
    };
}

function evaluatePreviewStopResult(result) {
    const source = result && typeof result === 'object' ? result : {};
    if (source.ok && source.stopped) {
        return {
            ...source,
            ok: true,
            phase: 'succeeded',
            message: source.message || '已停止本地预览。'
        };
    }

    return {
        ...source,
        ok: false,
        stopped: false,
        phase: 'failed',
        reason: source.reason || 'PREVIEW_NOT_RUNNING',
        message: source.message || '当前没有正在运行的预览进程。'
    };
}

module.exports = {
    evaluatePreviewOpenResult,
    evaluatePreviewStopResult
};
