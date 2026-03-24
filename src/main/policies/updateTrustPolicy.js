const TRUST_ERROR_PATTERN = /(signature|code\s*signature|publisher|certificate|cert|sha512|digest|trust)/i;

function evaluateUpdateTrust(input = {}) {
    const platform = String(input.platform || process.platform).toLowerCase();
    const verifyUpdateCodeSignature = input.verifyUpdateCodeSignature;
    const updaterError = String(input.updaterError || '');

    if (platform === 'win32') {
        if (verifyUpdateCodeSignature === false) {
            return {
                blocked: true,
                reason: 'WINDOWS_SIGNATURE_VERIFICATION_DISABLED',
                message: '更新已阻止：Windows 更新签名校验被禁用。'
            };
        }

        if (verifyUpdateCodeSignature !== true) {
            return {
                blocked: true,
                reason: 'WINDOWS_SIGNATURE_VERIFICATION_UNKNOWN',
                message: '更新已阻止：无法确认 Windows 更新签名校验设置。'
            };
        }
    }

    if (TRUST_ERROR_PATTERN.test(updaterError)) {
        return {
            blocked: true,
            reason: 'UPDATER_TRUST_FAILURE',
            message: '更新已阻止：更新包签名或信任校验失败。'
        };
    }

    return {
        blocked: false,
        reason: null,
        message: ''
    };
}

function buildBlockedTrustState(trustDecision) {
    return {
        status: 'blocked-trust',
        message: trustDecision?.message || '更新已阻止：信任策略校验失败。',
        hasUpdate: false,
        downloaded: false,
        latestVersion: null,
        percent: 0,
        error: trustDecision?.reason || 'TRUST_POLICY_BLOCKED',
        blockedReason: trustDecision?.reason || 'TRUST_POLICY_BLOCKED'
    };
}

function decideInstallUpdateAction(state = {}) {
    if (state.status === 'blocked-trust') {
        return {
            ok: false,
            blocked: true,
            reason: state.blockedReason || 'TRUST_POLICY_BLOCKED',
            message: state.message || '更新已被信任策略阻止。'
        };
    }

    if (state.status !== 'downloaded' || state.downloaded !== true) {
        return {
            ok: false,
            blocked: true,
            reason: 'UPDATE_NOT_READY',
            message: '更新尚未下载完成，暂不可安装。'
        };
    }

    return { ok: true };
}

module.exports = {
    evaluateUpdateTrust,
    buildBlockedTrustState,
    decideInstallUpdateAction
};
