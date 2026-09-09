import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('authenticated shell uses grouped, icon-only navigation', async () => {
    for (const relativePath of ['../src/legacyShell.js', '../public/js/legacyShell.js']) {
        const source = await read(relativePath);
        assert.match(source, /sidebar-nav__label">Today/);
        assert.match(source, /sidebar-nav__label">Charts &amp; insights/);
        assert.match(source, /sidebar-nav__label">Guidance tools/);
        assert.match(source, /sidebar-nav__label">Account/);
        assert.match(source, /maya-nav-icon"><i class="bi bi-chat-square-text/);
        assert.doesNotMatch(source, /maya-blob-mini/);
    }
});

test('minimal theme is isolated from pre-login and signup UI', async () => {
    const source = await read('../src/internal-app.css');
    assert.match(source, /#app-container/);
    assert.doesNotMatch(source, /\.onboarding-main|\.onboarding-content|\.direct-login-container|\.auth-flow-container|\.email-gate-container/);
});

test('authenticated app and Talk to MAYA expose dedicated touch scroll regions', async () => {
    const styles = await readFile(new URL('../src/internal-app.css', import.meta.url), 'utf8');
    const shell = await readFile(new URL('../src/legacyShell.js', import.meta.url), 'utf8');
    const app = await readFile(new URL('../public/js/app.js', import.meta.url), 'utf8');

    assert.match(styles, /main-content:not\(\.main-content--fullscreen\)[\s\S]*?overflow-y:\s*auto/);
    assert.match(styles, /maya-overlay--chat \.maya-chat-messages[\s\S]*?touch-action:\s*pan-y/);
    assert.match(styles, /maya-overlay--chat \.maya-blob-container\.blob-top canvas[\s\S]*?scale\(0\.18\)/);
    assert.match(shell, /aria-labelledby="maya-overlay-title"/);
    assert.match(shell, /Talk to MAYA/);
    assert.match(app, /document\.body\.classList\.add\('maya-chat-open'\)/);
    assert.match(app, /document\.body\.classList\.remove\('maya-chat-open'\)/);
});

test('pre-login modal and funnel own the temple background layer', async () => {
  const theme = await readFile(new URL('../src/temple-theme.css', import.meta.url), 'utf8');
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(theme, /#onboardingModal,\s*\n\.maya-overlay\.funnel-mode/);
  assert.match(theme, /url\('\/background\.jpeg'\)/);
  assert.match(index, /rel="preload" as="image" href="\/background\.jpeg"/);
});

test('internal page renderers use Bootstrap icons instead of emoji glyphs', async () => {
    for (const relativePath of ['../js/pages.js', '../public/js/pages.js']) {
        const source = await read(relativePath);
        const userFacingSource = source
            .split(/\r?\n/)
            .filter((line) => !line.includes('console.'))
            .join('\n');
        assert.doesNotMatch(userFacingSource, /\p{Extended_Pictographic}/u);
        assert.match(source, /bi bi-chat-square-text|bi bi-chat-heart/);
        assert.match(source, /current-page-title/);
        assert.match(source, /\.bottom-nav \[data-page="profile"\]/);
        assert.doesNotMatch(source, /\[data-page="settings"\], \[data-page="profile"\]/);
    }
});
