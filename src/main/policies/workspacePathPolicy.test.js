const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createWorkspacePathPolicy } = require('./workspacePathPolicy');

function makeWorkspace(id, projectDir, framework = 'hexo') {
    return { id, projectDir, framework };
}

test('allows managed workspace root and nested content paths', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-policy-'));
    const workspaceRoot = path.join(tmpDir, 'workspace-a');
    const contentDir = path.join(workspaceRoot, 'source', '_posts');
    const contentFile = path.join(contentDir, 'hello.md');

    fs.mkdirSync(contentDir, { recursive: true });
    fs.writeFileSync(contentFile, '# hello', 'utf-8');

    const policy = createWorkspacePathPolicy({
        getManagedWorkspaces: () => [makeWorkspace('ws-a', workspaceRoot, 'hexo')]
    });

    assert.equal(policy.isPathWithinWorkspace('ws-a', workspaceRoot), true);
    assert.equal(policy.isContentPathAllowed('ws-a', contentFile), true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('rejects sibling and system paths outside managed roots', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-policy-'));
    const workspaceRoot = path.join(tmpDir, 'workspace-a');
    const siblingRoot = path.join(tmpDir, 'workspace-b');

    fs.mkdirSync(path.join(workspaceRoot, 'source', '_posts'), { recursive: true });
    fs.mkdirSync(path.join(siblingRoot, 'source', '_posts'), { recursive: true });

    const policy = createWorkspacePathPolicy({
        getManagedWorkspaces: () => [makeWorkspace('ws-a', workspaceRoot, 'hexo')]
    });

    assert.equal(policy.isPathWithinWorkspace('ws-a', siblingRoot), false);
    assert.equal(policy.isPathWithinWorkspace('ws-a', os.homedir()), false);

    assert.throws(
        () => policy.assertPathWithinWorkspace('ws-a', siblingRoot, 'delete'),
        /越界/
    );

    fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('enforces per-workspace content permissions', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-policy-'));
    const workspaceA = path.join(tmpDir, 'workspace-a');
    const workspaceB = path.join(tmpDir, 'workspace-b');
    const fileA = path.join(workspaceA, 'source', '_posts', 'a.md');
    const fileB = path.join(workspaceB, 'source', '_posts', 'b.md');

    fs.mkdirSync(path.dirname(fileA), { recursive: true });
    fs.mkdirSync(path.dirname(fileB), { recursive: true });
    fs.writeFileSync(fileA, '# a', 'utf-8');
    fs.writeFileSync(fileB, '# b', 'utf-8');

    const policy = createWorkspacePathPolicy({
        getManagedWorkspaces: () => [
            makeWorkspace('ws-a', workspaceA, 'hexo'),
            makeWorkspace('ws-b', workspaceB, 'hexo')
        ]
    });

    assert.equal(policy.isContentPathAllowed('ws-a', fileA), true);
    assert.equal(policy.isContentPathAllowed('ws-a', fileB), false);

    assert.throws(
        () => policy.assertContentPathAllowed('ws-a', fileB, 'write'),
        /越界/
    );

    fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('does not allow arbitrary workspace-root files as content paths', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-policy-'));
    const workspaceRoot = path.join(tmpDir, 'workspace-a');
    const contentFile = path.join(workspaceRoot, 'source', '_posts', 'a.md');
    const nonContentFile = path.join(workspaceRoot, 'README.md');

    fs.mkdirSync(path.dirname(contentFile), { recursive: true });
    fs.writeFileSync(contentFile, '# post', 'utf-8');
    fs.writeFileSync(nonContentFile, '# readme', 'utf-8');

    const policy = createWorkspacePathPolicy({
        getManagedWorkspaces: () => [makeWorkspace('ws-a', workspaceRoot, 'hexo')]
    });

    assert.equal(policy.isContentPathAllowed('ws-a', contentFile), true);
    assert.equal(policy.isContentPathAllowed('ws-a', nonContentFile), false);

    fs.rmSync(tmpDir, { recursive: true, force: true });
});
