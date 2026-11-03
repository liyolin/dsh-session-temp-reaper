window.__ModuleLoader__.load({
  id: 'dsh-session-temp-reaper',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    // ── styles ──────────────────────────────────────────────────────────────
    // Only theme aliases: the panel must follow light/dark without its own
    // palette. Class prefix keeps copied control styling from colliding with
    // host classes or another plugin's.
    const CSS = [
      '.str-trigger{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:8px;cursor:pointer;color:var(--dsw-alias-label-secondary);background:transparent;border:none;line-height:1;outline:none;transition:background .12s,color .12s}',
      '.str-trigger:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.str-trigger.active{color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent)}',
      // The wallpaper/glass theme rewrites --dsw-alias-bg-layer-1 into a
      // translucent glass mix (readability floor ~0.7 alpha). One copy of it
      // lets chat text behind the panel show through and the list becomes
      // unreadable, so the same token is stacked as background layers: alpha
      // compounds per layer, the color stays the theme's, and an opaque theme
      // renders exactly as before.
      '.str-panel{position:absolute;bottom:calc(100% + 8px);left:0;box-sizing:border-box;width:min(560px,92vw);max-height:min(64vh,calc(100vh - 32px));z-index:30;display:flex;flex-direction:column;overflow:hidden;background-color:var(--dsw-alias-bg-layer-1);background-image:linear-gradient(var(--dsw-alias-bg-layer-1),var(--dsw-alias-bg-layer-1)),linear-gradient(var(--dsw-alias-bg-layer-1),var(--dsw-alias-bg-layer-1)),linear-gradient(var(--dsw-alias-bg-layer-1),var(--dsw-alias-bg-layer-1));-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,.42);color:var(--dsw-alias-label-primary);font-size:12px}',
      '.str-head{display:flex;align-items:center;gap:8px;padding:10px 12px 6px}',
      '.str-title{flex:1 1 auto;min-width:0;font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.str-sub{padding:0 12px 8px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5}',
      '.str-head .str-btn{flex:none;font-size:11px;padding:3px 9px}',
      '.str-btn.ask{color:var(--dsw-alias-brand-primary);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 45%,transparent)}',
      '.str-close{flex:none;width:22px;height:22px;border-radius:6px;border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:14px;line-height:1}',
      '.str-close:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.str-list{overflow-y:auto;padding:0 8px 8px;display:flex;flex-direction:column;gap:2px;min-height:0}',
      '.str-row{display:flex;align-items:flex-start;gap:8px;padding:6px;border-radius:8px}',
      '.str-row:hover{background:var(--dsw-alias-bg-layer-2)}',
      // Ticked means "delete", so the row says so: a destructive tint plus a
      // left accent, not just a checkbox the user has to interpret.
      '.str-row.dropping{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 13%,transparent);box-shadow:inset 2px 0 0 var(--dsw-alias-state-error-primary)}',
      '.str-row.dropping:hover{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 20%,transparent)}',
      '.str-row.dropping .str-name{text-decoration:line-through;text-decoration-thickness:1px}',
      ".str-check{flex:none;width:13px;height:13px;margin:2px 0 0;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}",
      '.str-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:1px}',
      '.str-line1{display:flex;align-items:center;gap:6px;min-width:0}',
      '.str-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}',
      '.str-preview{color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;opacity:.85}',
      '.str-meta{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.str-size{flex:none;color:var(--dsw-alias-label-secondary);font-size:11px;font-variant-numeric:tabular-nums}',
      '.str-badge{flex:none;font-size:10px;padding:1px 6px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);white-space:nowrap}',
      '.str-badge.spill{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary)}',
      '.str-badge.command{color:var(--dsw-alias-brand-primary);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 45%,transparent)}',
      '.str-badge.scan{color:var(--dsw-alias-label-tertiary);border-style:dashed}',
      '.str-badge.keep{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 55%,transparent)}',
      '.str-badge.delivered{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}',
      '.str-badge.external{color:var(--dsw-alias-state-warn-primary);border-style:dashed;border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 55%,transparent)}',
      '.str-hint{padding:0 12px 8px;color:var(--dsw-alias-state-warn-primary);font-size:11px}',
      '.str-badge.marked{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}',
      '.str-group-toggle{margin:2px 8px 6px;padding:4px 6px;text-align:left;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:11px;cursor:pointer}',
      '.str-group-toggle:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.str-empty{padding:18px 12px;text-align:center;color:var(--dsw-alias-label-secondary)}',
      '.str-foot{display:flex;align-items:center;gap:6px;padding:10px 12px;border-top:1px solid var(--dsw-alias-border-l1)}',
      '.str-spacer{flex:1 1 auto}',
      '.str-btn{padding:4px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);font-size:11px;cursor:pointer;white-space:nowrap}',
      '.str-btn:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}',
      '.str-btn:disabled{opacity:.5;cursor:default}',
      '.str-btn.danger{color:#fff;background:var(--dsw-alias-state-error-primary);border-color:transparent}',
      '.str-btn.danger.armed{box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-error-primary) 35%,transparent)}',
      '.str-result{padding:2px 6px;font-size:11px}',
      '.str-result.ok{color:var(--dsw-alias-state-success-primary)}',
      '.str-result.fail{color:var(--dsw-alias-state-error-primary)}',
    ].join('');

    // ── text ────────────────────────────────────────────────────────────────
    const DICTS = {
      zh: {
        'button.title': '清理临时文件',
        'panel.title': '清理本次会话的临时文件',
        'panel.sub': '模型标记的临时文件默认勾上（勾=删除）。未标记的文件收在下面，默认保留，只作参考。',
        'panel.loading': '正在扫描…',
        'panel.empty': '没有发现本会话产生的文件',
        'panel.noSelection': '现在一个都没勾，等于全部保留',
        'panel.hint': '勾选=删除，不可恢复。默认只勾模型用 mark_temp_files 标记的文件和本会话的临时输出目录；其余文件默认不勾（保留），交付物和正在使用的插件依赖即使被标记也不勾。',
        'badge.session': '会话写入',
        'badge.command': '指令写入',
        'badge.scan': '未确认归属',
        'badge.external': '系统临时',
        'badge.spill': '临时目录',
        'keepAll': '全部保留（清空勾选）',
        'deleteAll': '全部删除（全勾）',
        'action.cancel': '取消',
        'badge.referenced': '正在使用',
        'row.referencedHint': '属于正在使用的插件或依赖，删除会把插件弄坏',
        'badge.delivered': '已交付',
        'ask.delivered': '本会话已交付给用户',
        'ask.inUse': '正在被 profile 使用',
        'ask.unattributed': '归属未确认（只按时间窗口推定为本会话产物）',
        'badge.marked': '临时',
        'panel.noMarked': '本会话还没有标记任何临时文件（模型用 mark_temp_files 登记）',
        'panel.unmarkedGroup': '未标记的文件 {n} 个 · 默认保留',
        'ask.groupMarked': '临时文件（模型已标记）',
        'ask.groupUnmarked': '未标记',
        'ask.button': '问模型',
        'ask.hint': '把这份清单发给模型，让它说明每个文件是干什么的、哪些能删',
        'ask.sep': '，',
        'ask.willDelete': '准备删除',
        'ask.willKeep': '准备保留',
        'ask.prompt': '本次会话产生了下面这些文件，帮我判断每个文件是做什么用的、哪些可以安全删除：\n{list}\n先只给判断和理由，不要执行任何删除操作。',
        'ask.unavailable': '输入框当前不可用，无法发送提问',
        'ask.failed': '发送提问失败，请重试',
        'action.close': '关闭',
        'action.delete': '删除 {n} 个',
        'action.confirm': '再点一次确认删除 {n} 个',
        'error.scan': '扫描失败，请重试',
        'error.delete': '删除失败，请重试',
        'done.title': '清理结果',
        'done.summary': '已删除 {removed} 个，失败 {failed} 个',
        'done.none': '没有删除任何文件',
        'file.dir': '目录',
        'type.config': '配置文件',
        'type.script': '脚本',
        'type.style': '样式表',
        'type.markup': '页面模板',
        'type.doc': '文档',
        'type.sheet': '表格',
        'type.slide': '演示文稿',
        'type.image': '图片',
        'type.audio': '音频',
        'type.video': '视频',
        'type.archive': '压缩包',
        'type.log': '日志',
        'type.data': '数据文件',
        'type.text': '纯文本',
        'type.dir': '临时目录',
        'type.other': '文件',
        'file.binary': '二进制文件（无预览）',
        'meta.origin': '来自 {origin}',
        'meta.dirHint': '会话临时输出目录，整目录删除',
        'time.now': '刚刚',
        'time.minutes': '{n} 分钟前',
        'time.hours': '{n} 小时前',
        'time.days': '{n} 天前',
      },
      en: {
        'button.title': 'Clean temp files',
        'panel.title': 'Clean this session\'s temp files',
        'panel.sub': 'Files the model marked as temporary are ticked (ticked = delete). Unmarked files sit in the group below, kept by default and shown for context.',
        'panel.loading': 'Scanning…',
        'panel.empty': 'This session generated no files',
        'panel.noSelection': 'Nothing is ticked, so everything stays',
        'panel.hint': 'Ticked means delete, and deletion cannot be undone. By default only files the model marked with mark_temp_files and this session\'s spill directory start ticked; everything else stays unticked (kept), and deliverables or plugin dependencies in use stay unticked even when marked.',
        'badge.session': 'session write',
        'badge.command': 'from command',
        'badge.scan': 'unconfirmed',
        'badge.external': 'system temp',
        'badge.spill': 'temp dir',
        'keepAll': 'Keep all (clear ticks)',
        'deleteAll': 'Delete all (tick all)',
        'action.cancel': 'Cancel',
        'badge.referenced': 'in use',
        'row.referencedHint': 'Belongs to a plugin or dependency this profile uses; deleting it breaks it',
        'badge.delivered': 'delivered',
        'ask.delivered': 'already delivered to the user by this session',
        'ask.inUse': 'in use by the profile',
        'ask.unattributed': 'attribution unconfirmed (inferred from a time window only)',
        'badge.marked': 'temp',
        'panel.noMarked': 'No temporary files marked yet (the model registers them with mark_temp_files)',
        'panel.unmarkedGroup': '{n} unmarked file(s) · kept by default',
        'ask.groupMarked': 'temporary (marked by the model)',
        'ask.groupUnmarked': 'unmarked',
        'ask.button': 'Ask model',
        'ask.hint': 'Send this list to the model: what each file is for, and which are safe to delete',
        'ask.sep': ' · ',
        'ask.willDelete': 'marked to delete',
        'ask.willKeep': 'marked to keep',
        'ask.prompt': 'This session produced the files below. Tell me what each one is for and which are safe to delete:\n{list}\nGive the assessment and reasons only; do not delete anything yet.',
        'ask.unavailable': 'The composer is unavailable, cannot send the question',
        'ask.failed': 'Sending the question failed, try again',
        'action.close': 'Close',
        'action.delete': 'Delete {n}',
        'action.confirm': 'Click again to delete {n}',
        'error.scan': 'Scan failed, try again',
        'error.delete': 'Delete failed, try again',
        'done.title': 'Result',
        'done.summary': 'Deleted {removed}, failed {failed}',
        'done.none': 'Nothing was deleted',
        'file.dir': 'dir',
        'type.config': 'config file',
        'type.script': 'script',
        'type.style': 'stylesheet',
        'type.markup': 'page template',
        'type.doc': 'document',
        'type.sheet': 'spreadsheet',
        'type.slide': 'slide deck',
        'type.image': 'image',
        'type.audio': 'audio',
        'type.video': 'video',
        'type.archive': 'archive',
        'type.log': 'log',
        'type.data': 'data file',
        'type.text': 'text',
        'type.dir': 'temp directory',
        'type.other': 'file',
        'file.binary': 'binary file (no preview)',
        'meta.origin': 'from {origin}',
        'meta.dirHint': 'session spill directory, removed as a whole',
        'time.now': 'just now',
        'time.minutes': '{n}m ago',
        'time.hours': '{n}h ago',
        'time.days': '{n}d ago',
      },
    };

    let ctxRef = null;

    function liveLocale() {
      try {
        if (ctxRef !== null && typeof ctxRef.get === 'function') return ctxRef.get('locale') || null;
      }
      catch (error) { /* absent locale row */ }
      return null;
    }

    function tr(key, params) {
      let id = 'zh';
      try {
        const locale = liveLocale();
        if (locale !== null && typeof locale.getLocale === 'function') {
          const snapshot = locale.getLocale();
          if (snapshot !== null && snapshot !== undefined && snapshot.active === 'en') id = 'en';
        }
      }
      catch (error) { /* fall back to Chinese */ }
      const dict = DICTS[id] || DICTS.zh;
      let text = dict[key];
      if (typeof text !== 'string') text = DICTS.zh[key];
      if (typeof text !== 'string') text = key;
      if (params !== null && params !== undefined) {
        text = text.replace(/\{(\w+)\}/g, (all, name) => {
          const value = params[name];
          return value === undefined || value === null ? '' : String(value);
        });
      }
      return text;
    }

    function formatBytes(bytes) {
      if (typeof bytes !== 'number' || !isFinite(bytes) || bytes <= 0) return '';
      const units = ['B', 'KB', 'MB', 'GB'];
      let value = bytes;
      let unit = 0;
      while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
      }
      return (unit === 0 ? String(value) : value.toFixed(value >= 10 ? 0 : 1)) + ' ' + units[unit];
    }

    /** "3 分钟前" — creation time is the fastest way to recognize a file. */
    function relativeTime(timestamp) {
      if (typeof timestamp !== 'number' || !isFinite(timestamp) || timestamp <= 0) return '';
      const minutes = Math.round((Date.now() - timestamp) / 60000);
      if (minutes < 1) return tr('time.now');
      if (minutes < 60) return tr('time.minutes', { n: minutes });
      const hours = Math.round(minutes / 60);
      if (hours < 24) return tr('time.hours', { n: hours });
      const days = Math.round(hours / 24);
      if (days < 30) return tr('time.days', { n: days });
      try {
        return new Date(timestamp).toLocaleDateString();
      }
      catch (error) {
        return '';
      }
    }
    // ── state ───────────────────────────────────────────────────────────────
    // One module-level store: the trigger button and the panel are separate
    // slot entries, so they cannot share React state.
    const CLOSED = {
      open: false,
      sessionId: null,
      phase: 'idle',
      items: [],
      // Ticked = delete. `drop` holds the paths that will be removed; anything
      // not in it is kept.
      drop: {},
      busy: false,
      armed: false,
      error: null,
      results: null,
      removed: 0,
      // The unmarked group starts collapsed: it is context, not candidates.
      showUnmarked: false,
    };

    function createStore(initial) {
      let state = initial;
      const listeners = new Set();
      return {
        get() { return state; },
        set(patch) {
          state = typeof patch === 'function' ? patch(state) : Object.assign({}, state, patch);
          for (const listener of Array.from(listeners)) listener();
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => { listeners.delete(listener); };
        },
      };
    }

    const store = createStore(CLOSED);

    /**
     * Read the panel surface from the theme and force it opaque.
     *
     * The wallpaper/glass theme rewrites --dsw-alias-bg-layer-1 into a glass mix
     * whose alpha can sit near 0.7, so chat text behind the panel reads through
     * it. Stacking the token as background layers is not dependable either — a
     * theme value a gradient cannot use leaves only the single translucent
     * paint. So measure the token once and hand back the same hue at full alpha;
     * an opaque theme returns null and the stylesheet is used unchanged.
     */
    let panelSurface = null;
    function resolvePanelSurface() {
      if (panelSurface !== null) return panelSurface;
      if (typeof document === 'undefined' || document.body === null) return null;
      let probe = null;
      try {
        probe = document.createElement('div');
        probe.setAttribute('aria-hidden', 'true');
        probe.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;'
          + 'pointer-events:none;background-color:var(--dsw-alias-bg-layer-1)';
        document.body.appendChild(probe);
        const computed = getComputedStyle(probe).backgroundColor.trim();
        const channels = colorChannels(computed);
        if (channels === null) {
          // A color format this reader does not understand: prefer a readable
          // surface over a transparent one.
          panelSurface = 'Canvas';
          return panelSurface;
        }
        if (channels.alpha >= 0.985) return null; // already opaque
        panelSurface = `rgb(${channels.r} ${channels.g} ${channels.b})`;
        return panelSurface;
      }
      catch (error) {
        return null;
      }
      finally {
        if (probe !== null && probe.parentElement !== null) probe.parentElement.removeChild(probe);
      }
    }

    /**
     * `rgb(r g b / a)`, `rgba(r, g, b, a)`, `color(srgb r g b / a)` and
     * `color(srgb r g b)` → integer channels plus alpha. Percentages are
     * accepted; `color()` channels are 0..1.
     */
    function colorChannels(value) {
      const numbers = value.match(/-?[\d.]+%?/g);
      if (numbers === null || numbers.length < 3) return null;
      const isColorFunction = /^color\(/i.test(value);
      const scaled = (token) => {
        const percent = token.endsWith('%');
        const number = Number.parseFloat(token);
        if (!isFinite(number)) return null;
        if (percent) return Math.round(number * 2.55);
        // `color(srgb ...)` channels are 0..1; rgb()/rgba() channels are 0..255.
        return isColorFunction ? Math.round(number * 255) : Math.round(number);
      };
      const r = scaled(numbers[0]);
      const g = scaled(numbers[1]);
      const b = scaled(numbers[2]);
      if (r === null || g === null || b === null) return null;
      // `color()` never carries a percentage alpha here; rgb() may omit it.
      let alpha = 1;
      if (numbers[3] !== undefined) {
        const parsed = Number.parseFloat(numbers[3]);
        if (isFinite(parsed)) alpha = numbers[3].endsWith('%') ? parsed / 100 : parsed;
      }
      return { r, g, b, alpha };
    }

    function installStyles() {
      if (typeof document === 'undefined') return function () {};
      const tagId = 'dsh-session-temp-reaper/panel.css';
      const existing = document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']');
      if (existing !== null) return function () {};
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-session-temp-reaper';
      tag.dataset.pluginCss = tagId;
      tag.textContent = CSS;
      document.head.appendChild(tag);
      return function () { tag.remove(); };
    }

    async function post(path, payload) {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null);
      return { status: response.status, body };
    }

    async function scanSession(sessionId) {
      store.set({ phase: 'loading', error: null, results: null, armed: false, items: [], drop: {} });
      try {
        const { status, body } = await post('/session-temp-reaper/scan', { sessionId });
        if (status !== 200 || body === null || body.ok !== true) {
          store.set({ phase: 'error', error: tr('error.scan') });
          return;
        }
        const items = Array.isArray(body.items) ? body.items : [];
        // The host still answers "which of these does the default policy
        // propose keeping"; the checkbox is the opposite, so it starts unticked
        // for exactly those files.
        const drop = {};
        for (const item of items) drop[item.path] = item.keepByDefault !== true;
        store.set({ phase: 'ready', items, drop });
      }
      catch (error) {
        store.set({ phase: 'error', error: tr('error.scan') });
      }
    }

    function openPanel(sessionId) {
      if (typeof sessionId !== 'string' || sessionId === '') return;
      store.set(Object.assign({}, CLOSED, { open: true, sessionId }));
      void scanSession(sessionId);
    }

    function closePanel() {
      store.set(CLOSED);
    }

    function dropPaths(state) {
      return state.items.filter((item) => state.drop[item.path] === true).map((item) => item.path);
    }

    /**
     * Hand the question to the model through the composer the user already has:
     * `inputActions.setDraft()` + `submit()` is the same path the send button
     * takes, so the message shows up in the conversation as a normal user turn
     * and the answer is logged like any other.
     */
    function askModel(state, inputActions) {
      if (state === null || state.items.length === 0) return;
      if (!inputActions || typeof inputActions.setDraft !== 'function'
        || typeof inputActions.submit !== 'function') {
        store.set({ error: tr('ask.unavailable') });
        return;
      }
      const lines = state.items.map((item) => {
        const parts = [
          item.display || item.path,
          tr('type.' + (item.type || 'other')),
          state.drop[item.path] === true ? tr('ask.willDelete') : tr('ask.willKeep'),
        ];
        parts.push(item.marked === true ? tr('ask.groupMarked') : tr('ask.groupUnmarked'));
        if (item.origin) parts.push(tr('meta.origin', { origin: item.origin }));
        if (item.referenced === true) parts.push(tr('ask.inUse'));
        if (item.delivered === true) parts.push(tr('ask.delivered'));
        if (item.unattributed === true) parts.push(tr('ask.unattributed'));
        return '- ' + parts.join(tr('ask.sep'));
      });
      const text = tr('ask.prompt', { list: lines.join('\n') });
      try {
        inputActions.setDraft(text);
        // The draft lands in the composer store on the next tick; submitting in
        // the same tick would send the previous (empty) draft.
        setTimeout(() => {
          try {
            inputActions.submit();
          }
          catch (error) {
            store.set({ error: tr('ask.failed') });
          }
        }, 0);
        closePanel();
      }
      catch (error) {
        store.set({ error: tr('ask.failed') });
      }
    }

    async function removeSelected() {
      const state = store.get();
      if (state.busy) return;
      const paths = dropPaths(state);
      if (paths.length === 0) return;
      if (state.armed !== true) {
        store.set({ armed: true });
        return;
      }
      store.set({ busy: true, error: null });
      try {
        const { status, body } = await post('/session-temp-reaper/delete', {
          sessionId: state.sessionId,
          paths,
        });
        if (status !== 200 || body === null || body.ok !== true) {
          store.set({ busy: false, error: tr('error.delete') });
          return;
        }
        store.set({
          busy: false,
          phase: 'done',
          results: Array.isArray(body.results) ? body.results : [],
          removed: typeof body.removed === 'number' ? body.removed : 0,
          armed: false,
        });
      }
      catch (error) {
        store.set({ busy: false, error: tr('error.delete') });
      }
    }

    // ── components ──────────────────────────────────────────────────────────
    function BroomIcon() {
      return h('svg', { viewBox: '0 0 24 24', width: 20, height: 20, 'aria-hidden': true, style: { display: 'block' } },
        h('path', { d: 'M9 3h6l1 2h3.5v2H4.5V5H8l1-2z', fill: 'currentColor' }),
        h('path', {
          d: 'M6 9h12l-1.1 10.2A2 2 0 0 1 14.9 21H9.1a2 2 0 0 1-2-1.8L6 9zm3 2.5v7h1.4v-7H9zm3.6 0v7H14v-7h-1.4z',
          fill: 'currentColor',
        }));
    }

    function TriggerButton(props) {
      const state = React.useSyncExternalStore(store.subscribe, store.get);
      const sessionId = props && props.sessionId;
      return h('button', {
        type: 'button',
        className: state.open ? 'str-trigger active' : 'str-trigger',
        title: tr('button.title'),
        'aria-label': tr('button.title'),
        'aria-expanded': state.open === true,
        onClick: (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (state.open) closePanel();
          else openPanel(sessionId);
        },
      }, h(BroomIcon));
    }

    function ResultList(props) {
      const failed = props.results.filter((entry) => entry.ok !== true);
      return h('div', null,
        h('div', { className: 'str-sub' }, tr('done.summary', { removed: props.removed, failed: failed.length })),
        h('div', { className: 'str-list' }, failed.map((entry) => h('div', {
          key: entry.path,
          className: 'str-result fail',
        }, entry.path, entry.error ? ' — ' + entry.error : ' — ' + String(entry.code ?? '')))));
    }

    // Source → badge. A source the Host grows later falls back to the neutral
    // "session write" badge instead of rendering an empty chip.
    const BADGES = {
      session: { text: 'badge.session', className: 'str-badge' },
      command: { text: 'badge.command', className: 'str-badge command' },
      scan: { text: 'badge.scan', className: 'str-badge scan' },
      external: { text: 'badge.external', className: 'str-badge external' },
      spill: { text: 'badge.spill', className: 'str-badge spill' },
      marked: { text: 'badge.marked', className: 'str-badge marked' },
    };

    function FileList(props) {
      const state = props.state;
      const items = props.items || state.items;
      return h('div', { className: 'str-list' }, items.map((item) => {
        const dropped = state.drop[item.path] === true;
        const badge = BADGES[item.source] || BADGES.session;
        const age = relativeTime(item.createdAt);
        const metaParts = [];
        const typeLabel = tr('type.' + (item.type || 'other'));
        if (typeof typeLabel === 'string' && typeLabel.indexOf('type.') !== 0) metaParts.push(typeLabel);
        if (item.origin) metaParts.push(tr('meta.origin', { origin: item.origin }));
        if (age) metaParts.push(age);
        // No content preview: the type plus the origin line is what the user
        // asked for, and the "ask the model" button covers "what is this file".
        const previewText = item.kind === 'dir' ? tr('meta.dirHint') : '';
        const referenced = item.referenced === true;
        return h('label', {
          key: item.path,
          className: dropped ? 'str-row dropping' : 'str-row',
          title: referenced ? item.path + '\n' + tr('row.referencedHint') : item.path,
        },
          h('input', {
            type: 'checkbox',
            className: 'str-check',
            checked: dropped,
            title: referenced ? tr('row.referencedHint') : undefined,
            onChange: () => {
              const drop = Object.assign({}, store.get().drop);
              drop[item.path] = !dropped;
              store.set({ drop, armed: false });
            },
          }),
          h('span', { className: 'str-main' },
            h('span', { className: 'str-line1' },
              h('span', { className: 'str-name' }, item.display || item.path),
              item.kind === 'dir'
                ? h('span', { className: 'str-size' }, tr('file.dir'))
                : h('span', { className: 'str-size' }, formatBytes(item.size)),
              item.delivered === true ? h('span', { className: 'str-badge delivered' }, tr('badge.delivered')) : null,
              referenced ? h('span', { className: 'str-badge keep' }, tr('badge.referenced')) : null,
              h('span', { className: badge.className }, tr(badge.text))),
            previewText ? h('span', { className: 'str-preview' }, previewText) : null,
            metaParts.length > 0 ? h('span', { className: 'str-meta' }, metaParts.join(' · ')) : null));
      }));
    }

    function Panel(props) {
      const state = React.useSyncExternalStore(store.subscribe, store.get);
      const sessionId = props && props.sessionId;

      // Another session in the same window: the scan belongs to the old one.
      React.useEffect(() => {
        if (state.open && state.sessionId !== null && sessionId !== undefined && sessionId !== state.sessionId) {
          closePanel();
        }
      }, [sessionId, state.open, state.sessionId]);

      React.useEffect(() => {
        if (!state.open) return undefined;
        function onKey(event) {
          if (event.key === 'Escape' && !store.get().busy) closePanel();
        }
        function onPointerDown(event) {
          const target = event.target;
          if (target && target.closest && (target.closest('.str-panel') || target.closest('.str-trigger'))) return;
          if (!store.get().busy) closePanel();
        }
        document.addEventListener('keydown', onKey);
        document.addEventListener('pointerdown', onPointerDown, true);
        return () => {
          document.removeEventListener('keydown', onKey);
          document.removeEventListener('pointerdown', onPointerDown, true);
        };
      }, [state.open]);

      // Arm/disarm: any change in the selection needs a fresh confirmation.
      React.useEffect(() => {
        if (!state.open || state.armed !== true) return undefined;
        const timer = setTimeout(() => store.set({ armed: false }), 5000);
        return () => clearTimeout(timer);
      }, [state.open, state.armed]);

      if (!state.open) return null;

      const deleting = dropPaths(state);
      const markedItems = state.items.filter((item) => item.marked === true);
      const unmarkedItems = state.items.filter((item) => item.marked !== true);
      const body = [];
      if (state.phase === 'loading') {
        body.push(h('div', { key: 'loading', className: 'str-empty' }, tr('panel.loading')));
      }
      else if (state.phase === 'error') {
        body.push(h('div', { key: 'error', className: 'str-empty' }, state.error || tr('error.scan')));
      }
      else if (state.phase === 'done') {
        body.push(h(ResultList, { key: 'done', results: state.results || [], removed: state.removed }));
      }
      else if (state.items.length === 0) {
        body.push(h('div', { key: 'empty', className: 'str-empty' }, tr('panel.empty')));
      }
      else {
        if (markedItems.length === 0) {
          body.push(h('div', { key: 'nomark', className: 'str-empty' }, tr('panel.noMarked')));
        }
        else {
          body.push(h(FileList, { key: 'marked', state, items: markedItems }));
        }
        if (unmarkedItems.length > 0) {
          body.push(h('button', {
            key: 'toggle',
            type: 'button',
            className: 'str-group-toggle',
            'aria-expanded': state.showUnmarked === true,
            onClick: () => store.set({ showUnmarked: !store.get().showUnmarked }),
          }, (state.showUnmarked === true ? '▾ ' : '▸ ') + tr('panel.unmarkedGroup', { n: unmarkedItems.length })));
          if (state.showUnmarked === true) {
            body.push(h(FileList, { key: 'unmarked', state, items: unmarkedItems }));
          }
        }
        if (deleting.length === 0) {
          body.push(h('div', { key: 'none', className: 'str-hint' }, tr('panel.noSelection')));
        }
      }

      const footer = [];
      if (state.phase === 'ready' && state.items.length > 0) {
        footer.push(
          h('button', {
            key: 'keepAll',
            type: 'button',
            className: 'str-btn',
            onClick: () => {
              // "Keep all" = tick nothing.
              const drop = {};
              for (const item of store.get().items) drop[item.path] = false;
              store.set({ drop, armed: false });
            },
          }, tr('keepAll')),
          h('button', {
            key: 'deleteAll',
            type: 'button',
            className: 'str-btn',
            onClick: () => {
              const drop = {};
              for (const item of store.get().items) drop[item.path] = true;
              store.set({ drop, armed: false });
            },
          }, tr('deleteAll')));
      }
      footer.push(h('span', { key: 'spacer', className: 'str-spacer' }));
      if (state.phase === 'done' || state.items.length === 0) {
        footer.push(h('button', {
          key: 'close',
          type: 'button',
          className: 'str-btn',
          onClick: closePanel,
        }, tr('action.close')));
      }
      else {
        footer.push(
          h('button', {
            key: 'cancel',
            type: 'button',
            className: 'str-btn',
            onClick: closePanel,
            disabled: state.busy === true,
          }, tr('action.cancel')),
          h('button', {
            key: 'delete',
            type: 'button',
            className: state.armed === true ? 'str-btn danger armed' : 'str-btn danger',
            disabled: state.busy === true || deleting.length === 0,
            onClick: () => { void removeSelected(); },
          }, state.armed === true
            ? tr('action.confirm', { n: deleting.length })
            : tr('action.delete', { n: deleting.length })));
      }

      // An opaque surface wins over the stylesheet when the theme's layer token
      // turned out to be translucent; an opaque theme leaves this null.
      const surface = resolvePanelSurface();
      return h('div', {
        className: 'str-panel',
        role: 'dialog',
        'aria-label': tr('panel.title'),
        style: surface === null ? undefined : { background: surface, backgroundImage: 'none' },
      },
        h('div', { className: 'str-head' },
          h('span', { className: 'str-title' }, tr('panel.title')),
          h('button', {
            type: 'button',
            className: 'str-btn ask',
            title: tr('ask.hint'),
            disabled: state.busy === true || state.phase !== 'ready' || state.items.length === 0,
            onClick: () => askModel(store.get(), props ? props.inputActions : undefined),
          }, tr('ask.button')),
          h('button', {
            type: 'button',
            className: 'str-close',
            title: tr('action.close'),
            'aria-label': tr('action.close'),
            onClick: closePanel,
          }, '×')),
        h('div', { className: 'str-sub' }, tr('panel.sub')),
        state.phase === 'ready' && state.items.length > 0
          ? h('div', { className: 'str-hint' }, tr('panel.hint'))
          : null,
        body,
        h('div', { className: 'str-foot' }, footer));
    }

    // Slot entries take a component; a fresh component per render would
    // remount the subtree, so these are hoisted and only the store changes.
    // Both entries forward the slot's `sessionId` prop: the scan is per
    // session, and the trigger cannot read it any other way.
    const TriggerEntry = (props) => h(TriggerButton, { sessionId: props ? props.sessionId : undefined });
    const PanelEntry = (props) => h(Panel, {
      sessionId: props ? props.sessionId : undefined,
      inputActions: props ? props.inputActions : undefined,
    });

    return {
      inject: ['slots'],
      apply(ctx) {
        ctxRef = ctx;
        ctx.effect(installStyles, 'session-temp-reaper: styles');
        const slots = ctx.slots;
        slots.inject('conversation.input.left', () => slots.register({
          name: 'conversation.input.left',
          id: 'session-temp-reaper',
          order: 40,
          label: () => tr('button.title'),
        }, TriggerEntry));
        slots.inject('conversation.input.overlay', () => slots.register({
          name: 'conversation.input.overlay',
          id: 'session-temp-reaper',
          order: 40,
        }, PanelEntry));
      },
    };
  },
});
