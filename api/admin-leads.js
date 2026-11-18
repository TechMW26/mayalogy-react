import { firebaseRequest } from './_firebase.js';
import { isAdminRequest } from './_adminAuth.js';

// Admin panel data. GET: every lead from the 4 places the app saves people
// (guests without login, phone logins, email/Google logins, phone numbers given),
// joined into one list. POST: save the team's follow-up status and note for a lead.
// Both need the admin token from /api/admin-login.

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };

const STATUS_PATH = 'maya_admin_leads';
const STATUSES = ['new', 'contacted', 'interested', 'converted', 'not_interested'];
const LEAD_ID = /^[gpec]:[^.#$[\]/\s]{1,150}$/;
const CACHE_MS = 15000;
let cache = null;

const STAGES = ['Visited', 'Gave name', 'Birth details', 'Saw numbers', 'In reading', 'Answered questions', 'Signed up'];

const text = (value, max = 160) => {
    if (typeof value === 'string') return value.trim().slice(0, max);
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return '';
};
const time = (value) => {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n < 1e12 ? n * 1000 : n;
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : 0;
};
const first = (...values) => {
    for (const v of values) {
        const t = text(v);
        if (t) return t;
    }
    return '';
};
const digits = (value) => String(value || '').replace(/\D/g, '').slice(-10);
const obj = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
const list = (value) => (Array.isArray(value) ? value : Object.values(obj(value)));

function personFrom(...sources) {
    const p = Object.assign({}, ...sources.map(obj).reverse());
    const name = first(p.fullName, p.name, [text(p.firstName), text(p.lastName)].filter(Boolean).join(' '));
    return {
        name,
        phone: first(p.phone, p.phoneNumber && `${text(p.countryCode)}${text(p.phoneNumber)}`),
        email: first(p.email),
        gender: first(p.gender).toLowerCase(),
        birthDate: first(p.birthDate, p.dob),
        birthTime: first(p.birthTime, p.tob),
        birthPlace: first(p.birthPlace, p.place, p.city),
        maritalStatus: first(p.maritalStatus).toLowerCase(),
        language: first(p.language).toLowerCase()
    };
}

function numbersFrom(calc) {
    const c = obj(calc);
    const out = {};
    ['lifePath', 'destiny', 'soulUrge', 'personality', 'birthday', 'maturity', 'personalYear'].forEach((k) => {
        const v = Number(typeof c[k] === 'object' ? c[k]?.number ?? c[k]?.value : c[k]);
        if (Number.isFinite(v) && v > 0) out[k] = v;
    });
    return out;
}

function answersFrom(answers) {
    return Object.entries(obj(answers)).slice(0, 30).map(([q, a]) => ({ q: text(q, 80), a: text(a, 400) })).filter((x) => x.a);
}

function validationsFrom(validations) {
    return list(validations).slice(-20).map((v) => ({
        q: text(v?.question, 300),
        a: text(typeof v?.answer === 'object' ? JSON.stringify(v.answer) : v?.answer, 300),
        at: time(v?.timestamp)
    })).filter((x) => x.q || x.a);
}

function stageOf(lead, extra = {}) {
    if (lead.account) return 6;
    if (extra.validations >= 2) return 5;
    if (extra.inReading || extra.answers > 0) return 4;
    if (extra.reachedNumbers || extra.hasNumbers) return 3;
    if (lead.birthDate) return 2;
    if (lead.name || lead.phone) return 1;
    return 0;
}

function fromGuest(id, g) {
    const ob = obj(g.onboarding);
    const person = personFrom(g.profile, g.funnel, ob.data);
    if (!person.language) person.language = text(g.language).toLowerCase();
    const answers = answersFrom(g.answers);
    const validations = validationsFrom(g.validations);
    const numbers = numbersFrom(g.calculations);
    const journey = obj(g.journey);
    const device = obj(g.device);
    const lead = {
        id: `g:${id}`,
        source: 'guest',
        ...person,
        createdAt: time(g.firstSeenAt) || time(g.updatedAt) || time(journey.at),
        lastActive: Math.max(time(g.updatedAt), time(journey.at)),
        account: null,
        linkedTo: g.linkedTo ? { email: text(g.linkedTo.email), phone: text(g.linkedTo.phone), userId: text(g.linkedTo.userId), at: time(g.linkedTo.at) } : null,
        onboardingStep: text(ob.stepId),
        answers,
        validations,
        numbers,
        journey: { path: text(journey.path, 200), inReading: !!journey.inReading, reachedNumbers: !!journey.reachedNumbers },
        device: { app: text(device.app), lang: text(device.lang), tz: text(device.tz), screen: device.w && device.h ? `${device.w}x${device.h}` : '', ua: text(g.userAgent, 300) }
    };
    lead.stage = stageOf(lead, {
        validations: validations.length,
        answers: answers.length,
        inReading: lead.journey.inReading,
        reachedNumbers: lead.journey.reachedNumbers,
        hasNumbers: Object.keys(numbers).length > 0
    });
    return lead;
}

function fromAccount(prefix, key, u) {
    const person = personFrom(u, u.profile, u.birthData);
    const createdAt = time(u.createdAt) || time(u.lastLogin) || time(u.updatedAt);
    return {
        id: `${prefix}:${key}`,
        source: prefix === 'p' ? 'phone' : (u.googleId || /google/i.test(text(u.provider || u.authProvider)) ? 'google' : 'email'),
        ...person,
        createdAt,
        lastActive: Math.max(time(u.lastLogin), time(u.updatedAt), time(u.lastActive), createdAt),
        account: { type: prefix === 'p' ? 'phone' : 'email', since: createdAt },
        linkedTo: null,
        onboardingStep: '',
        answers: [],
        validations: [],
        numbers: {},
        journey: {},
        device: {},
        stage: 6
    };
}

function fromCapture(key, c) {
    const capturedAt = time(c.capturedAt);
    return {
        id: `c:${key}`,
        source: 'phone_capture',
        ...personFrom(c),
        createdAt: capturedAt,
        lastActive: capturedAt,
        account: null,
        linkedTo: null,
        onboardingStep: text(c.source),
        answers: [],
        validations: [],
        numbers: {},
        journey: {},
        device: {},
        stage: 1
    };
}

// The guest's own story (answers, journey) is richer than the account record: fold it in.
function mergeGuestIntoAccount(account, guest) {
    ['name', 'phone', 'email', 'gender', 'birthDate', 'birthTime', 'birthPlace', 'maritalStatus', 'language'].forEach((k) => {
        if (!account[k] && guest[k]) account[k] = guest[k];
    });
    account.createdAt = Math.min(...[account.createdAt, guest.createdAt].filter(Boolean)) || account.createdAt;
    account.lastActive = Math.max(account.lastActive || 0, guest.lastActive || 0);
    account.answers = account.answers.length ? account.answers : guest.answers;
    account.validations = account.validations.length ? account.validations : guest.validations;
    account.numbers = Object.keys(account.numbers).length ? account.numbers : guest.numbers;
    account.journey = guest.journey;
    account.device = guest.device;
    account.onboardingStep = guest.onboardingStep;
    account.guestId = guest.id;
}

async function loadLeads() {
    let failed = 0;
    let lastError = null;
    const read = (path) => firebaseRequest(path).catch((error) => { failed += 1; lastError = error; return null; });
    const [guests, phoneUsers, users, captures, statuses] = await Promise.all([
        read('maya_guests'), read('maya_phone_users'), read('users'), read('phone_captures'), read(STATUS_PATH)
    ]);
    // If nothing could be read, the database link is broken: say so instead of showing 0 leads.
    if (failed === 5) throw lastError || new Error('Database not reachable');

    const accounts = [];
    Object.entries(obj(phoneUsers)).forEach(([key, u]) => {
        if (!u || typeof u !== 'object' || u.accountType === 'google_play_review') return;
        accounts.push(fromAccount('p', key, u));
    });
    Object.entries(obj(users)).forEach(([key, u]) => {
        if (!u || typeof u !== 'object') return;
        accounts.push(fromAccount('e', key, u));
    });

    const byEmail = new Map();
    const byPhone = new Map();
    const byKey = new Map();
    accounts.forEach((a) => {
        if (a.email) byEmail.set(a.email.toLowerCase(), a);
        if (digits(a.phone)) byPhone.set(digits(a.phone), a);
        byKey.set(a.id.slice(2), a);
    });

    const leads = [...accounts];
    Object.entries(obj(guests)).forEach(([id, g]) => {
        if (!g || typeof g !== 'object') return;
        const guest = fromGuest(id, g);
        const link = guest.linkedTo;
        const account = link && ((link.email && byEmail.get(link.email.toLowerCase()))
            || (digits(link.phone) && byPhone.get(digits(link.phone)))
            || (link.userId && byKey.get(link.userId)));
        if (account) {
            mergeGuestIntoAccount(account, guest);
            return;
        }
        if (link) {
            guest.stage = 6;
            guest.account = { type: link.email ? 'email' : 'phone', since: link.at };
        }
        leads.push(guest);
    });

    Object.entries(obj(captures)).forEach(([key, c]) => {
        if (!c || typeof c !== 'object') return;
        const d = digits(c.phone || c.phoneNumber);
        if (d && byPhone.has(d)) return;
        if (d && leads.some((l) => digits(l.phone) === d)) return;
        leads.push(fromCapture(key, c));
    });

    const statusMap = obj(statuses);
    leads.forEach((lead) => {
        const s = obj(statusMap[lead.id.replace(':', '_')]);
        lead.status = STATUSES.includes(s.status) ? s.status : 'new';
        lead.note = text(s.note, 1000);
        lead.statusAt = time(s.updatedAt);
        lead.stageLabel = STAGES[lead.stage] || STAGES[0];
    });

    leads.sort((a, b) => (b.lastActive || b.createdAt || 0) - (a.lastActive || a.createdAt || 0));
    return { leads, generatedAt: Date.now(), stages: STAGES, statuses: STATUSES };
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex');
    if (!isAdminRequest(req)) {
        return res.status(401).json({ error: 'Please sign in again', code: 'unauthorized' });
    }

    if (req.method === 'GET') {
        const fresh = /[?&]fresh=1\b/.test(String(req.url || ''));
        try {
            if (!fresh && cache && Date.now() - cache.at < CACHE_MS) {
                return res.status(200).json(cache.data);
            }
            const data = await loadLeads();
            cache = { at: Date.now(), data };
            return res.status(200).json(data);
        } catch (error) {
            console.error('Admin leads error:', error.message);
            return res.status(500).json({ error: 'Could not load leads from the database' });
        }
    }

    if (req.method === 'POST') {
        let body = req.body;
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch { body = {}; }
        }
        const id = typeof body?.id === 'string' ? body.id : '';
        const status = typeof body?.status === 'string' ? body.status : '';
        if (!LEAD_ID.test(id) || !STATUSES.includes(status)) {
            return res.status(400).json({ error: 'Invalid lead or status' });
        }
        const record = { status, note: text(body?.note, 1000), updatedAt: Date.now() };
        try {
            await firebaseRequest(`${STATUS_PATH}/${id.replace(':', '_').replace(/[.#$[\]/]/g, '_')}`, { method: 'PUT', body: record });
            if (cache) {
                const lead = cache.data.leads.find((l) => l.id === id);
                if (lead) Object.assign(lead, { status, note: record.note, statusAt: record.updatedAt });
            }
            return res.status(200).json({ success: true, ...record });
        } catch (error) {
            console.error('Admin lead status error:', error.message);
            return res.status(500).json({ error: 'Could not save the status' });
        }
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
}
