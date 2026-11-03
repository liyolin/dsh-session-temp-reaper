# dsh-session-temp-reaper

English | [中文](README.md)

A button for the DSH (DeepSeek Harness) chat UI that **cleans up the temporary files this session produced** in one pass.

The button sits to the left of the composer. Clicking it scans what the session wrote, what its commands created, and what landed in temp directories, then shows a tickable list. **Ticked means delete**; everything unticked is kept. Deletion needs a second click, and the panel reports what happened.

## Why it does not just guess from timestamps

That was the first version. It swept in other sessions' deliverables and plugin sources, then handed the model enough rope to answer "these are safe to delete" — the kind of mistake that actually destroys work.

Now the **model registers its own scratch files**:

- The plugin ships a tool, `mark_temp_files`, that the model calls for temp scripts, debug output, and one-off intermediates
- A `## Temporary files` system-prompt section reminds the model to do it
- The panel has two groups: **marked** (ticked by default) and **unmarked** (collapsed, kept by default, context only)

The heuristics were not deleted; they now only feed the unmarked group and no longer decide what starts ticked.

## Features

- Composer button plus an overlay panel; Esc or a click outside closes it
- Two groups: marked files start ticked, unmarked files are collapsed and unticked
- Rows show type, source badge (session write / from command / unconfirmed / system temp / temp dir), size and age
- Deliverables (`present` output, deliverable records) and files inside a plugin or dependency the profile is using stay **unticked even when marked**
- `Ask model` button drops the current list into the composer and submits it, asking what each file is for and which are safe to delete — it only asks, it never deletes
- `Keep all` / `Delete all` bulk toggles; delete needs two clicks and disarms after 5 seconds
- Chinese and English, following the DSH locale setting

## Install

### Local link (development)

```bash
# profile lives at ~/.dsh/profiles/desktop
cd ~/.dsh/profiles/desktop
npm install --save "link:<absolute path to this repo>"
```

Then add `"dsh-session-temp-reaper"` to the `dsh.profile.bundles` array in the same `package.json` and restart DSH.

### From GitHub

```bash
cd ~/.dsh/profiles/desktop
npm install --save "github:Kaalia0912/dsh-session-temp-reaper"
```

Add the package name to `dsh.profile.bundles` as well.

After changing Host code (`index.js`) the module must be reloaded — toggle the plugin off and on in the GUI (`plugin_manager` `set_plugin`) or restart DSH. Changing only `client.js` needs a page refresh.

## Usage

1. Click the cleanup button left of the composer to scan
2. Check the marked group: the files meant to go are already ticked; untick anything you want to keep
3. Open "N unmarked files" if you are unsure whether something is missing, and tick it manually
4. Click `Delete N` and click once more to confirm
5. The panel reports `Deleted X, failed Y`

## The model-facing tool

```js
mark_temp_files({
  paths: ["scripts/probe.mjs", "out/report.tmp"],  // relative to cwd, or absolute
  note: "throwaway debug script"                    // optional, shown in the panel
})
```

Returns `Marked N temporary file(s).` Marks exist only as a `tool/call` entry in the session log, so they travel with the session and need no extra state file. Re-marking a path in the same session is idempotent.

**Do not mark** deliverables the user asked for, or existing source files that were edited. The `present` and dependency-root protections would catch those anyway, but that is a backstop, not the intent.

## HTTP routes

Two same-origin POST routes connect the client button to the host:

| Route | Body | Response |
| --- | --- | --- |
| `/session-temp-reaper/scan` | `{ sessionId }` | `{ cwd, items[] }` |
| `/session-temp-reaper/delete` | `{ sessionId, paths[] }` | `{ results[], removed }` |

Scan results are cached in host memory for 10 minutes. Delete accepts only paths that appeared in that session's latest scan; anything else is rejected per path.

## Safety boundaries

- **Only scanned paths**: `paths` must come from this session's scan, or each entry fails
- **Root allowlist**: a file must live in the session cwd, this session's spill directory, or be a file a command explicitly wrote under the OS temp root; only this session's own spill directory can be removed wholesale
- **Deliverable protection**: files in `present` calls or deliverable records always start unticked
- **Dependency protection**: files inside a directory resolved from a profile dependency (for example a plugin linked with `link:`) start unticked
- **`.git` never appears**: any path with a `.git` segment is skipped, never listed, never deleted
- **Two clicks**: no delete request is sent before the second click
- **Never automatic**: the plugin deletes nothing on its own

## Scan sources (the unmarked group)

| Source | Meaning |
| --- | --- |
| `session` | Files the model wrote with `write` / `edit` |
| `command` | Paths a command named explicitly (redirects, `Set-Content`, ...) |
| `scan` | Created within 15 minutes after one of this session's shell commands, or appeared in the workspace root after the session started — attribution unconfirmed |
| `external` | Files a command wrote under the OS temp root |
| `spill` | This session's `dsh-spill-*` directory, listed as one entry |

The event window covers the last 72 hours of the session log; the workspace walk is capped at 1500 files, 20000 entries and depth 12, skipping `node_modules`, `dist`, `.git` and friends.

## Known limits

- If the model never calls `mark_temp_files`, the marked group is empty — only the unmarked group remains, and nothing is deleted by default
- When concurrent sessions write into the same workspace, `scan`-sourced entries are guessed from a time window and carry an "unconfirmed" badge
- Packages referenced only in `cordis.patch.yml` (not in profile `dependencies`) are not recognised as "in use"
- Deletion is permanent; there is no trash

## Layout

```
index.js            host side: scan, delete, mark_temp_files tool, prompt section
client.js           browser side: button, panel, i18n
cordis.patch.yml    patch that inserts this bundle into a profile
locale/             plugin metadata, zh and en
icon.svg            icon
```

## License

MIT
