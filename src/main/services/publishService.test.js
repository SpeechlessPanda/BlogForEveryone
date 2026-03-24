const test = require('node:test');
const assert = require('node:assert/strict');

const publishService = require('./publishService');

test('Hugo workflow uses inferred project-pages base URL', () => {
    const workflow = publishService.__test__.buildWorkflowContent({
        framework: 'hugo',
        repoUrl: 'https://github.com/ming/my-blog.git'
    });

    assert.match(workflow, /run: hugo --baseURL https:\/\/ming\.github\.io\/my-blog\//);
});

test('Hexo workflow command remains unchanged', () => {
    const workflow = publishService.__test__.buildWorkflowContent({
        framework: 'hexo',
        repoUrl: 'https://github.com/ming/ming.github.io.git'
    });

    assert.match(workflow, /run: pnpm dlx hexo generate/);
});
