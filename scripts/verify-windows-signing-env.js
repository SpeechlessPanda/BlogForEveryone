const WINDOWS_SIGNING_REQUIRED_ENV = ['CSC_LINK', 'CSC_KEY_PASSWORD'];

function normalizeEnvValue(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function checkWindowsSigningEnv(env = process.env) {
    const missing = WINDOWS_SIGNING_REQUIRED_ENV.filter((name) => normalizeEnvValue(env[name]).length === 0);
    return {
        ok: missing.length === 0,
        missing
    };
}

function formatMissingMessage(missing) {
    return [
        '签名发布缺少必需环境变量：',
        ...missing.map((name) => `- ${name}`),
        '请先配置证书后再运行 package:signed 或 release。'
    ].join('\n');
}

function run() {
    const result = checkWindowsSigningEnv(process.env);
    if (!result.ok) {
        throw new Error(formatMissingMessage(result.missing));
    }

    console.log('verify-windows-signing-env: OK');
}

if (require.main === module) {
    run();
}

module.exports = {
    WINDOWS_SIGNING_REQUIRED_ENV,
    checkWindowsSigningEnv,
    formatMissingMessage,
    run
};
