const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const TOML = require('@iarna/toml');

const themeCatalogPath = path.join(__dirname, '../../shared/data/themeCatalog.json');

function getThemeCatalog() {
    const raw = fs.readFileSync(themeCatalogPath, 'utf-8');
    return JSON.parse(raw);
}

function readThemeConfig(projectDir, framework) {
    if (framework === 'hexo') {
        const filePath = path.join(projectDir, '_config.yml');
        if (!fs.existsSync(filePath)) {
            return {};
        }
        return YAML.parse(fs.readFileSync(filePath, 'utf-8')) || {};
    }

    if (framework === 'hugo') {
        const fileCandidates = ['hugo.toml', 'config.toml'];
        const fileName = fileCandidates.find((name) => fs.existsSync(path.join(projectDir, name)));
        if (!fileName) {
            return {};
        }
        return TOML.parse(fs.readFileSync(path.join(projectDir, fileName), 'utf-8')) || {};
    }

    return {};
}

function saveThemeConfig(projectDir, framework, nextConfig) {
    if (framework === 'hexo') {
        const filePath = path.join(projectDir, '_config.yml');
        fs.writeFileSync(filePath, YAML.stringify(nextConfig), 'utf-8');
        return;
    }

    if (framework === 'hugo') {
        const filePath = fs.existsSync(path.join(projectDir, 'hugo.toml'))
            ? path.join(projectDir, 'hugo.toml')
            : path.join(projectDir, 'config.toml');
        fs.writeFileSync(filePath, TOML.stringify(nextConfig), 'utf-8');
    }
}

function saveLocalAssetToBlog(payload) {
    const {
        projectDir,
        framework,
        localFilePath,
        assetType = 'image',
        preferredDir,
        preferredFileName
    } = payload;
    if (!localFilePath || !fs.existsSync(localFilePath)) {
        throw new Error('本地资源文件不存在');
    }

    const ext = path.extname(localFilePath) || '.png';
    const sanitizedName = String(preferredFileName || '').trim().replace(/[\\/:*?"<>|]/g, '');
    const baseName = sanitizedName
        ? (path.extname(sanitizedName) ? sanitizedName : `${sanitizedName}${ext}`)
        : (assetType === 'favicon' ? `favicon${ext}` : `${Date.now()}${ext}`);

    const fallbackDir = framework === 'hexo' ? path.join('source', 'img') : path.join('static', 'img');
    const normalizedPreferredDir = String(preferredDir || '').trim().replace(/^[/\\]+/, '').replace(/\.\./g, '');
    const relativeDir = normalizedPreferredDir || fallbackDir;
    const targetRoot = path.join(projectDir, relativeDir);
    fs.mkdirSync(targetRoot, { recursive: true });

    const targetPath = path.join(targetRoot, baseName);
    fs.copyFileSync(localFilePath, targetPath);

    const webPrefix = framework === 'hexo' ? relativeDir.replace(/^source[\\/]/, '') : relativeDir.replace(/^static[\\/]/, '');
    const webPath = `/${webPrefix.replace(/\\/g, '/')}/${baseName}`.replace(/\/+/g, '/');

    return {
        savedPath: targetPath,
        webPath
    };
}

module.exports = {
    getThemeCatalog,
    readThemeConfig,
    saveThemeConfig,
    saveLocalAssetToBlog
};
