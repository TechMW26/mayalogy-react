import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('authenticated shell uses grouped, icon-only navigation', async () => {
    for (const relativePath of ['../src/legacyShell.js', '../public/js/legacyShell.js']) {
        const source = await read(relativePath);
        assert.match(source, /sidebar-nav__label">Today/);
        assert.match(source, /sidebar-nav__label">Charts &amp; insights/);
        assert.match(source, /sidebar-nav__label">Guidance tools/);
        assert.match(source, /sidebar-nav__label">Account/);
        assert.match(source, /id="maya-nav-btn"[\s\S]*?maya-nav-blob/);
        assert.doesNotMatch(source, /id="maya-nav-btn"[\s\S]{0,180}<span>MAYA<\/span>/);
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
    assert.match(styles, /maya-overlay--chat \.maya-blob-container\.blob-top canvas[\s\S]*?transform:\s*none/);
    assert.match(shell, /aria-labelledby="maya-overlay-title"/);
    assert.match(shell, /Talk to MAYA/);
    assert.match(app, /document\.body\.classList\.add\('maya-chat-open'\)/);
    assert.match(app, /document\.body\.classList\.remove\('maya-chat-open'\)/);
});

test('home Explore tools render as a complete 3 by 3 grid', async () => {
    const pages = await read('../public/js/pages.js');
    const homeGrid = pages.split('<div class="maya-action-grid">')[1].split('</div>\n                </div>')[0];
    assert.equal((homeGrid.match(/class="maya-action-tile"/g) || []).length, 9);
    assert.match(homeGrid, /data-page="remedies"/);
    assert.doesNotMatch(homeGrid, /data-action="showMaya"/);

    const styles = await read('../src/internal-app.css');
    assert.match(styles, /#app-container \.maya-action-grid \{\s*grid-template-columns:\s*repeat\(3,/);
    assert.match(styles, /@media \(max-width: 520px\)[\s\S]*?#app-container \.maya-action-grid \{\s*grid-template-columns:\s*repeat\(3,/);
});

test('daily horoscope survives reloads until the local date changes', async () => {
    const source = await read('../public/js/pages.js');
    const values = new Map([
        ['maya_session', { email: 'daily@example.com' }],
        ['maya_profile', { birthDate: '1990-01-15', birthTime: '12:00', birthPlace: 'Delhi' }],
        ['maya_language', 'en']
    ]);
    const storage = {
        get: (key, fallback = null) => values.has(key) ? values.get(key) : fallback,
        set: (key, value) => { values.set(key, value); return true; },
        remove: (key) => { values.delete(key); return true; }
    };
    const context = {
        window: {},
        MayaUtils: { storage },
        MayaAstrology: { getZodiacSystem: () => 'western' },
        document: { getElementById: () => null },
        console: { log() {}, warn() {}, error() {} },
        Date,
        setTimeout,
        clearTimeout,
        encodeURIComponent
    };
    vm.runInNewContext(source, context);
    const pages = context.window.MayaPages;
    assert.equal(pages._isUsableHoroscope({ text: 'I apologize, but I am having trouble connecting right now.', source: 'ai' }), false);
    const firstDate = '2026-09-09';
    const nextDate = '2026-09-10';
    let generated = 0;
    pages._getLocalDate = () => firstDate;
    pages._generateHoroscope = async (date) => {
        generated += 1;
        return { date, text: `Reading ${date}: Focus on one thoughtful priority, communicate clearly, and protect time for rest and reflection.`, source: 'ai', isAI: true };
    };

    const [first, duplicate] = await Promise.all([pages.getDailyHoroscope(), pages.getDailyHoroscope()]);
    assert.equal(generated, 1);
    assert.equal(first.text, duplicate.text);

    pages._horoscopeCache = { pending: null, pendingDate: null, data: null, date: null };
    const afterReload = await pages.getDailyHoroscope();
    assert.match(afterReload.text, new RegExp(`^Reading ${firstDate}:`));
    assert.equal(generated, 1);

    values.set('maya_session', { email: 'second@example.com' });
    pages._horoscopeCache = { pending: null, pendingDate: null, pendingIdentity: null, data: null, date: null, identity: null };
    const secondAccount = await pages.getDailyHoroscope();
    assert.match(secondAccount.text, new RegExp(`^Reading ${firstDate}:`));
    assert.equal(generated, 2);

    pages._getLocalDate = () => nextDate;
    pages._horoscopeCache = { pending: null, pendingDate: null, pendingIdentity: null, data: null, date: null, identity: null };
    const afterMidnight = await pages.getDailyHoroscope();
    assert.match(afterMidnight.text, new RegExp(`^Reading ${nextDate}:`));
    assert.equal(generated, 3);
});

test('authenticated detail modals match dark mode and remain scrollable', async () => {
    const styles = await read('../src/internal-app.css');
    const pages = await read('../public/js/pages.js');
    assert.match(styles, /data-bs-theme="dark"[\s\S]*?maya-lucky-modal__content[\s\S]*?background:\s*#201f1d/);
    assert.match(styles, /maya-lucky-modal__content[\s\S]*?max-height:\s*calc\(100dvh[\s\S]*?overflow-y:\s*auto/);
    assert.match(pages, /document\.body\.classList\.add\('maya-modal-open'\)/);
    assert.match(pages, /returnFocusTo\?\.focus\?\.\(\)/);
});

test('compass artwork is preloaded, persisted locally, and has a static fallback', async () => {
    const [index, app, preloader, pages, styles] = await Promise.all([
        read('../index.html'),
        read('../src/App.jsx'),
        read('../src/assetPreloader.js'),
        read('../public/js/pages.js'),
        read('../public/css/maya.css')
    ]);

    assert.match(index, /rel="preload" as="image" href="\/compass-black-background_1063-119\.avif"/);
    assert.match(index, /rel="preload" as="image" href="\/19-194340_compass-needle-png-circle\.png"/);
    const startupCleanup = index.split('const localCacheKeyPatterns = [')[1].split('];')[0];
    assert.doesNotMatch(startupCleanup, /daily_horoscope|network-only-build/);
    assert.match(app, /Promise\.all\(\[initializeFirebaseClient\(\), preloadCompassAssets\(\)\]\)/);
    assert.match(preloader, /maya_compass_assets_v1/);
    assert.match(preloader, /localStorage\.setItem\(COMPASS_CACHE_KEY/);
    assert.match(preloader, /MAX_COMPASS_ASSET_BYTES/);
    assert.match(pages, /window\.MayaAssets\?\.compassNeedle \|\| '\/19-194340_compass-needle-png-circle\.png'/);
    assert.match(styles, /--maya-compass-dial-image, url\('\.\.\/compass-black-background_1063-119\.avif'\)/);
});

test('Poppins is the single application text family while icon fonts stay intact', async () => {
    const [index, theme, internal, legal] = await Promise.all([
        read('../index.html'),
        read('../src/temple-theme.css'),
        read('../src/internal-app.css'),
        read('../public/_legal-shared.css')
    ]);

    assert.match(index, /family=Poppins/);
    assert.doesNotMatch(index, /family=(?:Raleway|Montserrat|Cormorant)/);
    assert.match(theme, /--font-primary:\s*'Poppins'/);
    assert.match(theme, /--font-display:\s*'Poppins'/);
    assert.match(internal, /body \*:not\(\.bi\)[\s\S]*?font-family:\s*'Poppins', sans-serif !important/);
    assert.doesNotMatch(internal, /font-family:\s*Inter/);
    assert.doesNotMatch(legal, /Montserrat/);
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
