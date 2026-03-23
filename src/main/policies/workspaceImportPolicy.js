const SUPPORTED_IMPORTED_FRAMEWORKS = new Set(['hexo', 'hugo']);

function assertSupportedImportedFramework(framework) {
    if (!SUPPORTED_IMPORTED_FRAMEWORKS.has(framework)) {
        throw new Error('导入目录不支持，未识别到受支持的博客框架（仅支持 Hexo/Hugo）。');
    }
    return framework;
}

module.exports = {
    assertSupportedImportedFramework
};
