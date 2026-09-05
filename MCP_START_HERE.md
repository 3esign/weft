# WEFT MCP V1 — start here

## What this version is

WEFT MCP V1 is a local, zero-dependency, read-only interface for testing how well a model can express a fabrication idea as a disciplined WEFT design. It exposes capabilities, the DesignSpec schema, printer-profile readiness, deterministic validation, a semantic preview, and a controlled model benchmark.

It deliberately does **not** compile geometry, emit G-code, package Bambu 3MF files, contact a printer, or label anything printable. Those powers belong only after the canonical geometry/toolpath pipeline and machine gates described in the PI/WEFT plan are implemented and tested.

Entry point:

    D:\Svemir\!Projekti\PI\weft\mcp\server.mjs

Transport: local MCP over standard input/output. The standards path is one UTF-8 JSON-RPC message per line with no embedded newline. The server also accepts Content-Length framing as a compatibility extension. It writes no project files and opens no network connection.

## Connect from an MCP host

Configure the host to launch:

- command: node
- argument: D:\Svemir\!Projekti\PI\weft\mcp\server.mjs
- working directory, if the host requires one: D:\Svemir\!Projekti\PI\weft

A common host-neutral configuration shape is:

    {
      "mcpServers": {
        "weft": {
          "command": "node",
          "args": [
            "D:\\Svemir\\!Projekti\\PI\\weft\\mcp\\server.mjs"
          ]
        }
      }
    }

The exact outer configuration filename and nesting belong to the chosen model host. Do not modify the WEFT server per host; adapt only the host registration.

Repository checks:

- npm run test:mcp exercises the live stdio server.
- npm test runs the existing WEFT browser/toolpath tests.

## The correct model workflow

1. Call weft_describe. Treat its declared primitives, contours, grammars, and safety boundary as authoritative for V1.
2. Call weft_list_profiles. A profile marked calibration_required or incomplete_profile cannot support a trusted print claim.
3. Call weft_get_schema.
4. Convert the human brief into one profile-neutral weft.design/v1 object. Printer temperatures, extrusion width, start code, build volume, and Bambu/Creality dialect do not belong in this object.
5. Call weft_validate_design. Repair the listed paths and codes; do not hide or paraphrase failures.
6. Optionally call weft_preview_design. This returns counts, ranges, and experimental factors, not geometry or a print preview.
7. For model comparison, obtain the exact task with weft_benchmark_get_task, preserve the seed and limits, then submit the result to weft_benchmark_score.
8. Keep the result as a design/benchmark artifact. Until a future gated compiler returns the required evidence, its status remains non-printable.

## Tools

### weft_describe

Use first. It prevents a model from inventing unsupported primitives or assuming that MCP access implies printer access.

### weft_get_schema

Returns the exact JSON Schema and SHA-256 hash. Record the hash in benchmark runs so two models are not accidentally judged against different contracts.

### weft_list_profiles

Returns evidence-derived readiness:

- print_candidate: profile calibration is recorded and referenced assets exist. This still does not mean an arbitrary design is printable.
- calibration_required: a critical value such as bead width is assumed.
- incomplete_profile: a referenced start/end/container asset is missing.

At the creation of V1, a2l is the only print candidate. a1 and ender require their own calibration. A Bambu A2L template is not evidence for an A1.

### weft_validate_design

Checks the authoring contract and WEFT-specific invariants, including:

- fixed units and schema version;
- supported layout and bounded grid;
- body count versus grid capacity;
- stable, unique body IDs;
- declared primitive, contour, and grammar;
- positive dimensions and required contour parameters;
- at least one physical question per body;
- complete experiment declaration;
- no factor appearing in both controlled and varied.

A valid response provides a normalized object and stable design hash. Valid means structurally admissible, not printable.

### weft_preview_design

Returns body count, grid capacity, center-to-center layout span, height range, capability counts, and experimental factors. It always returns printable: false in V1.

### weft_benchmark_get_task

Locks one condition:

- brief: expressive or technical;
- layer: B0 through B5;
- mode: A through D;
- seed, tool-call budget, repair budget, expected envelope, and scoring policy.

Always call this rather than copying an old prompt from a conversation.

### weft_benchmark_score

Scores only facts the server can mechanically prove. It never fills missing semantic, compiled, slicer, or physical evidence with an optimistic estimate. Compare automatic score to automaticMax, not directly to 100. The remaining dimensions must be completed by the relevant reviewer or pipeline.

