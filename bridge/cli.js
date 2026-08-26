/* WEFT CLI bridge — provider profiles.
   Same shape as Svemir's lib/cli_bridge.js, cut down to what WEFT needs:
   a provider is a command to find, a list of models, and an ORDERED list of
   invocation strategies. The first strategy that exits 0 with usable output
   wins; the rest exist because CLI flags drift between versions and a harness
   that dies on "unknown option" is useless in a print session. */
import { spawn, spawnSync } from 'child_process';
import os from 'os';
import path from 'path';

const WIN = process.platform === 'win32';
const npmBin = (n) => path.join(os.homedir(), 'AppData', 'Roaming', 'npm', n);

const PROFILES = {
  claude: {
    id: 'claude', label: 'Claude Code',
    commands: ['claude', 'claude.cmd', 'claude.exe', npmBin('claude.cmd')],
    versionArgs: ['--version'],
    models: [
      { id: 'auto',   label: 'Default' },
      { id: 'sonnet', label: 'Sonnet' },
      { id: 'opus',   label: 'Opus' },
      { id: 'haiku',  label: 'Haiku' },
      { id: 'fable',  label: 'Fable' }
    ],
    strategies(o) {
      const m = o.model && o.model !== 'auto' ? ['--model', o.model] : [];
      return [
        { name: 'claude-print', args: ['-p', '--output-format', 'text', ...m], stdin: true },
        { name: 'claude-plain', args: ['-p', ...m], stdin: true }
      ];
    }
  },
  codex: {
    id: 'codex', label: 'Codex CLI',
    commands: ['codex', 'codex.cmd', 'codex.exe', npmBin('codex.cmd')],
    versionArgs: ['--version'],
    models: [{ id: 'auto', label: 'Default' }, { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' }],
    strategies(o) {
      const m = o.model && o.model !== 'auto' ? ['--model', o.model] : [];
      /* read-only sandbox: this harness wants text back, it must never be able
         to touch the repo it is being asked to design for */
      return [
        { name: 'codex-exec-stdin', args: ['exec', ...m, '--sandbox', 'read-only', '--skip-git-repo-check', '-'], stdin: true },
        { name: 'codex-exec-arg',   args: ['exec', ...m, '--sandbox', 'read-only', '--skip-git-repo-check', o.prompt], stdin: false }
      ];
    }
  },
  antigravity: {
    id: 'antigravity', label: 'Antigravity (Gemini)',
    commands: ['antigravity', 'antigravity.cmd', 'antigravity.exe', npmBin('antigravity.cmd')],
    versionArgs: ['--version'],
    models: [{ id: 'auto', label: 'Default' }],
    strategies(o) {
      const m = o.model && o.model !== 'auto' ? ['--model', o.model] : [];
      return [
        { name: 'agy-print',       args: ['-p', o.prompt, ...m, '--output-format', 'text', '--print-timeout', '10m'], stdin: false },
        { name: 'agy-print-stdin', args: ['-p', '-', ...m, '--output-format', 'text', '--print-timeout', '10m'], stdin: true }
      ];
    }
  }
};

const found = new Map();
function resolveCommand(id) {
  if (found.has(id)) return found.get(id);
  const prof = PROFILES[id]; let hit = null;
  for (const cmd of prof.commands) {
    try {
      const r = spawnSync(cmd, prof.versionArgs, { encoding: 'utf8', timeout: 20000, shell: WIN });
      if (r.status === 0) { hit = { cmd, version: (r.stdout || '').trim().split('\n')[0] }; break; }
    } catch {}
  }
  found.set(id, hit);
  return hit;
}

function discover() {
  return Object.keys(PROFILES).map(id => {
    const hit = resolveCommand(id), p = PROFILES[id];
    return { id, label: p.label, available: !!hit, command: hit && hit.cmd, version: hit && hit.version, models: p.models };
  });
}

function runOnce(cmd, strat, prompt, timeoutMs) {
  return new Promise(resolve => {
    const child = spawn(cmd, strat.args, { shell: WIN, windowsHide: true });
    let out = '', err = '', done = false;
    const timer = setTimeout(() => { if (!done) { done = true; try { child.kill(); } catch {} resolve({ ok: false, out, err: err + '\n[weft] timeout' }); } }, timeoutMs);
    child.stdout.on('data', d => out += d);
    child.stderr.on('data', d => err += d);
    child.on('error', e => { if (!done) { done = true; clearTimeout(timer); resolve({ ok: false, out, err: String(e) }); } });
    child.on('close', code => { if (!done) { done = true; clearTimeout(timer); resolve({ ok: code === 0 && out.trim().length > 0, code, out, err }); } });
    if (strat.stdin) { child.stdin.write(prompt); child.stdin.end(); }
  });
}

async function ask({ provider, model, prompt, timeoutMs = 600000 }) {
  const prof = PROFILES[provider];
  if (!prof) return { ok: false, error: `unknown provider "${provider}"` };
  const hit = resolveCommand(provider);
  if (!hit) return { ok: false, error: `${prof.label} CLI not found on this machine` };
  const attempts = [];
  for (const strat of prof.strategies({ model, prompt })) {
    const t0 = Date.now();
    const r = await runOnce(hit.cmd, strat, prompt, timeoutMs);
    attempts.push({ strategy: strat.name, ok: r.ok, ms: Date.now() - t0, code: r.code, err: (r.err || '').slice(-400) });
    if (r.ok) return { ok: true, text: r.out, strategy: strat.name, attempts, provider, model: model || 'auto', version: hit.version };
  }
  return { ok: false, error: 'every strategy failed', attempts };
}

export { PROFILES, discover, ask };
