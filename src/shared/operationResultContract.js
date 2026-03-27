const RESULT_CODES = Object.freeze({
    ok: 'ok',
    validationFailed: 'validation_failed',
    unauthorized: 'unauthorized',
    permissionDenied: 'permission_denied',
    notFound: 'not_found',
    conflict: 'conflict',
    networkError: 'network_error',
    runtimeError: 'runtime_error',
    unknownError: 'unknown_error'
});

const RESULT_CATEGORIES = Object.freeze({
    validation: 'validation',
    auth: 'auth',
    permission: 'permission',
    notFound: 'not_found',
    conflict: 'conflict',
    network: 'network',
    runtime: 'runtime',
    unknown: 'unknown'
});

const COMBINED_OPERATION_STATUS = Object.freeze({
    success: 'success',
    partialSuccess: 'partial_success',
    failed: 'failed'
});

module.exports = {
    RESULT_CODES,
    RESULT_CATEGORIES,
    COMBINED_OPERATION_STATUS
};
