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

export const ROUTE = '/session-temp-reaper';
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
    const state = { routes: new Map(), tool: null, section: null, reads: new Map() };
    const host = {
        effect(fn) {
            const disposer = fn();
            state.disposer = disposer;
            return disposer;
        },
        webServer: {
            register(spec) {
                state.routes.set(spec.path, spec.handler);
                return () => state.routes.delete(spec.path);
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

/** POST to a captured route, returning parsed JSON and the status code. */
export async function call(state, route, { method = 'POST', body, origin, raw } = {}) {
    const handler = state.routes.get(route);
    if (handler === undefined) throw new Error(`route not registered: ${route}`);
    const payload = raw !== undefined ? raw : body === undefined ? '' : JSON.stringify(body);
    const request = {
        method,
        headers: { host: '127.0.0.1:2465' },
        async *[Symbol.asyncIterator]() {
            if (payload !== '') yield Buffer.from(payload, 'utf8');
        },
    };
    if (origin !== undefined) request.headers.origin = origin;
    const response = {
        status: 0,
        headers: {},
        text: '',
        writeHead(status, headers) {
            this.status = status;
            Object.assign(this.headers, headers ?? {});
        },
        end(text) {
            this.text = text ?? '';
        },
    };
    await handler(request, response);
    let json = null;
    try {
        json = response.text === '' ? null : JSON.parse(response.text);
    }
    catch {
        json = { unparsable: response.text };
    }
    return { status: response.status, json };
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
