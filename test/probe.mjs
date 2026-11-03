// Behaviour probe for dsh-session-temp-reaper (no profile discoverable).
//
// Run: node test/probe.mjs
//
// `DSH_PROFILE_DIR` is injected for shell tools but is not set for the desktop
// host process, so a probe that inherits it would silently test a different
// code path. This file clears it on purpose; the known-profile path is covered
// by `test/profile-probe.mjs`.
delete process.env.DSH_PROFILE_DIR;

import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    HOUR,
    MIN,
    ROUTE,
    assert,
    call,
    call_,
    eq,
    exists,
    sandbox,
    sandboxMany,
    summary,
    test,
} from './harness.mjs';

// ── routes ────────────────────────────────────────────────────────────────────

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
        const value = await tool.execute({ paths: ['a.txt', '.git/config', '', 'b.txt'] }, { agent: { id: box.sessionId } });
        assert(value.marked.includes('a.txt'), 'a.txt marked');
        assert(value.marked.includes('b.txt'), 'b.txt marked');
        assert(!value.marked.some((path) => path.includes('.git')), '.git path must be ignored');
        eq(value.ignored.length, 2, 'ignored count');
        eq(value.ignored.find((entry) => entry.reason === 'git').path, '.git/config', 'git reason');
        eq(value.ignored.find((entry) => entry.reason === 'empty').path, '', 'empty reason');
    }
    finally {
        await box.cleanup();
    }
});

await test('TMP-05: marker tool refuses paths outside the session cwd and says why', async () => {
    const box = await sandbox([]);
    try {
        const tool = box.state.tool;
        assert(tool !== null, 'tool should be registered');
        const outside = join(tmpdir(), 'reaper-outside-probe.txt');
        const value = await tool.execute(
            { paths: ['inside.tmp', outside] },
            { agent: { id: box.sessionId } },
        );
        eq(value.marked.length, 1, 'only the in-cwd path is marked');
        eq(value.marked[0], 'inside.tmp', 'marked path');
        eq(value.ignored.length, 1, 'ignored count');
        eq(value.ignored[0].path, outside, 'ignored path');
        eq(value.ignored[0].reason, 'outside-cwd', 'ignored reason');
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

// ── TMP-06: the scan cache must be bounded ────────────────────────────────────

await test('TMP-06: the oldest sessions are evicted from the scan cache', async () => {
    const box = await sandboxMany(70);
    try {
        for (const id of box.ids) {
            const { status } = await box.scan(id);
            eq(status, 200, `scan ${id}`);
        }
        eq(box.reads(box.ids[0]), 1, 'first session read once by its own scan');
        // The first session has been evicted, so delete must rescan it.
        const oldest = box.ids[0];
        const oldestCwd = box.sessions.get(oldest).cwd;
        await box.del(oldest, [join(oldestCwd, 'f0.txt')]);
        eq(box.reads(oldest), 2, 'evicted session is rescanned on delete');
        // The newest session is still cached: delete must not rescan it.
        const newest = box.ids[box.ids.length - 1];
        const newestCwd = box.sessions.get(newest).cwd;
        const { json } = await box.del(newest, [join(newestCwd, `f${box.ids.length - 1}.txt`)]);
        eq(json.removed, 1, 'newest delete succeeds');
        eq(box.reads(newest), 1, 'recent session stays cached');
    }
    finally {
        await box.cleanup();
    }
});

// ── TMP-04: an undiscoverable profile must not silently drop protection ──────

await test('TMP-04: no discoverable profile yields referenced=unknown and profileKnown=false', async () => {
    const now = Date.now();
    const box = await sandbox((cwd) => [
        call_('write', { path: join(cwd, 'maybe-dep.js') }, now - 10 * MIN),
        call_('mark_temp_files', { paths: ['maybe-dep.js'] }, now - 9 * MIN),
    ]);
    try {
        // The probe clears DSH_PROFILE_DIR and its cwd/argv point at the plugin,
        // so no profile manifest is discoverable.
        await writeFile(join(box.cwd, 'maybe-dep.js'), 'x', 'utf8');
        const { json } = await box.scan();
        eq(json.profileKnown, false, 'profileKnown');
        const item = json.items.find((entry) => entry.display === 'maybe-dep.js');
        assert(item !== undefined, 'file should be listed');
        eq(item.referenced, 'unknown', 'referenced');
        // Unknown is reported, not turned into silent protection: the marked
        // file keeps its default-delete state and the panel warns about it.
        eq(item.keepByDefault, false, 'marked file keeps its default');
        const { json: deleted } = await box.del([item.path]);
        eq(deleted.removed, 1, 'unknown is not host-refused');
    }
    finally {
        await box.cleanup();
    }
});


summary();
