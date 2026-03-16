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

module.exports = {
    getThemeCatalog,
    readThemeConfig,
    saveThemeConfig
};
