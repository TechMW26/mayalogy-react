/* Mayalogy Lead Desk: admin panel for leads. Plain JS, no libraries.
   Data comes from /api/admin-leads (needs the admin token from /api/admin-login). */
(() => {
    'use strict';

    const API_LOGIN = '/api/admin-login';
    const API_LEADS = '/api/admin-leads';
    const TOKEN_KEY = 'maya_admin_token';
    const SOUND_KEY = 'maya_admin_sound';
    const REFRESH_MS = 60000;

    const STATUS = {
        new: 'New',
        contacted: 'Contacted',
        interested: 'Interested',
        converted: 'Converted',
        not_interested: 'Not interested'
    };
    const SOURCE = { guest: 'Guest (no login)', phone: 'Phone login', email: 'Email login', google: 'Google login', phone_capture: 'Phone only' };
    const STAGES = ['Visited', 'Gave name', 'Birth details', 'Saw numbers', 'In reading', 'Answered questions', 'Signed up'];
    const NUM_LABEL = { lifePath: 'Life Path', destiny: 'Destiny', soulUrge: 'Soul Urge', personality: 'Personality', birthday: 'Birthday', maturity: 'Maturity', personalYear: 'Year' };

    // Vedic (sidereal) Sun sign by date: Sun enters each sign around the 14th-17th.
    const SIGNS = [
        { name: 'Aries', hi: 'Mesh', sym: '\u2648\uFE0E', from: [4, 14], el: 'fire' },
        { name: 'Taurus', hi: 'Vrishabh', sym: '\u2649\uFE0E', from: [5, 15], el: 'earth' },
        { name: 'Gemini', hi: 'Mithun', sym: '\u264A\uFE0E', from: [6, 15], el: 'air' },
        { name: 'Cancer', hi: 'Kark', sym: '\u264B\uFE0E', from: [7, 16], el: 'water' },
        { name: 'Leo', hi: 'Simha', sym: '\u264C\uFE0E', from: [8, 17], el: 'fire' },
        { name: 'Virgo', hi: 'Kanya', sym: '\u264D\uFE0E', from: [9, 17], el: 'earth' },
        { name: 'Libra', hi: 'Tula', sym: '\u264E\uFE0E', from: [10, 17], el: 'air' },
        { name: 'Scorpio', hi: 'Vrishchik', sym: '\u264F\uFE0E', from: [11, 16], el: 'water' },
        { name: 'Sagittarius', hi: 'Dhanu', sym: '\u2650\uFE0E', from: [12, 16], el: 'fire' },
        { name: 'Capricorn', hi: 'Makar', sym: '\u2651\uFE0E', from: [1, 14], el: 'earth' },
        { name: 'Aquarius', hi: 'Kumbh', sym: '\u2652\uFE0E', from: [2, 13], el: 'air' },
        { name: 'Pisces', hi: 'Meen', sym: '\u2653\uFE0E', from: [3, 14], el: 'water' }
    ];
    const EL_COLOR = { fire: ['#ff8a5c', '#ffb347'], earth: ['#7fd18b', '#c6d36b'], air: ['#7cc4ff', '#b7a4ff'], water: ['#4fd1c5', '#9a7bff'] };

    const ICON = {
        users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
        sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
        week: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
        star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>',
        check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="M22 4L12 14l-3-3"/></svg>',
        phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
        refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.8-3.4L23 10M1 14l4.7 4.4A9 9 0 0 0 20.5 15"/></svg>',
        logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
        search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
        download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
        close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
        eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',
        bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
        bellOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.7 21a2 2 0 0 1-3.4 0M18.6 13A17.9 17.9 0 0 1 18 8M6.3 6.3A5.9 5.9 0 0 0 6 8c0 7-3 9-3 9h14M18 8a6 6 0 0 0-9.3-5M1 1l22 22"/></svg>',
        whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>',
        mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/></svg>',
        copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
    };

    const state = {
        leads: [],
        generatedAt: 0,
        known: null,
        fresh: new Set(),
        filter: { q: '', range: 'all', source: 'all', stage: 'all', status: 'all', lang: 'all' },
        sort: { key: 'lastActive', dir: -1 },
        page: 1,
        perPage: 25,
        chartDays: 30,
        openId: null,
        loading: false,
        timer: null,
        ticker: null,
        sound: (() => { try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch (_e) { return true; } })()
    };

    // ---------- helpers ----------
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmtN = (n) => Number(n || 0).toLocaleString('en-IN');
    const DAY = 86400000;
    const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
    const today0 = () => startOfDay(Date.now());
    const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

    function parseBirth(value) {
        const s = String(value || '').trim();
        let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (m) return { y: +m[1], m: +m[2], d: +m[3] };
        m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
        if (m) return { y: +m[3], m: +m[2], d: +m[1] };
        return null;
    }
    function signOf(lead) {
        if (lead._sign !== undefined) return lead._sign;
        const b = parseBirth(lead.birthDate);
        let sign = null;
        if (b && b.m >= 1 && b.m <= 12) {
            const md = b.m * 100 + b.d;
            // Walk backwards through the year to find the last sign that started on/before this date.
            const starts = SIGNS.map((s, i) => ({ i, md: s.from[0] * 100 + s.from[1] })).sort((a, c) => a.md - c.md);
            let hit = starts[starts.length - 1];
            starts.forEach((s) => { if (md >= s.md) hit = s; });
            sign = SIGNS[hit.i];
        }
        lead._sign = sign;
        return sign;
    }
    function ageOf(lead) {
        const b = parseBirth(lead.birthDate);
        if (!b) return null;
        const now = new Date();
        let a = now.getFullYear() - b.y;
        if (now.getMonth() + 1 < b.m || (now.getMonth() + 1 === b.m && now.getDate() < b.d)) a -= 1;
        return a >= 0 && a < 120 ? a : null;
    }
    const cityOf = (lead) => String(lead.birthPlace || '').split(',')[0].trim();
    const langOf = (lead) => (/^hi/.test(lead.language || '') ? 'hi' : (/^en/.test(lead.language || '') ? 'en' : 'other'));
    const hasPhone = (lead) => String(lead.phone || '').replace(/\D/g, '').length >= 8;

    function heatOf(lead) {
        if (lead._heat !== undefined) return lead._heat;
        let s = (lead.stage || 0) * 11;
        if (hasPhone(lead)) s += 14;
        if (lead.email) s += 4;
        if (lead.birthTime && lead.birthPlace) s += 6;
        const idle = Date.now() - (lead.lastActive || lead.createdAt || 0);
        if (idle < 3600000) s += 14; else if (idle < DAY) s += 9; else if (idle < 7 * DAY) s += 4;
        if (lead.status === 'not_interested') s = Math.min(s, 20);
        lead._heat = Math.max(0, Math.min(100, s));
        return lead._heat;
    }
    const heatClass = (h) => (h >= 70 ? 'hot' : h >= 45 ? 'warm' : 'cold');
    const heatLabel = (h) => (h >= 70 ? 'High' : h >= 45 ? 'Medium' : 'Low');

    function initials(lead) {
        const n = String(lead.name || '').trim();
        if (!n) return hasPhone(lead) ? '#' : '?';
        const parts = n.split(/\s+/).filter(Boolean);
        return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
    }
    function avatar(lead) {
        return `<div class="ad-avatar">${esc(initials(lead))}</div>`;
    }

    function timeAgo(t) {
        if (!t) return '-';
        const s = Math.max(0, Math.round((Date.now() - t) / 1000));
        if (s < 45) return 'just now';
        const m = Math.round(s / 60);
        if (m < 60) return `${m} min ago`;
        const h = Math.round(m / 60);
        if (h < 24) return `${h} hr ago`;
        const d = Math.round(h / 24);
        if (d < 31) return `${d} day${d > 1 ? 's' : ''} ago`;
        return fmtDate(t);
    }
    const fmtDate = (t) => (t ? new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-');
    const fmtDateTime = (t) => (t ? new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-');
    function fmtBirth(lead) {
        const b = parseBirth(lead.birthDate);
        if (!b) return lead.birthDate || '';
        const d = new Date(b.y, b.m - 1, b.d);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    function fmtTime(v) {
        const m = String(v || '').match(/^(\d{1,2}):(\d{2})/);
        if (!m) return v || '';
        const h = +m[1];
        return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
    }
    function waLink(phone) {
        let d = String(phone || '').replace(/\D/g, '');
        if (d.length === 10) d = `91${d}`;
        return d.length >= 11 ? `https://wa.me/${d}` : '';
    }
    const telLink = (phone) => `tel:${String(phone || '').replace(/[^\d+]/g, '')}`;

    // ---------- auth ----------
    function getToken() {
        for (const store of [sessionStorage, localStorage]) {
            try {
                const raw = store.getItem(TOKEN_KEY);
                if (!raw) continue;
                const t = JSON.parse(raw);
                if (t?.token && t.expiresAt > Date.now() + 30000) return t.token;
                store.removeItem(TOKEN_KEY);
            } catch (_e) { /* ignore */ }
        }
        return null;
    }
    function saveToken(data, remember) {
        try { (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, JSON.stringify({ token: data.token, expiresAt: data.expiresAt })); } catch (_e) { /* ignore */ }
    }
    function clearToken() {
        try { sessionStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY); } catch (_e) { /* ignore */ }
    }

    async function api(url, options = {}) {
        const token = getToken();
        if (!token) { logout('Please sign in.'); throw new Error('signed out'); }
        const res = await fetch(url, {
            ...options,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) }
        });
        let body = null;
        try { body = await res.json(); } catch (_e) { body = null; }
        if (res.status === 401) { logout('Session ended. Please sign in again.'); throw new Error('unauthorized'); }
        if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
        return body;
    }

    function logout(message) {
        clearToken();
        clearInterval(state.timer);
        clearInterval(state.ticker);
        state.leads = [];
        state.known = null;
        renderLogin(message);
    }

    // ---------- toasts + sound ----------
    function toast(html, ms = 4200) {
        const box = $('#toasts');
        if (!box) return;
        const el = document.createElement('div');
        el.className = 'ad-toast';
        el.innerHTML = html;
        box.appendChild(el);
        setTimeout(() => { el.classList.add('is-out'); setTimeout(() => el.remove(), 320); }, ms);
    }
    let audioCtx = null;
    function chime() {
        if (!state.sound) return;
        try {
            audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
            const now = audioCtx.currentTime;
            [880, 1318.5].forEach((f, i) => {
                const o = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                o.type = 'sine';
                o.frequency.value = f;
                g.gain.setValueAtTime(0.0001, now + i * 0.12);
                g.gain.exponentialRampToValueAtTime(0.12, now + i * 0.12 + 0.02);
                g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.6);
                o.connect(g).connect(audioCtx.destination);
                o.start(now + i * 0.12);
                o.stop(now + i * 0.12 + 0.65);
            });
        } catch (_e) { /* no sound */ }
    }

    // ---------- login ----------
    function renderLogin(message = '') {
        document.body.classList.remove('is-dash');
        $('#app').innerHTML = `
            <div class="ad-login">
                <form class="ad-login__card" id="loginForm" autocomplete="on">
                    <img class="ad-login__logo" src="/images/maya-logo.png" alt="" onerror="this.remove()">
                    <h1>Mayalogy Leads</h1>
                    <p>Sign in with the team password.</p>
                    <label class="ad-label" for="pw">Password</label>
                    <div class="ad-field">
                        <input id="pw" type="password" autocomplete="current-password" required>
                        <button type="button" class="ad-eye" id="eye" aria-label="Show password">${ICON.eye}</button>
                    </div>
                    <label class="ad-check"><input type="checkbox" id="remember"> Keep me signed in on this device for 12 hours</label>
                    <div class="ad-error" id="loginError">${esc(message)}</div>
                    <button class="ad-btn ad-btn--primary ad-btn--wide" id="loginBtn" type="submit">Sign in</button>
                </form>
            </div>`;
        const pw = $('#pw');
        setTimeout(() => pw.focus(), 50);
        $('#eye').onclick = () => { pw.type = pw.type === 'password' ? 'text' : 'password'; pw.focus(); };
        $('#loginForm').onsubmit = async (e) => {
            e.preventDefault();
            const btn = $('#loginBtn');
            const err = $('#loginError');
            btn.disabled = true;
            btn.textContent = 'Signing in...';
            err.textContent = '';
            try {
                const res = await fetch(API_LOGIN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw.value }) });
                let body = null;
                try { body = await res.json(); } catch (_e) { body = null; }
                if (!res.ok || !body?.token) {
                    if (body?.code === 'not_configured') throw new Error('Admin password is not set on the server yet (ADMIN_PANEL_PASSWORD).');
                    throw new Error(body?.error || 'Could not sign in');
                }
                saveToken(body, $('#remember').checked);
                startDashboard();
            } catch (error) {
                err.textContent = error.message || 'Could not sign in';
                btn.disabled = false;
                btn.textContent = 'Sign in';
                pw.select();
            }
        };
    }

    // ---------- dashboard shell ----------
    function startDashboard() {
        document.body.classList.add('is-dash');
        $('#app').innerHTML = `
            <header class="ad-top">
                <img class="ad-top__logo" src="/images/maya-logo.png" alt="" onerror="this.style.display='none'">
                <div class="ad-top__title">Mayalogy <span>Leads</span></div>
                <div class="ad-top__spacer"></div>
                <span class="ad-live" id="live"><i></i><span id="liveText">Loading...</span></span>
                <button class="ad-btn ad-btn--icon" id="soundBtn" title="Sound for new leads">${state.sound ? ICON.bell : ICON.bellOff}</button>
                <button class="ad-btn ad-btn--icon" id="refreshBtn" title="Refresh (R)">${ICON.refresh}</button>
                <button class="ad-btn" id="logoutBtn" title="Sign out">${ICON.logout}<span>Sign out</span></button>
            </header>
            <main class="ad-main">
                <section class="ad-head" id="hero"></section>
                <section class="ad-kpis" id="kpis">${'<div class="ad-skel"></div>'.repeat(4)}</section>
                <section class="ad-grid ad-grid--2-1">
                    <div class="ad-card" id="trendCard"><div class="ad-skel"></div></div>
                    <div class="ad-card" id="funnelCard"><div class="ad-skel"></div></div>
                </section>
                <section class="ad-card" id="breakdownCard" style="margin-bottom:16px"><div class="ad-skel"></div></section>
                <section class="ad-card ad-card--flush" id="leadsCard"><div class="ad-skel" style="height:320px"></div></section>
            </main>
            <div class="ad-scrim" id="scrim"></div>
            <aside class="ad-drawer" id="drawer" aria-hidden="true"></aside>`;

        $('#refreshBtn').onclick = () => load(true);
        $('#logoutBtn').onclick = () => logout('Signed out.');
        $('#soundBtn').onclick = () => {
            state.sound = !state.sound;
            try { localStorage.setItem(SOUND_KEY, state.sound ? 'on' : 'off'); } catch (_e) { /* ignore */ }
            $('#soundBtn').innerHTML = state.sound ? ICON.bell : ICON.bellOff;
            if (state.sound) chime();
            toast(state.sound ? 'Sound on for new leads' : 'Sound off', 1800);
        };
        $('#scrim').onclick = closeDrawer;

        clearInterval(state.timer);
        clearInterval(state.ticker);
        state.timer = setInterval(() => { if (document.visibilityState === 'visible') load(false); }, REFRESH_MS);
        state.ticker = setInterval(updateLive, 5000);
        load(true);
    }

    function updateLive() {
        const el = $('#liveText');
        if (!el) return;
        $('#live')?.classList.toggle('is-off', !state.generatedAt);
        el.textContent = state.generatedAt ? `Updated ${timeAgo(state.generatedAt)}` : 'Loading...';
    }

    async function load(fresh) {
        if (state.loading) return;
        state.loading = true;
        const btn = $('#refreshBtn');
        btn?.classList.add('ad-spin');
        try {
            const data = await api(`${API_LEADS}${fresh ? '?fresh=1' : ''}`);
            const leads = Array.isArray(data?.leads) ? data.leads : [];
            const ids = new Set(leads.map((l) => l.id));
            if (state.known) {
                const added = leads.filter((l) => !state.known.has(l.id));
                added.forEach((l) => state.fresh.add(l.id));
                if (added.length) {
                    chime();
                    const l = added[0];
                    const who = l.name || l.phone || 'Someone';
                    const where = cityOf(l);
                    toast(added.length === 1
                        ? `New lead: <b>${esc(who)}</b>${where ? ` from ${esc(where)}` : ''}`
                        : `<b>${added.length} new leads</b> just came in`);
                }
            }
            state.known = ids;
            state.leads = leads;
            state.generatedAt = data.generatedAt || Date.now();
            renderAll();
            
        } catch (error) {
            if (getToken()) toast(esc(error.message || 'Could not load leads'));
        } finally {
            state.loading = false;
            $('#refreshBtn')?.classList.remove('ad-spin');
            updateLive();
        }
    }

    function renderAll() {
        if (!$('#kpis')) return;
        renderHero();
        renderKpis();
        renderTrend();
        renderFunnel();
        renderBreakdown();
        renderLeads();
        if (state.openId) {
            const lead = state.leads.find((l) => l.id === state.openId);
            if (lead) fillDrawer(lead, true);
        }
    }

    // ---------- hero + KPIs ----------
    function countIn(from, to, key = 'createdAt', list = state.leads) {
        return list.filter((l) => (l[key] || 0) >= from && (l[key] || 0) < to).length;
    }

    function renderHero() {
        const t0 = today0();
        const todayCount = countIn(t0, t0 + DAY);
        const pending = state.leads.filter((l) => l.status === 'new' && (hasPhone(l) || l.email)).length;
        const dateText = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        $('#hero').innerHTML = `
            <div>
                <h1>Overview</h1>
                <p>${esc(dateText)} &middot; ${fmtN(todayCount)} new today &middot; ${fmtN(pending)} waiting for follow-up</p>
            </div>`;
    }

    function delta(now, before, label) {
        if (!before && !now) return `<span class="ad-muted">No change ${label}</span>`;
        if (!before) return `<span class="ad-up">New</span> <span class="ad-muted">${label}</span>`;
        const d = Math.round(((now - before) / before) * 100);
        const cls = d >= 0 ? 'ad-up' : 'ad-down';
        return `<span class="${cls}">${d >= 0 ? '+' : '-'}${Math.abs(d)}%</span> <span class="ad-muted">${label}</span>`;
    }

    function renderKpis() {
        const L = state.leads;
        const t0 = today0();
        const todayN = countIn(t0, t0 + DAY);
        const yestN = countIn(t0 - DAY, t0);
        const wk = countIn(t0 - 6 * DAY, t0 + DAY);
        const prevWk = countIn(t0 - 13 * DAY, t0 - 6 * DAY);
        const full = L.filter((l) => l.birthDate && l.birthTime && l.birthPlace).length;
        const signed = L.filter((l) => l.stage >= 6).length;
        const cards = [
            { label: 'Total leads', value: L.length, sub: `<span class="ad-muted">${pct(full, L.length)}% gave full birth details</span>` },
            { label: 'New today', value: todayN, sub: delta(todayN, yestN, 'vs yesterday') },
            { label: 'Last 7 days', value: wk, sub: delta(wk, prevWk, 'vs previous 7 days') },
            { label: 'Signed up', value: signed, sub: `<span class="ad-muted">${pct(signed, L.length)}% of all leads</span>` }
        ];
        $('#kpis').innerHTML = cards.map((c) => `
            <div class="ad-kpi">
                <div class="ad-kpi__label">${c.label}</div>
                <div class="ad-kpi__value" data-count="${c.value}">0</div>
                <div class="ad-kpi__sub">${c.sub}</div>
            </div>`).join('');
        $$('#kpis [data-count]').forEach((el) => countUp(el, Number(el.dataset.count)));
    }

    function countUp(el, target) {
        const prev = Number(el.dataset.shown || 0);
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || prev === target) { el.textContent = fmtN(target); el.dataset.shown = target; return; }
        const start = performance.now();
        const dur = 900;
        const step = (now) => {
            const k = Math.min(1, (now - start) / dur);
            const e = 1 - Math.pow(1 - k, 3);
            el.textContent = fmtN(Math.round(prev + (target - prev) * e));
            if (k < 1) requestAnimationFrame(step); else el.dataset.shown = target;
        };
        requestAnimationFrame(step);
    }

    // ---------- trend chart ----------
    function renderTrend() {
        const card = $('#trendCard');
        const days = state.chartDays;
        const t0 = today0();
        const buckets = Array.from({ length: days }, (_, i) => {
            const from = t0 - (days - 1 - i) * DAY;
            return {
                t: from,
                leads: countIn(from, from + DAY),
                signed: state.leads.filter((l) => l.stage >= 6 && (l.account?.since || l.createdAt) >= from && (l.account?.since || l.createdAt) < from + DAY).length
            };
        });
        const total = buckets.reduce((s, b) => s + b.leads, 0);
        card.innerHTML = `
            <div class="ad-card__head">
                <div><h3>New leads</h3><div class="ad-sub">${fmtN(total)} in the last ${days} days</div></div>
                <div class="ad-seg" id="trendSeg">${[7, 30, 90].map((d) => `<button data-d="${d}" class="${d === days ? 'is-on' : ''}">${d}D</button>`).join('')}</div>
            </div>
            <div class="ad-chart" id="trendChart"></div>
            <div class="ad-legend ad-legend--inline">
                <div><i style="background:var(--accent)"></i><span>New leads</span></div>
                <div><i style="background:var(--ink-3)"></i><span>Signed up</span></div>
            </div>`;
        $$('#trendSeg button').forEach((b) => { b.onclick = () => { state.chartDays = Number(b.dataset.d); renderTrend(); }; });
        drawTrend($('#trendChart'), buckets);
    }

    function drawTrend(box, buckets) {
        const W = Math.max(280, box.clientWidth || 600);
        const H = 230;
        const pad = { l: 32, r: 10, t: 14, b: 26 };
        const iw = W - pad.l - pad.r;
        const ih = H - pad.t - pad.b;
        const max = Math.max(4, ...buckets.map((b) => b.leads));
        const nice = Math.ceil(max / 4) * 4;
        const x = (i) => pad.l + (buckets.length === 1 ? iw / 2 : (i / (buckets.length - 1)) * iw);
        const y = (v) => pad.t + ih - (v / nice) * ih;
        const smooth = (key) => buckets.map((b, i) => {
            const px = x(i);
            const py = y(b[key]);
            if (i === 0) return `M${px.toFixed(1)},${py.toFixed(1)}`;
            const cx = (x(i - 1) + px) / 2;
            return `C${cx.toFixed(1)},${y(buckets[i - 1][key]).toFixed(1)} ${cx.toFixed(1)},${py.toFixed(1)} ${px.toFixed(1)},${py.toFixed(1)}`;
        }).join(' ');
        const line = smooth('leads');
        const area = `${line} L${x(buckets.length - 1).toFixed(1)},${(pad.t + ih).toFixed(1)} L${x(0).toFixed(1)},${(pad.t + ih).toFixed(1)} Z`;
        const grid = [0, 1, 2, 3, 4].map((k) => {
            const v = (nice / 4) * k;
            return `<line class="ad-gridline" x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}"/><text class="ad-axis" x="${pad.l - 8}" y="${y(v) + 3}" text-anchor="end">${v}</text>`;
        }).join('');
        const every = Math.ceil(buckets.length / 7);
        const labels = buckets.map((b, i) => ((i % every === 0 || i === buckets.length - 1) && !(i !== buckets.length - 1 && buckets.length - 1 - i < every / 2)
            ? `<text class="ad-axis" x="${x(i)}" y="${H - 6}" text-anchor="middle">${new Date(b.t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</text>` : '')).join('');
        box.innerHTML = `
            <svg viewBox="0 0 ${W} ${H}" height="${H}">
                <defs>
                    <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#d9a34b" stop-opacity="0.18"/><stop offset="1" stop-color="#d9a34b" stop-opacity="0"/></linearGradient>
                </defs>
                ${grid}${labels}
                <path d="${area}" fill="url(#trendFill)" class="ad-fade"/>
                <path d="${smooth('signed')}" fill="none" stroke="#6b6b76" stroke-width="1.5" stroke-dasharray="4 4"/>
                <path d="${line}" fill="none" stroke="#d9a34b" stroke-width="2"/>
                <circle id="trendDot" r="4" fill="#d9a34b" stroke="#0e0e12" stroke-width="2" style="display:none"/>
                <line id="trendGuide" y1="${pad.t}" y2="${pad.t + ih}" stroke="#3a3a44" style="display:none"/>
                <rect x="${pad.l}" y="${pad.t}" width="${iw}" height="${ih}" fill="transparent" id="trendHit"/>
            </svg>
            <div class="ad-tip" id="trendTip"></div>`;
        const hit = $('#trendHit', box);
        const tip = $('#trendTip', box);
        const guide = $('#trendGuide', box);
        const svg = $('svg', box);
        const dot = $('#trendDot', box);
        const move = (ev) => {
            const r = svg.getBoundingClientRect();
            const px = ((ev.touches?.[0]?.clientX ?? ev.clientX) - r.left) * (W / r.width);
            const i = Math.max(0, Math.min(buckets.length - 1, Math.round(((px - pad.l) / iw) * (buckets.length - 1))));
            const b = buckets[i];
            guide.setAttribute('x1', x(i));
            guide.setAttribute('x2', x(i));
            guide.style.display = '';
            dot.setAttribute('cx', x(i));
            dot.setAttribute('cy', y(b.leads));
            dot.style.display = '';
            tip.innerHTML = `<div class="ad-muted">${new Date(b.t).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</div><b>${b.leads}</b> new &middot; ${b.signed} signed up`;
            tip.style.left = `${(x(i) / W) * r.width}px`;
            tip.style.top = `${(y(b.leads) / H) * r.height}px`;
            tip.style.opacity = 1;
        };
        const leave = () => { tip.style.opacity = 0; guide.style.display = 'none'; dot.style.display = 'none'; };
        hit.addEventListener('mousemove', move);
        hit.addEventListener('touchstart', move, { passive: true });
        hit.addEventListener('touchmove', move, { passive: true });
        hit.addEventListener('mouseleave', leave);
        hit.addEventListener('touchend', () => setTimeout(leave, 1500));
    }

    // ---------- funnel ----------
    function renderFunnel() {
        const L = state.leads;
        const total = L.length || 1;
        const rows = STAGES.slice(1).map((name, i) => ({ name, n: L.filter((l) => l.stage >= i + 1).length }));
        const max = Math.max(1, rows[0].n);
        $('#funnelCard').innerHTML = `
            <div class="ad-card__head"><div><h3>Journey</h3><div class="ad-sub">How far leads get in the app</div></div></div>
            <div class="ad-funnel">${rows.map((r) => `
                <div class="ad-funnel__row">
                    <span class="ad-funnel__name">${r.name}</span>
                    <div class="ad-funnel__bar"><span data-w="${(r.n / max) * 100}"></span></div>
                    <span class="ad-funnel__num">${fmtN(r.n)} <small>${pct(r.n, total)}%</small></span>
                </div>`).join('')}
            </div>
            <p class="ad-note">Biggest drop: ${biggestDrop(rows)}</p>`;
        requestAnimationFrame(() => $$('#funnelCard [data-w]').forEach((el) => { el.style.width = `${Math.max(1, el.dataset.w)}%`; }));
    }
    function biggestDrop(rows) {
        let best = null;
        for (let i = 1; i < rows.length; i++) {
            const lost = rows[i - 1].n - rows[i].n;
            if (rows[i - 1].n && (!best || lost > best.lost)) best = { lost, from: rows[i - 1].name, to: rows[i].name, p: pct(lost, rows[i - 1].n) };
        }
        return best && best.lost > 0 ? `<b>${esc(best.from)}</b> to <b>${esc(best.to)}</b> (${best.p}% leave)` : 'none yet';
    }

    // ---------- breakdown ----------
    function breakdownRows(kind) {
        const L = state.leads;
        const tally = (fn) => {
            const m = new Map();
            L.forEach((l) => { const k = fn(l); if (k) m.set(k, (m.get(k) || 0) + 1); });
            return [...m.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
        };
        if (kind === 'source') return { rows: tally((l) => SOURCE[l.source] || l.source), note: 'Where each lead was saved from' };
        if (kind === 'lang') return { rows: tally((l) => ({ hi: 'Hindi', en: 'English', other: 'Not chosen' })[langOf(l)]), note: 'Language picked in the app' };
        if (kind === 'gender') return { rows: tally((l) => (/^f/.test(l.gender) ? 'Female' : /^m/.test(l.gender) ? 'Male' : 'Not given')), note: 'As entered by the lead' };
        if (kind === 'city') {
            const all = tally((l) => cityOf(l));
            const given = all.reduce((a, r) => a + r.n, 0);
            return { rows: all.slice(0, 10), note: `${fmtN(given)} leads gave a birth place${all.length > 10 ? ` \u00B7 ${all.length - 10} more cities` : ''}` };
        }
        if (kind === 'rashi') {
            const rows = SIGNS.map((s) => ({ label: `${s.name} (${s.hi})`, n: L.filter((l) => signOf(l) === s).length })).filter((r) => r.n).sort((a, b) => b.n - a.n);
            return { rows, note: 'Vedic Sun sign from the birth date' };
        }
        if (kind === 'age') {
            const rows = [['Under 18', 0, 17], ['18-24', 18, 24], ['25-34', 25, 34], ['35-44', 35, 44], ['45-59', 45, 59], ['60+', 60, 200]]
                .map(([label, a, b]) => ({ label, n: L.filter((l) => { const g = ageOf(l); return g !== null && g >= a && g <= b; }).length }));
            return { rows, note: 'From the birth date', keepOrder: true };
        }
        if (kind === 'time') {
            const slots = [['Morning (6am-12pm)', 6, 11], ['Afternoon (12-5pm)', 12, 16], ['Evening (5-9pm)', 17, 20], ['Night (9pm-6am)', 21, 29]];
            const rows = slots.map(([label, a, b]) => ({
                label,
                n: L.filter((l) => { if (!l.createdAt) return false; let h = new Date(l.createdAt).getHours(); if (h < 6) h += 24; return h >= a && h <= b; }).length
            }));
            return { rows, note: 'When leads first arrived (your local time)', keepOrder: true };
        }
        return { rows: [], note: '' };
    }

    function renderBreakdown() {
        const card = $('#breakdownCard');
        const tabs = [['source', 'Source'], ['lang', 'Language'], ['gender', 'Gender'], ['city', 'Birth city'], ['rashi', 'Rashi'], ['age', 'Age'], ['time', 'Time of day']];
        state.breakdown = state.breakdown || 'source';
        const { rows, note } = breakdownRows(state.breakdown);
        const total = rows.reduce((a, r) => a + r.n, 0) || 1;
        const max = Math.max(1, ...rows.map((r) => r.n));
        card.innerHTML = `
            <div class="ad-card__head">
                <div><h3>Breakdown</h3><div class="ad-sub">${esc(note)}</div></div>
                <div class="ad-tabs" id="bdTabs">${tabs.map(([k, v]) => `<button data-k="${k}" class="${k === state.breakdown ? 'is-on' : ''}">${v}</button>`).join('')}</div>
            </div>
            <div class="ad-bd">${rows.length ? rows.map((r) => `
                <div class="ad-bd__row">
                    <span class="ad-bd__label">${esc(r.label)}</span>
                    <div class="ad-bd__track"><span data-w="${(r.n / max) * 100}"></span></div>
                    <span class="ad-bd__num">${fmtN(r.n)}</span>
                    <span class="ad-bd__pct">${pct(r.n, total)}%</span>
                </div>`).join('') : '<p class="ad-muted">No data yet.</p>'}
            </div>`;
        $$('#bdTabs button').forEach((b) => { b.onclick = () => { state.breakdown = b.dataset.k; renderBreakdown(); }; });
        requestAnimationFrame(() => $$('#breakdownCard [data-w]').forEach((el) => { el.style.width = `${Math.max(1, el.dataset.w)}%`; }));
    }

    // ---------- leads list ----------
    function filtered() {
        const f = state.filter;
        const q = f.q.trim().toLowerCase();
        const t0 = today0();
        const from = { today: t0, '7d': t0 - 6 * DAY, '30d': t0 - 29 * DAY }[f.range] || 0;
        let list = state.leads.filter((l) => {
            if (from && (l.createdAt || 0) < from) return false;
            if (f.source !== 'all' && l.source !== f.source) return false;
            if (f.stage !== 'all' && String(l.stage) !== f.stage) return false;
            if (f.status !== 'all' && l.status !== f.status) return false;
            if (f.lang !== 'all' && langOf(l) !== f.lang) return false;
            if (q) {
                const hay = `${l.name} ${l.phone} ${l.email} ${l.birthPlace} ${signOf(l)?.name || ''} ${signOf(l)?.hi || ''} ${l.note}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
        const { key, dir } = state.sort;
        const val = (l) => (key === 'heat' ? heatOf(l) : key === 'name' ? String(l.name || '~').toLowerCase() : l[key] || 0);
        list = list.sort((a, b) => (val(a) > val(b) ? dir : val(a) < val(b) ? -dir : 0));
        return list;
    }

    function renderLeads() {
        const card = $('#leadsCard');
        if (!$('#leadTools', card)) {
            card.innerHTML = `
                <div class="ad-card__head">
                    <div><h3>Leads</h3><div class="ad-sub" id="leadTotal"></div></div>
                    <button class="ad-btn" id="exportBtn">${ICON.download}<span>Export CSV</span></button>
                </div>
                <div class="ad-tools" id="leadTools">
                    <div class="ad-search">${ICON.search}<input id="q" type="search" placeholder="Search name, phone, email, city"></div>
                    <select class="ad-select" data-f="range"><option value="all">Any time</option><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select>
                    <select class="ad-select" data-f="status"><option value="all">Any status</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
                    <select class="ad-select" data-f="stage"><option value="all">Any stage</option>${STAGES.map((s, i) => `<option value="${i}">${s}</option>`).join('')}</select>
                    <select class="ad-select" data-f="source"><option value="all">Any source</option>${Object.entries(SOURCE).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
                    <select class="ad-select" data-f="lang"><option value="all">Any language</option><option value="hi">Hindi</option><option value="en">English</option><option value="other">Not chosen</option></select>
                </div>
                <div class="ad-count" id="leadCount"></div>
                <div class="ad-table-wrap"><table class="ad-table"><thead><tr>
                    <th data-sort="name">Name</th><th>Birth details</th><th>Place</th><th data-sort="stage">Stage</th><th data-sort="heat">Priority</th><th>Status</th><th>Source</th><th data-sort="lastActive">Last active</th>
                </tr></thead><tbody id="leadRows"></tbody></table></div>
                <div class="ad-cards" id="leadCards"></div>
                <div class="ad-pager" id="pager"></div>`;
            const q = $('#q');
            let qt = null;
            q.value = state.filter.q;
            q.oninput = () => { clearTimeout(qt); qt = setTimeout(() => { state.filter.q = q.value; state.page = 1; renderLeadRows(); }, 150); };
            $$('#leadTools [data-f]').forEach((sel) => {
                sel.value = state.filter[sel.dataset.f];
                sel.onchange = () => { state.filter[sel.dataset.f] = sel.value; state.page = 1; renderLeadRows(); };
            });
            $$('#leadsCard th[data-sort]').forEach((th) => {
                th.onclick = () => {
                    const k = th.dataset.sort;
                    state.sort = { key: k, dir: state.sort.key === k ? -state.sort.dir : (k === 'name' ? 1 : -1) };
                    renderLeadRows();
                };
            });
            $('#exportBtn').onclick = exportCsv;
        }
        $('#leadTotal').textContent = `${fmtN(state.leads.length)} total \u00B7 click a row for details`;
        renderLeadRows();
    }

    function stageDots(stage) {
        return `<div class="ad-stage"><span>${esc(STAGES[stage] || STAGES[0])}</span><div class="ad-stage__bar"><i style="width:${Math.round((stage / 6) * 100)}%"></i></div></div>`;
    }
    const statusPill = (s) => `<span class="ad-pill ad-pill--${esc(s)}"><i></i>${esc(STATUS[s] || 'New')}</span>`;
    const contactLine = (l) => esc(l.phone || l.email || (l.source === 'guest' ? 'No contact yet' : ''));

    function renderLeadRows() {
        const list = filtered();
        const pages = Math.max(1, Math.ceil(list.length / state.perPage));
        state.page = Math.min(state.page, pages);
        const slice = list.slice((state.page - 1) * state.perPage, state.page * state.perPage);
        $('#leadCount').textContent = list.length === state.leads.length ? `Showing all ${fmtN(list.length)} leads` : `${fmtN(list.length)} of ${fmtN(state.leads.length)} leads match`;
        $$('#leadsCard th[data-sort]').forEach((th) => {
            th.querySelector('.ad-arrow')?.remove();
            if (th.dataset.sort === state.sort.key) th.insertAdjacentHTML('beforeend', `<span class="ad-arrow">${state.sort.dir > 0 ? '\u2191' : '\u2193'}</span>`);
        });
        if (!slice.length) {
            const empty = `<div class="ad-empty">${state.leads.length ? 'No leads match these filters.' : 'No leads yet. They will show up here as soon as someone starts with MAYA.'}</div>`;
            $('#leadRows').innerHTML = `<tr><td colspan="8">${empty}</td></tr>`;
            $('#leadCards').innerHTML = empty;
            $('#pager').innerHTML = '';
            return;
        }
        $('#leadRows').innerHTML = slice.map((l, i) => {
            const s = signOf(l);
            const h = heatOf(l);
            return `<tr data-id="${esc(l.id)}" class="${state.fresh.has(l.id) ? 'is-new' : ''}" style="animation-delay:${Math.min(i, 20) * 18}ms">
                <td><div class="ad-person">${avatar(l)}<div style="min-width:0"><div class="ad-person__name">${esc(l.name || 'Unnamed visitor')}</div><div class="ad-person__sub">${contactLine(l)}</div></div></div></td>
                <td>${l.birthDate ? `${esc(fmtBirth(l))}<div class="ad-person__sub">${esc(fmtTime(l.birthTime) || 'time not given')}${s ? ` &middot; ${s.hi}` : ''}</div>` : '<span class="ad-muted">-</span>'}</td>
                <td>${esc(cityOf(l)) || '<span class="ad-muted">-</span>'}</td>
                <td>${stageDots(l.stage)}</td>
                <td><span class="ad-heatpill ${heatClass(h)}">${heatLabel(h)}</span></td>
                <td>${statusPill(l.status)}</td>
                <td><span class="ad-src">${esc(SOURCE[l.source] || l.source)}</span></td>
                <td title="${esc(fmtDateTime(l.lastActive))}">${esc(timeAgo(l.lastActive || l.createdAt))}</td>
            </tr>`;
        }).join('');
        $('#leadCards').innerHTML = slice.map((l, i) => {
            const h = heatOf(l);
            const s = signOf(l);
            return `<div class="ad-lcard" data-id="${esc(l.id)}" style="animation-delay:${Math.min(i, 20) * 18}ms">
                <div class="ad-lcard__top"><div class="ad-person">${avatar(l)}<div style="min-width:0"><div class="ad-person__name">${esc(l.name || 'Unnamed visitor')}</div><div class="ad-person__sub">${contactLine(l)}</div></div></div><span class="ad-heatpill ${heatClass(h)}">${heatLabel(h)}</span></div>
                <div class="ad-lcard__meta">${statusPill(l.status)}<span class="ad-src">${esc(STAGES[l.stage])}</span>${s ? `<span>${esc(s.hi)}</span>` : ''}${cityOf(l) ? `<span>${esc(cityOf(l))}</span>` : ''}<span>${esc(timeAgo(l.lastActive || l.createdAt))}</span></div>
            </div>`;
        }).join('');
        $$('#leadRows tr[data-id], #leadCards [data-id]').forEach((el) => { el.onclick = () => openDrawer(el.dataset.id); });
        $('#pager').innerHTML = pages > 1 ? `
            <span>Page ${state.page} of ${pages}</span>
            <div><button class="ad-btn" id="prevPg" ${state.page <= 1 ? 'disabled' : ''}>Previous</button><button class="ad-btn" id="nextPg" ${state.page >= pages ? 'disabled' : ''}>Next</button></div>` : '';
        if (pages > 1) {
            $('#prevPg').onclick = () => { state.page -= 1; renderLeadRows(); $('#leadsCard').scrollIntoView({ behavior: 'smooth' }); };
            $('#nextPg').onclick = () => { state.page += 1; renderLeadRows(); $('#leadsCard').scrollIntoView({ behavior: 'smooth' }); };
        }
    }

    function exportCsv() {
        const list = filtered();
        const cols = [
            ['Name', (l) => l.name], ['Phone', (l) => l.phone], ['Email', (l) => l.email], ['Gender', (l) => l.gender],
            ['Birth date', (l) => l.birthDate], ['Birth time', (l) => l.birthTime], ['Birth place', (l) => l.birthPlace],
            ['Surya rashi', (l) => (signOf(l) ? `${signOf(l).name} (${signOf(l).hi})` : '')], ['Age', (l) => ageOf(l) ?? ''],
            ['Language', (l) => l.language], ['Stage', (l) => STAGES[l.stage]], ['Heat', (l) => heatOf(l)], ['Status', (l) => STATUS[l.status]],
            ['Note', (l) => l.note], ['Source', (l) => SOURCE[l.source] || l.source], ['First seen', (l) => fmtDateTime(l.createdAt)], ['Last active', (l) => fmtDateTime(l.lastActive)]
        ];
        const cell = (v) => {
            let s = String(v ?? '');
            if (/^[=+\-@]/.test(s)) s = `'${s}`;
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const csv = [cols.map((c) => c[0]).join(','), ...list.map((l) => cols.map((c) => cell(c[1](l))).join(','))].join('\r\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `mayalogy-leads-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        toast(`Downloaded <b>${fmtN(list.length)}</b> leads`);
    }

    // ---------- drawer ----------
    function openDrawer(id) {
        const lead = state.leads.find((l) => l.id === id);
        if (!lead) return;
        state.openId = id;
        state.fresh.delete(id);
        fillDrawer(lead, false);
        $('#drawer').classList.add('is-open');
        $('#drawer').setAttribute('aria-hidden', 'false');
        $('#scrim').classList.add('is-open');
    }
    function closeDrawer() {
        state.openId = null;
        $('#drawer')?.classList.remove('is-open');
        $('#drawer')?.setAttribute('aria-hidden', 'true');
        $('#scrim')?.classList.remove('is-open');
    }

    const kv = (label, value) => (value ? `<div><small>${label}</small><b>${esc(value)}</b></div>` : '');

    function timeline(l) {
        const items = [];
        if (l.createdAt) items.push([l.createdAt, 'First seen', l.source === 'phone_capture' ? 'Gave phone number' : 'Started with MAYA']);
        if (l.birthDate) items.push([0, 'Shared birth details', [fmtBirth(l), fmtTime(l.birthTime), cityOf(l)].filter(Boolean).join(' \u00B7 ')]);
        if (l.stage >= 3) items.push([0, 'Saw their numbers', '']);
        if (l.stage >= 4) items.push([0, 'Entered the reading', l.answers?.length ? `${l.answers.length} answers` : '']);
        if (l.validations?.length) items.push([0, 'Answered questions', `${l.validations.length} replies`]);
        if (l.stage >= 6) items.push([l.account?.since || 0, 'Signed up', l.account?.type === 'phone' ? 'with phone' : 'with email']);
        if (l.lastActive) items.push([l.lastActive, 'Last active', timeAgo(l.lastActive)]);
        if (l.statusAt) items.push([l.statusAt, `Team: ${STATUS[l.status]}`, l.note ? l.note.slice(0, 80) : '']);
        return items.map(([t, title, sub]) => `<div><b>${esc(title)}</b>${t ? ` <span class="ad-muted">&middot; ${esc(fmtDateTime(t))}</span>` : ''}${sub ? `<br><span>${esc(sub)}</span>` : ''}</div>`).join('');
    }

    function fillDrawer(l, keepNote) {
        const drawer = $('#drawer');
        const draft = keepNote ? $('#noteBox', drawer)?.value : null;
        const s = signOf(l);
        const age = ageOf(l);
        const wa = waLink(l.phone);
        const h = heatOf(l);
        const nums = Object.entries(l.numbers || {});
        drawer.innerHTML = `
            <div class="ad-drawer__head">
                <button class="ad-btn ad-btn--icon ad-drawer__close" id="closeDrawer" aria-label="Close">${ICON.close}</button>
                <div class="ad-drawer__who">${avatar(l)}<div style="min-width:0">
                    <h3>${esc(l.name || 'Unnamed visitor')}</h3>
                    <p>${[s ? `${s.name} (${s.hi})` : '', age !== null ? `${age} yrs` : '', cityOf(l)].filter(Boolean).map(esc).join(' &middot; ') || 'No birth details yet'}</p>
                    <p style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">${statusPill(l.status)}<span class="ad-heatpill ${heatClass(h)}">${heatLabel(h)} priority</span><span class="ad-src">${esc(SOURCE[l.source] || l.source)}</span></p>
                </div></div>
                <div class="ad-drawer__actions">
                    ${hasPhone(l) ? `<a class="ad-btn ad-btn--primary" href="${esc(telLink(l.phone))}">${ICON.phone}Call</a>` : ''}
                    ${wa ? `<a class="ad-btn" href="${esc(wa)}" target="_blank" rel="noopener">${ICON.whatsapp}WhatsApp</a>` : ''}
                    ${l.email ? `<a class="ad-btn" href="mailto:${esc(l.email)}">${ICON.mail}Email</a>` : ''}
                    ${l.phone || l.email ? `<button class="ad-btn" id="copyContact">${ICON.copy}Copy contact</button>` : ''}
                </div>
            </div>
            <div class="ad-drawer__body">
                <div class="ad-sec">
                    <h4>Follow-up</h4>
                    <div class="ad-status" id="statusBtns">${Object.entries(STATUS).map(([k, v]) => `<button data-s="${k}" class="${l.status === k ? 'is-on' : ''}">${v}</button>`).join('')}</div>
                    <textarea class="ad-note" id="noteBox" placeholder="Add a note for the team">${esc(draft ?? l.note ?? '')}</textarea>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;gap:10px">
                        <span class="ad-muted" style="font-size:.74rem">${l.statusAt ? `Last updated ${esc(timeAgo(l.statusAt))}` : 'Not followed up yet'}</span>
                        <button class="ad-btn ad-btn--primary" id="saveStatus">Save</button>
                    </div>
                </div>
                <div class="ad-sec"><h4>Profile</h4><div class="ad-kv">
                    ${kv('Phone', l.phone)}${kv('Email', l.email)}
                    ${kv('Birth date', fmtBirth(l))}${kv('Birth time', fmtTime(l.birthTime))}
                    ${kv('Birth place', l.birthPlace)}${kv('Gender', l.gender && l.gender[0].toUpperCase() + l.gender.slice(1))}
                    ${kv('Marital status', l.maritalStatus && l.maritalStatus[0].toUpperCase() + l.maritalStatus.slice(1))}${kv('Language', langOf(l) === 'hi' ? 'Hindi' : langOf(l) === 'en' ? 'English' : '')}
                    ${kv('First seen', fmtDateTime(l.createdAt))}${kv('Last active', fmtDateTime(l.lastActive))}
                </div></div>
                ${nums.length ? `<div class="ad-sec"><h4>Numerology</h4><div class="ad-nums">${nums.map(([k, v]) => `<div class="ad-num"><b>${esc(v)}</b><small>${esc(NUM_LABEL[k] || k)}</small></div>`).join('')}</div></div>` : ''}
                <div class="ad-sec"><h4>Activity</h4><div class="ad-timeline">${timeline(l)}</div></div>
                ${l.answers?.length ? `<div class="ad-sec"><h4>Their answers</h4><div class="ad-qa">${l.answers.map((a) => `<div><small>${esc(a.q.replace(/_/g, ' '))}</small>${esc(a.a)}</div>`).join('')}</div></div>` : ''}
                ${l.validations?.length ? `<div class="ad-sec"><h4>Reading replies</h4><div class="ad-qa">${l.validations.map((v) => `<div style="border-left-color:var(--gold)"><small>${esc(v.q)}</small>${esc(v.a)}</div>`).join('')}</div></div>` : ''}
                ${l.device && (l.device.app || l.device.tz || l.device.screen) ? `<div class="ad-sec"><h4>Device</h4><div class="ad-kv">${kv('App', l.device.app === 'android-webview' ? 'Android app' : l.device.app ? 'Website' : '')}${kv('Time zone', l.device.tz)}${kv('Screen', l.device.screen)}${kv('Browser language', l.device.lang)}</div></div>` : ''}
                <p class="ad-muted" style="font-size:.7rem;word-break:break-all">ID: ${esc(l.id)}</p>
            </div>`;

        $('#closeDrawer').onclick = closeDrawer;
        let chosen = l.status;
        $$('#statusBtns button').forEach((b) => {
            b.onclick = () => { chosen = b.dataset.s; $$('#statusBtns button').forEach((x) => x.classList.toggle('is-on', x === b)); };
        });
        $('#saveStatus').onclick = async () => {
            const btn = $('#saveStatus');
            btn.disabled = true;
            btn.textContent = 'Saving...';
            try {
                const note = $('#noteBox').value;
                const res = await api(API_LEADS, { method: 'POST', body: JSON.stringify({ id: l.id, status: chosen, note }) });
                Object.assign(l, { status: res.status, note: res.note, statusAt: res.updatedAt });
                delete l._heat;
                toast(`Saved. <b>${esc(l.name || 'Lead')}</b> is now ${esc(STATUS[l.status])}.`);
                renderKpis();
                renderHero();
                renderLeadRows();
                fillDrawer(l, false);
            } catch (error) {
                toast(esc(error.message));
                btn.disabled = false;
                btn.textContent = 'Save';
            }
        };
        const copyBtn = $('#copyContact');
        if (copyBtn) {
            copyBtn.onclick = async () => {
                const textValue = [l.name, l.phone, l.email].filter(Boolean).join(' | ');
                try { await navigator.clipboard.writeText(textValue); toast('Copied'); } catch (_e) { toast(esc(textValue)); }
            };
        }
    }

    // ---------- keyboard + resize ----------
    document.addEventListener('keydown', (e) => {
        if (!document.body.classList.contains('is-dash')) return;
        const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
        if (e.key === 'Escape') closeDrawer();
        if (typing) return;
        if (e.key === '/') { e.preventDefault(); $('#q')?.focus(); }
        if (e.key === 'r' || e.key === 'R') load(true);
    });
    let rt = null;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if ($('#trendChart')) renderTrend(); }, 200); });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && getToken() && $('#kpis') && Date.now() - state.generatedAt > REFRESH_MS) load(false);
    });

    // ---------- start ----------
    if (getToken()) startDashboard(); else renderLogin();
})();
