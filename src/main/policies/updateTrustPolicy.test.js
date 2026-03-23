const test = require('node:test');
const assert = require('node:assert/strict');

const {
    evaluateUpdateTrust,
    buildBlockedTrustState,
    decideInstallUpdateAction
} = require('./updateTrustPolicy');

test('marks trust as blocked when windows signature verification is disabled', () => {
    const decision = evaluateUpdateTrust({
        platform: 'win32',
        verifyUpdateCodeSignature: false
    });

    assert.equal(decision.blocked, true);
    assert.equal(decision.reason, 'WINDOWS_SIGNATURE_VERIFICATION_DISABLED');
});

test('marks trust as blocked when windows signature verification setting is unknown', () => {
    const decision = evaluateUpdateTrust({
        platform: 'win32',
        verifyUpdateCodeSignature: undefined
    });

    assert.equal(decision.blocked, true);
    assert.equal(decision.reason, 'WINDOWS_SIGNATURE_VERIFICATION_UNKNOWN');
});

test('marks trust as blocked when updater error indicates signature/trust failure', () => {
    const decision = evaluateUpdateTrust({
        platform: 'win32',
        verifyUpdateCodeSignature: true,
        updaterError: 'Publisher mismatch: code signature invalid'
    });

    assert.equal(decision.blocked, true);
    assert.equal(decision.reason, 'UPDATER_TRUST_FAILURE');
});

test('keeps trust unblocked when signature checks are enabled and no trust error is present', () => {
    const decision = evaluateUpdateTrust({
        platform: 'win32',
        verifyUpdateCodeSignature: true,
        updaterError: ''
    });

    assert.equal(decision.blocked, false);
});

test('returns explicit blocked-update outcome for install action when trust is blocked', () => {
    const trust = evaluateUpdateTrust({
        platform: 'win32',
        verifyUpdateCodeSignature: false
    });
    const blockedState = buildBlockedTrustState(trust);

    const installDecision = decideInstallUpdateAction(blockedState);
    assert.deepEqual(installDecision, {
        ok: false,
        blocked: true,
        reason: 'WINDOWS_SIGNATURE_VERIFICATION_DISABLED',
        message: blockedState.message
    });
});
