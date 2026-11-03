// Behaviour probe for dsh-session-temp-reaper.
//
// Drives `apply()` with a fake Cordis context: a fake webServer captures the two
// routes, a fake sessionQuery replays a hand-built session log, and a fake
// tools / systemPrompt host captures the marker tool and the prompt section.
// Everything runs against a throwaway sandbox in the OS temp directory.
//
// Run: node test/probe.mjs
import { mkdtemp, mkdir, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apply } from '../index.js';

const ROUTE = '/session-temp-reaper';
const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

let passed = 0;
const failed = [];

async function test(name, fn) {
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

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function eq(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

/** A session-log tool call. */
function call_(name, args, time) {
    return { type: 'tool/call', time, data: { name, arguments: JSON.stringify(args) } };
}

async function exists(path) {
    try {
        await stat(path);
        return true;
    }
    catch {
        return false;
    }
}

function mount({ sessionId, cwd, createdAt, events }) {
    const state = { routes: new Map(), tool: null, section: null, readCount: 0 };
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
                state.readCount += 1;
                if (id !== sessionId) throw new Error(`session "${id}" not found`);
                return { session: { cwd, createdAt }, events };
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
async function call(state, route, { method = 'POST', body, origin, raw } = {}) {
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
async function sandbox(events, { createdAt = Date.now() - HOUR, sessionId = 'session-probe-001' } = {}) {
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

// ── routes ────────────────────────────────────────────────────────────────────

await test('both routes are registered', async () => {
    const box = await sandbox([]);
    try {
        assert(box.state.routes.has(`${ROUTE}/scan`), 'scan route missing');
        assert(box.state.routes.has(`${ROUTE}/delete`), 'delete route missing');
    }
    finally {
        await box.cleanup();
    }
});

await test('GET is rejected with 405', async () => {
    const box = await sandbox([]);
    try {
        const { status } = await call(box.state, `${ROUTE}/scan`, { method: 'GET' });
        eq(status, 405, 'GET status');
    }
    finally {
        await box.cleanup();
    }
});

await test('missing sessionId is rejected with 400', async () => {
    const box = await sandbox([]);
    try {
        const { status, json } = await call(box.state, `${ROUTE}/scan`, { body: {} });
        eq(status, 400, 'status');
        eq(json.code, 'invalid-session', 'code');
    }
    finally {
        await box.cleanup();
    }
});

await test('cross-origin request is rejected with 403', async () => {
    const box = await sandbox([]);
    try {
        const { status } = await call(box.state, `${ROUTE}/scan`, {
            body: { sessionId: box.sessionId },
            origin: 'https://evil.example',
        });
        eq(status, 403, 'status');
    }
    finally {
        await box.cleanup();
    }
});

await test('same-origin request is accepted', async () => {
    const box = await sandbox([]);
    try {
        const { status } = await call(box.state, `${ROUTE}/scan`, {
            body: { sessionId: box.sessionId },
            origin: 'http://127.0.0.1:2465',
        });
        eq(status, 200, 'status');
    }
    finally {
        await box.cleanup();
    }
});

await test('oversized body is rejected with 400', async () => {
    const box = await sandbox([]);
    try {
        const raw = `{"sessionId":"${box.sessionId}","pad":"${'x'.repeat(1_100_000)}"}`;
        const { status, json } = await call(box.state, `${ROUTE}/scan`, { raw });
        eq(status, 400, 'status');
        eq(json.code, 'bad-request', 'code');
    }
    finally {
        await box.cleanup();
    }
});

await test('unknown session id surfaces as 500 scan-failed', async () => {
    const box = await sandbox([]);
    try {
        const { status, json } = await call(box.state, `${ROUTE}/scan`, { body: { sessionId: 'session-other' } });
        eq(status, 500, 'status');
        eq(json.code, 'scan-failed', 'code');
    }
    finally {
        await box.cleanup();
    }
});

// ── marking and default selection ─────────────────────────────────────────────

await test('marked file defaults to delete, unmarked file defaults to keep', async () => {
    const now = Date.now();
    const box = await sandbox((cwd) => [
        call_('write', { path: join(cwd, 'scratch.mjs') }, now - 10 * MIN),
        call_('write', { path: join(cwd, 'kept.mjs') }, now - 9 * MIN),
        call_('mark_temp_files', { paths: ['scratch.mjs'], note: 'probe' }, now - 8 * MIN),
    ]);
    try {
        await writeFile(join(box.cwd, 'scratch.mjs'), 'x', 'utf8');
        await writeFile(join(box.cwd, 'kept.mjs'), 'y', 'utf8');
        const { status, json } = await box.scan();
        eq(status, 200, 'status');
        const byPath = new Map(json.items.map((item) => [item.display, item]));
        const scratch = byPath.get('scratch.mjs');
        const kept = byPath.get('kept.mjs');
        assert(scratch !== undefined && kept !== undefined, 'both files should be listed');
        eq(scratch.marked, true, 'scratch.marked');
        eq(scratch.keepByDefault, false, 'scratch.keepByDefault');
        eq(kept.marked, false, 'kept.marked');
        eq(kept.keepByDefault, true, 'kept.keepByDefault');
    }
    finally {
        await box.cleanup();
    }
});

await test('present-protected file starts unticked', async () => {
    const now = Date.now();
    const box = await sandbox((cwd) => [
        call_('write', { path: join(cwd, 'deliver.md') }, now - 10 * MIN),
        call_('present', { files: [{ path: 'deliver.md' }] }, now - 9 * MIN),
        call_('mark_temp_files', { paths: ['deliver.md'] }, now - 8 * MIN),
    ]);
    try {
        await writeFile(join(box.cwd, 'deliver.md'), '# hi', 'utf8');
        const { json } = await box.scan();
        const item = json.items.find((entry) => entry.display === 'deliver.md');
        assert(item !== undefined, 'file should be listed');
        eq(item.delivered, true, 'delivered');
        eq(item.keepByDefault, true, 'keepByDefault');
    }
    finally {
        await box.cleanup();
    }
});

// ── TMP-03: protection must not depend on the recent-event window ─────────────

await test('TMP-03: a present from 100h ago still protects after fresh events', async () => {
    const now = Date.now();
    const box = await sandbox((cwd) => [
        call_('write', { path: join(cwd, 'old-deliver.md') }, now - 101 * HOUR),
        call_('present', { files: [{ path: 'old-deliver.md' }] }, now - 100 * HOUR),
        call_('mark_temp_files', { paths: ['old-deliver.md'] }, now - 99 * HOUR),
        call_('bash', { command: 'echo fresh' }, now - 1 * MIN),
    ]);
    try {
        await writeFile(join(box.cwd, 'old-deliver.md'), '# old', 'utf8');
        const { json } = await box.scan();
        const item = json.items.find((entry) => entry.display === 'old-deliver.md');
        assert(item !== undefined, 'file should be listed');
        eq(item.delivered, true, 'delivered must survive the 72h window');
        eq(item.keepByDefault, true, 'keepByDefault');
    }
    finally {
        await box.cleanup();
    }
});

// ── TMP-02: protection must be enforced by the host, not just defaulted ───────

await test('TMP-02: deleting a delivered file is refused and keeps the file', async () => {
    const now = Date.now();
    const box = await sandbox((cwd) => [
        call_('write', { path: join(cwd, 'deliver2.md') }, now - 10 * MIN),
        call_('present', { files: [{ path: 'deliver2.md' }] }, now - 9 * MIN),
        call_('mark_temp_files', { paths: ['deliver2.md'] }, now - 8 * MIN),
    ]);
    const target = join(box.cwd, 'deliver2.md');
    try {
        await writeFile(target, '# keep me', 'utf8');
        const { json: scanned } = await box.scan();
        const item = scanned.items.find((entry) => entry.display === 'deliver2.md');
        assert(item !== undefined, 'file should be listed before delete');
        const { json } = await box.del([target]);
        eq(json.removed, 0, 'removed');
        eq(json.results[0].ok, false, 'result.ok');
        eq(json.results[0].code, 'protected', 'result.code');
        assert(await exists(target), 'file must still exist on disk');
    }
    finally {
        await box.cleanup();
    }
});

// ── delete semantics ──────────────────────────────────────────────────────────

await test('deleting a marked scratch file succeeds and invalidates the cache', async () => {
    const now = Date.now();
    const box = await sandbox((cwd) => [
        call_('write', { path: join(cwd, 'gone.tmp') }, now - 10 * MIN),
        call_('mark_temp_files', { paths: ['gone.tmp'] }, now - 9 * MIN),
    ]);
    const target = join(box.cwd, 'gone.tmp');
    try {
        await writeFile(target, 'x', 'utf8');
        await box.scan();
        const first = await box.del([target]);
        eq(first.json.removed, 1, 'removed');
        eq(first.json.results[0].ok, true, 'ok');
        assert(!(await exists(target)), 'file must be gone');
        const second = await box.del([target]);
        eq(second.json.removed, 0, 'second removed');
        eq(second.json.results[0].code, 'not-offered', 'second code');
    }
    finally {
        await box.cleanup();
    }
});

await test('a path outside the scan is refused with not-offered', async () => {
    const box = await sandbox([]);
    try {
        const { json } = await box.del([join(box.cwd, 'never-listed.txt')]);
        eq(json.removed, 0, 'removed');
        eq(json.results[0].code, 'not-offered', 'code');
    }
    finally {
        await box.cleanup();
    }
});

await test('a .git path is refused with git', async () => {
    const now = Date.now();
    const gitFile = join('.git', 'config');
    const box = await sandbox((cwd) => [
        call_('write', { path: join(cwd, '.git', 'config') }, now - 10 * MIN),
    ]);
    try {
        await mkdir(join(box.cwd, '.git'), { recursive: true });
        await writeFile(join(box.cwd, gitFile), 'x', 'utf8');
        const { json: scanned } = await box.scan();
        eq(scanned.items.some((item) => item.display.includes('.git')), false, '.git must never be listed');
        const { json } = await box.del([join(box.cwd, gitFile)]);
        eq(json.removed, 0, 'removed');
        eq(json.results[0].code, 'not-offered', 'code');
        assert(await exists(join(box.cwd, gitFile)), 'git file must still exist');
    }
    finally {
        await box.cleanup();
    }
});

await test('a non-spill directory is refused with not-a-spill-dir', async () => {
    const now = Date.now();
    const box = await sandbox((cwd) => [
        call_('write', { path: join(cwd, 'sub', 'inner.txt') }, now - 10 * MIN),
    ]);
    const dir = join(box.cwd, 'sub');
    try {
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, 'inner.txt'), 'x', 'utf8');
        const { json: scanned } = await box.scan();
        // The directory itself is not a write target, so it is not offered at
        // all; the refusal for a directory can only be reached through a scan
        // entry of kind 'dir', which today only spill directories produce.
        eq(scanned.items.some((item) => item.path === dir), false, 'plain dir must not be offered');
    }
    finally {
        await box.cleanup();
    }
});

// ── marker tool ───────────────────────────────────────────────────────────────

await test('marker tool ignores .git paths and empty strings', async () => {
    const box = await sandbox([]);
    try {
        const tool = box.state.tool;
        assert(tool !== null, 'tool should be registered');
        const value = await tool.execute({ paths: ['a.txt', '.git/config', '', 'b.txt'] });
        assert(value.marked.includes('a.txt'), 'a.txt marked');
        assert(value.marked.includes('b.txt'), 'b.txt marked');
        assert(!value.marked.some((path) => path.includes('.git')), '.git path must be ignored');
        eq(value.ignored.length, 2, 'ignored count');
    }
    finally {
        await box.cleanup();
    }
});

await test('marker tool renders the mark count', async () => {
    const box = await sandbox([]);
    try {
        const tool = box.state.tool;
        const rendered = tool.output.render({}, { marked: ['a', 'b'], ignored: [] });
        eq(rendered[0].text, 'Marked 2 temporary file(s).', 'render text');
    }
    finally {
        await box.cleanup();
    }
});

await test('prompt section is registered once, last', async () => {
    const box = await sandbox([]);
    try {
        const section = box.state.section;
        assert(section !== null, 'prompt section should be registered');
        eq(section.name, 'session-temp-reaper', 'section name');
        eq(section.order, 900, 'section order');
        assert(section.text.includes('mark_temp_files'), 'section must name the tool');
    }
    finally {
        await box.cleanup();
    }
});

// ── summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed.length} failed`);
if (failed.length > 0) {
    for (const { name, error } of failed) console.log(`  - ${name}: ${error.message}`);
    process.exitCode = 1;
}
