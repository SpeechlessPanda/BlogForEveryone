const path = require('path');
const fs = require('fs');
const rcedit = require('rcedit');

async function setWindowsExeIcon(context) {
    if (context.electronPlatformName !== 'win32') {
        return;
    }

    const productFilename = context.packager.appInfo.productFilename;
    const exePath = path.join(context.appOutDir, `${productFilename}.exe`);
    const iconPath = path.join(context.packager.projectDir, 'build', 'icon.ico');

    if (!fs.existsSync(exePath)) {
        throw new Error(`afterPack: target exe not found: ${exePath}`);
    }

    if (!fs.existsSync(iconPath)) {
        throw new Error(`afterPack: icon file not found: ${iconPath}`);
    }

    await rcedit(exePath, {
        icon: iconPath
    });

    console.log(`afterPack: icon applied to ${exePath}`);
}

exports.default = setWindowsExeIcon;