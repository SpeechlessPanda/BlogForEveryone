const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const themeService = require('./themeService');

test('infers recognized Hexo theme id from project config', (t) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-theme-hexo-'));
    t.after(() => {
        fs.rmSync(projectDir, { recursive: true, force: true });
    });

    fs.writeFileSync(path.join(projectDir, '_config.yml'), 'theme: next\n', 'utf-8');

    const inferred = themeService.inferRecognizedThemeIdFromProject(projectDir, 'hexo');
    assert.equal(inferred, 'next');
});

test('returns unknown for unrecognized imported theme', (t) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfe-theme-unknown-'));
    t.after(() => {
        fs.rmSync(projectDir, { recursive: true, force: true });
    });

    fs.writeFileSync(path.join(projectDir, 'hugo.toml'), 'theme = "some-random-theme"\n', 'utf-8');

    const inferred = themeService.inferRecognizedThemeIdFromProject(projectDir, 'hugo');
    assert.equal(inferred, 'unknown');
});
