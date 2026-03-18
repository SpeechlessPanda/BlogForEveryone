const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico');

async function main() {
    const projectRoot = path.resolve(__dirname, '..');
    const sourcePath = path.join(projectRoot, 'src', 'img', 'icon.jpg');
    const buildIconPath = path.join(projectRoot, 'build', 'icon.ico');
    const srcIconPath = path.join(projectRoot, 'src', 'img', 'icon.ico');

    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const pngBuffers = [];

    for (const size of sizes) {
        const pngBuffer = await sharp(sourcePath)
            .resize(size, size, {
                fit: 'cover',
                position: 'centre'
            })
            .png()
            .toBuffer();
        pngBuffers.push(pngBuffer);
    }

    const icoBuffer = await pngToIco(pngBuffers);
    await fs.mkdir(path.dirname(buildIconPath), { recursive: true });
    await fs.writeFile(buildIconPath, icoBuffer);
    await fs.writeFile(srcIconPath, icoBuffer);

    console.log(`Generated Windows icon with ${sizes.length} sizes at:`);
    console.log(`- ${buildIconPath}`);
    console.log(`- ${srcIconPath}`);
}

main().catch((error) => {
    console.error('Failed to generate Windows icon:', error);
    process.exitCode = 1;
});
