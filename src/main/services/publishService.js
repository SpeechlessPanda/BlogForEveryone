const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function ensureWorkflow(projectDir, framework) {
    const workflowDir = path.join(projectDir, '.github', 'workflows');
    fs.mkdirSync(workflowDir, { recursive: true });

    const cmd = framework === 'hexo' ? 'pnpm dlx hexo generate' : 'hugo';
    const artifactDir = framework === 'hexo' ? 'public' : 'public';

    const workflow = [
        'name: Deploy Blog',
        '',
        'on:',
        '  push:',
        '    branches: ["main"]',
        '  workflow_dispatch:',
        '',
        'permissions:',
        '  contents: read',
        '  pages: write',
        '  id-token: write',
        '',
        'concurrency:',
        '  group: "pages"',
        '  cancel-in-progress: false',
        '',
        'jobs:',
        '  build:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - uses: actions/checkout@v4',
        '      - uses: actions/setup-node@v4',
        '        with:',
        '          node-version: 20',
        '      - uses: pnpm/action-setup@v4',
        '        with:',
        '          version: 9',
        '      - name: Install dependencies',
        '        run: pnpm install',
        '      - name: Build site',
        `        run: ${cmd}`,
        '      - uses: actions/upload-pages-artifact@v3',
        '        with:',
        `          path: ${artifactDir}`,
        '',
        '  deploy:',
        '    environment:',
        '      name: github-pages',
        '      url: ${{ steps.deployment.outputs.page_url }}',
        '    runs-on: ubuntu-latest',
        '    needs: build',
        '    steps:',
        '      - id: deployment',
        '        uses: actions/deploy-pages@v4',
        ''
    ].join('\n');

    fs.writeFileSync(path.join(workflowDir, 'deploy.yml'), workflow, 'utf-8');
}

function runGitCommands(projectDir, repoUrl) {
    const commands = [
        ['git', ['init']],
        ['git', ['add', '.']],
        ['git', ['commit', '-m', 'chore: initialize blog project']],
        ['git', ['branch', '-M', 'main']],
        ['git', ['remote', 'add', 'origin', repoUrl]],
        ['git', ['push', '-u', 'origin', 'main']]
    ];

    const outputs = [];
    for (const [bin, args] of commands) {
        const result = spawnSync(bin, args, {
            cwd: projectDir,
            shell: true,
            encoding: 'utf-8'
        });
        outputs.push({ bin, args, code: result.status, stderr: result.stderr, stdout: result.stdout });
        if (result.status !== 0) {
            break;
        }
    }
    return outputs;
}

function publishToGitHub(payload) {
    const { projectDir, framework, repoUrl } = payload;
    ensureWorkflow(projectDir, framework);
    return runGitCommands(projectDir, repoUrl);
}

module.exports = {
    publishToGitHub
};
