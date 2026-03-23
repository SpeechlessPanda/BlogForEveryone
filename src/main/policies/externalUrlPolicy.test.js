const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluateExternalUrl, EXTERNAL_URL_RULES } = require('./externalUrlPolicy');

test('allows https urls for explicitly allowed hosts', () => {
    const decision = evaluateExternalUrl('https://nodejs.org/en/download', EXTERNAL_URL_RULES.installer);
    assert.equal(decision.allowed, true);
    assert.equal(decision.normalizedUrl, 'https://nodejs.org/en/download');
});

test('blocks dangerous and non-https schemes by default', () => {
    const candidates = [
        'http://nodejs.org/en/download',
        'file:///tmp/a.txt',
        'javascript:alert(1)',
        'data:text/html,boom',
        'custom-protocol://example/path'
    ];

    for (const candidate of candidates) {
        const decision = evaluateExternalUrl(candidate, EXTERNAL_URL_RULES.installer);
        assert.equal(decision.allowed, false, `expected blocked: ${candidate}`);
    }
});

test('blocks unknown https hosts even with safe scheme', () => {
    const decision = evaluateExternalUrl('https://evil.example.com/path', EXTERNAL_URL_RULES.installer);
    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, 'HOST_NOT_ALLOWED');
});

test('blocks arbitrary explicit preview url while still allowing local preview hosts', () => {
    const blocked = evaluateExternalUrl('https://example.com/blog', EXTERNAL_URL_RULES.preview);
    assert.equal(blocked.allowed, false);

    const allowedLocal = evaluateExternalUrl('http://127.0.0.1:1313/', EXTERNAL_URL_RULES.preview);
    assert.equal(allowedLocal.allowed, true);
});