## Minimal DesignSpec example

    {
      "schema": "weft.design/v1",
      "name": "two_grammars",
      "intent": "Compare two related shallow walls while changing only path grammar.",
      "units": "mm",
      "seed": 1337,
      "layout": {
        "type": "grid",
        "rows": 1,
        "cols": 2,
        "pitch": [48, 48]
      },
      "bodies": [
        {
          "id": "staple",
          "label": "staple",
          "primitive": "open_wall",
          "contour": { "type": "circle", "radius": 16 },
          "grammar": { "type": "staple", "pitch": 4.5 },
          "height": 12,
          "variables": { "grammar": "staple" },
          "questions": ["Does the wall keep its intended spacing for the full height?"]
        },
        {
          "id": "diagonal",
          "label": "diagonal",
          "primitive": "open_wall",
          "contour": { "type": "circle", "radius": 16 },
          "grammar": { "type": "diagonal", "pitch": 4.5 },
          "height": 12,
          "variables": { "grammar": "diagonal" },
          "questions": ["Does the wall keep its intended spacing for the full height?"]
        }
      ],
      "experiment": {
        "id": "grammar_pair_v1",
        "controlled": ["machine", "material", "layer_height", "contour", "height"],
        "varied": ["grammar"],
        "measure": ["completed_height", "spacing_error", "failure_location"],
        "hypothesis": "Changing grammar alone changes local stability while preserving the shared family."
      }
    }

## Benchmark layers

- B0 — brief_understanding: can the model identify what is controlled, varied, and measured before authoring?
- B1 — design_spec: can it express the idea inside the actual WEFT contract?
- B2 — mcp_composition: can it discover and use the interface efficiently instead of guessing?
- B3 — gate_driven_repair: can it understand a failure and make the smallest valid repair?
- B4 — cross_machine_transfer: can it preserve one design while separating Bambu/Creality machine realization?
- B5 — novel_expression: can it make meaningful, measurable distinctions without escaping into unsupported rhetoric?

Benchmark modes isolate the value of the interface:

- A: brief only;
- B: brief plus schema;
- C: brief plus MCP;
- D: MCP plus one controlled repair round.

Use the same brief, seed, model settings, time/tool limits, and schema/profile hashes. Change one comparison variable at a time.

## Evidence states

Never collapse these statements:

1. **Design-valid** — the DesignSpec passes V1 validation.
2. **Geometry-valid** — a future GeometryIR gate proves bounded, coherent geometry.
3. **Toolpath-valid** — scheduling, extrusion, support, and machine constraints pass.
4. **Dialect/package-valid** — the target adapter and file container pass.
5. **Preview-verified** — the target slicer displays real Z progression, features, and estimated model time.
6. **Human-approved** — a person selected the exact artifact for the exact machine/material.
7. **Physically observed** — the print completed and measurements/photos are attached.
8. **Promoted knowledge** — repeated evidence justifies a reusable rule.

V1 reaches only the first state.

## Rules for extending the MCP

Future models should add capabilities in this order:

1. canonical DesignSpec-to-GeometryIR compiler;
2. deterministic geometry and support gates;
3. global multi-body scheduler and ToolpathIR;
4. extrusion/kinematic/thermal checks;
5. separate Bambu and Creality dialect adapters;
6. Bambu package and slicer-semantic gates;
7. immutable artifact manifests;
8. human approval token;
9. optional local print dispatch as a separately permissioned component.

Do not add arbitrary shell access, arbitrary G-code passthrough, remote printer control, or a generic write-file tool to this MCP. A narrow fabrication API is safer and easier to benchmark than giving models unstructured hands.

## Honest verdict

Verified: the stdio server initializes, lists seven tools, reads resources, classifies current profiles, accepts a valid DesignSpec, rejects duplicate IDs and experimental factor overlap, produces a non-printable semantic preview, returns the benchmark task, and emits a partial mechanical score.

Not yet verified: schema coverage through an external JSON Schema engine, geometry compilation, bridge/cantilever realization, Bambu/Creality emission, slicer parsing, package integrity, physical printing, or printer dispatch.

## Protocol references

The V1 handshake, capabilities, tools, resources, prompts, structured-content fallback, and newline stdio behavior were checked against the current official MCP specification:

- https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle
- https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
- https://modelcontextprotocol.io/specification/2025-11-25/server/tools
- https://modelcontextprotocol.io/specification/2025-11-25/server/resources
- https://modelcontextprotocol.io/specification/2025-11-25/server/prompts
