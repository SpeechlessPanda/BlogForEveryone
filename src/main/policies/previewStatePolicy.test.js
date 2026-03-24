const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluatePreviewStopResult, evaluatePreviewOpenResult } = require('./previewStatePolicy');

test('treats stop result with stopped=false as failed stop operation', () => {
    const result = evaluatePreviewStopResult({ ok: true, stopped: false });

    assert.equal(result.ok, false);
    assert.equal(result.phase, 'failed');
    assert.equal(result.reason, 'PREVIEW_NOT_RUNNING');
    assert.match(result.message, /没有正在运行的预览进程/);
});

test('keeps open result blocked state as failed', () => {
    const result = evaluatePreviewOpenResult({
        ok: false,
        reason: 'PREVIEW_URL_BLOCKED',
        message: '预览地址不受信任，已阻止打开。'
    });

    assert.equal(result.ok, false);
    assert.equal(result.phase, 'failed');
    assert.equal(result.reason, 'PREVIEW_URL_BLOCKED');
});
