# WEFT bridge — local models behind the app

`node bridge/serve.js` → http://127.0.0.1:8787

Serving the folder from Node is what makes this possible at all: `index.html` is a
`file://` page and a browser cannot spawn a process. Served from the bridge, the app
is same-origin with the API, so the model picker is a plain `fetch` — no extension,
no CORS, no key in the page.

## What it does

```
brief (natural language)
      │
      ▼
  CLI provider  ──►  JSON parameters          (the model NEVER emits geometry)
      │
      ▼
  WEFT builds them  ──►  validityReport()      (the compiler is the governor)
      │
      ├─ valid   → accepted, printable
      └─ invalid → errors go back as the next prompt (repair loop)
```

Every run is written to `bridge/log/<timestamp>_<provider>_<model>.json`: the brief,
every attempt, the raw reply, what was applied, what was rejected and why, the verdict,
and the final parameters. That log is the experiment dataset — attempts-to-valid per
model is a number you can put in a table.

## Providers

Discovered by probing `--version`, in the same shape Svemir's `lib/cli_bridge.js` uses:
a provider is a command to find, a list of models, and an ORDERED list of invocation
strategies. The first strategy that exits 0 with usable output wins; the rest exist
because CLI flags drift between versions.

| provider | command | models |
|---|---|---|
| `claude` | `claude` | auto · sonnet · opus · haiku · fable |
| `codex` | `codex` | auto · gpt-5.6-sol (`exec --sandbox read-only`) |
| `antigravity` | `antigravity` | auto |

Codex runs read-only on purpose: this harness wants text back, it must never be able to
touch the repo it is designing for. Add a provider by adding one entry to `PROFILES` in
`cli.js` — nothing else in the app knows or cares which model answered.

## API

| route | what |
|---|---|
| `GET /weft/providers` | which CLIs exist on this machine, with versions and models |
| `POST /weft/ask` | `{provider, model, brief, params, report, attempt}` → `{params, raw, ms, …}` |
| `POST /weft/log` | store one design run |
| `GET /weft/runs` | list stored runs |

## Honest limits

- Discovery caches per process — restart after installing a CLI.
- A long agentic CLI can take minutes; the default ceiling is 10 minutes per attempt.
- The extractor recovers JSON from fenced or chatty replies and records *that it had to*
  (`cleanJSON:false`) — "needed extraction" is itself a result worth reporting.
- No streaming yet: the panel shows one line per attempt, not live tokens.
