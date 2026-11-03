// Shared probe harness for dsh-session-temp-reaper.
//
// Drives the real `apply()` with a fake Cordis context: a fake webServer
// captures the two routes, a fake sessionQuery replays hand-built session logs,
// and fake tools / systemPrompt hosts capture the marker tool and the prompt
// section. Nothing here touches a real profile or the real session log.
import { mkdtemp, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apply } from '../index.js';

export const ROUTE = '/api/session-temp-reaper';
export const HOUR = 60 * 60 * 1000;
export const MIN = 60 * 1000;

const failed = [];
let passed = 0;

export async function test(name, fn) {
    try {
        await fn();
        passed += 1;
        console.log(`PASS  ${name}`);
    }
    catch (error) {
        failed.push({ name, error });
        console.log(`FAIL  ${name}\n      ${error.message}`);
    }
}

/** Print the run summary; sets a non-zero exit code when anything failed. */
export function summary() {
    console.log(`\n${passed} passed, ${failed.length} failed`);
    if (failed.length > 0) {
        for (const { name, error } of failed) console.log(`  - ${name}: ${error.message}`);
        process.exitCode = 1;
    }
}

export function assert(condition, message) {
    if (!condition) throw new Error(message);
}

export function eq(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

/** A session-log tool call. */
export function call_(name, args, time) {
    return { type: 'tool/call', time, data: { name, arguments: JSON.stringify(args) } };
}

export async function exists(path) {
    try {
        await stat(path);
        return true;
    }
    catch {
        return false;
    }
}

export function mount({ sessions, sessionId, cwd, createdAt, events }) {
    const known = sessions ?? new Map([[sessionId, { cwd, createdAt, events }]]);
    const state = { fetchRoutes: new Map(), tool: null, section: null, reads: new Map() };
    const host = {
        effect(fn) {
            const disposer = fn();
            state.disposer = disposer;
            return disposer;
        },
        // Exact Fetch routes on the authenticated `/api` channel. The fake only
        // records them; the real bridge does Host/Origin checks and peer auth
        // before calling `fetch`, which is exactly why the plugin no longer
        // carries its own authentication.
        connection: {
            fetch: {
                register(route) {
                    if (state.fetchRoutes.has(route.path)) throw new Error(`duplicate route ${route.path}`);
                    state.fetchRoutes.set(route.path, route);
                    return async () => {
                        state.fetchRoutes.delete(route.path);
                    };
                },
            },
        },
        sessionQuery: {
            async readSession(id) {
                state.reads.set(id, (state.reads.get(id) ?? 0) + 1);
                const session = known.get(id);
                if (session === undefined) throw new Error(`session "${id}" not found`);
                return { session: { cwd: session.cwd, createdAt: session.createdAt }, events: session.events };
            },
        },
        tools: {
            register(definition) {
                state.tool = definition;
                return () => {};
            },
        },
        systemPrompt: {
            section(definition) {
                state.section = definition;
                return () => {};
            },
        },
    };
    const ctx = {
        inject(names, callback) {
            const picked = { effect: host.effect };
            for (const name of names) picked[name] = host[name];
            callback(picked);
        },
    };
    apply(ctx);
    return state;
}

/**
 * Call one registered exact Fetch route, returning parsed JSON and status.
 * `path` is the full browser path, for example `/api/session-temp-reaper/scan`.
 */
export async function call(state, path, { method = 'POST', body, raw } = {}) {
    const route = state.fetchRoutes.get(path);
    if (route === undefined) throw new Error(`route not registered: ${path}`);
    const payload = raw !== undefined ? raw : body === undefined ? '' : JSON.stringify(body);
    const request = new Request(`http://127.0.0.1:2465${path}`, {
        method,
        headers: payload === '' ? {} : { 'content-type': 'application/json' },
        body: payload === '' ? undefined : payload,
    });
    const response = await route.fetch(request);
    const text = await response.text();
    let json = null;
    try {
        json = text === '' ? null : JSON.parse(text);
    }
    catch {
        json = { unparsable: text };
    }
    return { status: response.status, json, route };
}

/** Sandbox plus a scan/delete pair wired to one session id. */
export async function sandbox(events, { createdAt = Date.now() - HOUR, sessionId = 'session-probe-001' } = {}) {
    const cwd = await mkdtemp(join(tmpdir(), 'reaper-probe-'));
    const state = mount({ sessionId, cwd, createdAt, events: typeof events === 'function' ? events(cwd) : events });
    return {
        cwd,
        state,
        sessionId,
        scan: () => call(state, `${ROUTE}/scan`, { body: { sessionId } }),
        del: (paths) => call(state, `${ROUTE}/delete`, { body: { sessionId, paths } }),
        cleanup: () => rm(cwd, { recursive: true, force: true }),
    };
}

/** Several sessions on one mount, sharing the module-level scan cache. */
export async function sandboxMany(count, idPrefix = 'session-many-') {
    const sessions = new Map();
    const dirs = [];
    const now = Date.now();
    for (let index = 0; index < count; index += 1) {
        const cwd = await mkdtemp(join(tmpdir(), 'reaper-probe-'));
        const id = `${idPrefix}${String(index).padStart(3, '0')}`;
        dirs.push(cwd);
        sessions.set(id, {
            cwd,
            createdAt: now - HOUR,
            events: [call_('write', { path: join(cwd, `f${index}.txt`) }, now - 10 * MIN)],
        });
        await writeFile(join(cwd, `f${index}.txt`), 'x', 'utf8');
    }
    const state = mount({ sessions });
    return {
        sessions,
        state,
        ids: [...sessions.keys()],
        scan: (sessionId) => call(state, `${ROUTE}/scan`, { body: { sessionId } }),
        del: (sessionId, paths) => call(state, `${ROUTE}/delete`, { body: { sessionId, paths } }),
        reads: (sessionId) => state.reads.get(sessionId) ?? 0,
        cleanup: async () => {
            for (const dir of dirs) await rm(dir, { recursive: true, force: true });
        },
    };
}
