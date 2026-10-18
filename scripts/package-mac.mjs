import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'darwin') throw new Error('Ce paquet local est destiné à macOS.');
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const release = join(root, 'release');
const staged = join(release, `.DecisionDrift-${randomUUID()}.app`);
const destination = join(release, 'DecisionDrift.app');
const previous = join(release, `.DecisionDrift-previous-${randomUUID()}.app`);
const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
await mkdir(release, { recursive: true });
try {
  await cp(join(root, 'node_modules/electron/dist/Electron.app'), staged, { recursive: true, verbatimSymlinks: true });
  const contents = join(staged, 'Contents');
  const resources = join(contents, 'Resources');
  const application = join(resources, 'app');
  await mkdir(join(application, 'node_modules'), { recursive: true });
  await cp(join(root, 'dist'), join(application, 'dist'), { recursive: true });
  await cp(join(root, 'dist-electron'), join(application, 'dist-electron'), { recursive: true });
  await cp(join(root, 'node_modules/zod'), join(application, 'node_modules/zod'), { recursive: true, verbatimSymlinks: true });
  await writeFile(join(application, 'package.json'), JSON.stringify({ name: metadata.name, productName: metadata.productName, version: metadata.version, type: 'module', main: metadata.main }, null, 2));
  await rm(join(resources, 'default_app.asar'), { force: true });
  const iconset = join(resources, 'DecisionDrift.iconset');
  await mkdir(iconset);
  const iconSource = join(iconset, 'icon_512x512@2x.png');
  execFileSync('/usr/bin/osascript', ['-l', 'JavaScript', join(root, 'scripts/render-mac-icon.js'), join(root, 'assets/icon.png'), iconSource]);
  for (const size of [16, 32, 128, 256, 512]) {
    for (const scale of [1, 2]) {
      const pixels = String(size * scale);
      const filename = `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`;
      if (pixels === '1024') continue; // The padded master is already this representation.
      execFileSync('/usr/bin/sips', ['-z', pixels, pixels, iconSource, '--out', join(iconset, filename)], { stdio: 'pipe' });
    }
  }
  execFileSync('/usr/bin/iconutil', ['-c', 'icns', iconset, '-o', join(resources, 'DecisionDrift.icns')]);
  await rm(iconset, { recursive: true });
  await rename(join(contents, 'MacOS/Electron'), join(contents, 'MacOS/DecisionDrift'));
  await mkdir(join(resources, 'node-bin'));
  await writeFile(join(resources, 'node-bin/node'), '#!/bin/sh\nELECTRON_RUN_AS_NODE=1 exec "${0%/*}/../../MacOS/DecisionDrift" "$@"\n', { mode: 0o755 });
  const plist = join(contents, 'Info.plist');
  for (const [key, value] of Object.entries({ CFBundleDisplayName: 'DecisionDrift', CFBundleExecutable: 'DecisionDrift', CFBundleIconFile: 'DecisionDrift.icns', CFBundleIdentifier: 'com.companybuddy.desktop', CFBundleName: 'DecisionDrift', CFBundleShortVersionString: metadata.version, CFBundleVersion: metadata.version })) {
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${value}`, plist]);
  }
  execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Delete :ElectronAsarIntegrity', plist]);
  execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Add :NSUserNotificationAlertStyle string banner', plist]);
  execFileSync('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', staged], { stdio: 'inherit' });
  execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', staged], { stdio: 'inherit' });
  let hadPrevious = false;
  try { await rename(destination, previous); hadPrevious = true; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  try { await rename(staged, destination); }
  catch (error) { if (hadPrevious) await rename(previous, destination); throw error; }
  if (hadPrevious) await rm(previous, { recursive: true });
  console.log(`Application macOS signée localement : ${destination}`);
} finally {
  await rm(staged, { recursive: true, force: true });
}
