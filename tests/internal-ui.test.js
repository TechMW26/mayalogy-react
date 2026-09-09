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
