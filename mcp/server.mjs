#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const SCHEMA_PATH = resolve(ROOT, "schemas", "design.v1.schema.json");
const MACHINES_PATH = resolve(ROOT, "machines.json");
const BENCHMARK_PATH = resolve(ROOT, "benchmarks", "BMK-001-expression", "benchmark.json");

const schemaText = readFileSync(SCHEMA_PATH, "utf8");
const machineText = readFileSync(MACHINES_PATH, "utf8");
const benchmarkText = readFileSync(BENCHMARK_PATH, "utf8");
const designSchema = JSON.parse(schemaText);
const machinesDocument = JSON.parse(machineText);
const benchmark = JSON.parse(benchmarkText);
const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const PRIMITIVES = new Set([
  "open_wall",
  "dome",
  "membrane_coupon",
  "bridge_coupon",
  "cantilever_coupon"
]);
const CONTOURS = new Set(["circle", "ellipse", "rounded_square", "peanut", "clover", "polyline"]);
const GRAMMARS = new Set(["staple", "perpendicular", "diagonal", "sine", "eight", "spiral"]);
const TOP_LEVEL_KEYS = new Set(["schema", "name", "intent", "units", "seed", "layout", "bodies", "experiment"]);

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanStrings(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
    : [];
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function countBy(values) {
  const result = {};
  for (const value of values) result[value] = (result[value] || 0) + 1;
  return result;
}

function issue(list, path, code, message) {
  list.push({ path, code, message });
}

function requireText(value, errors, path) {
  if (typeof value !== "string" || !value.trim()) {
    issue(errors, path, "required_text", "Expected a non-empty string.");
    return false;
  }
  return true;
}

function requirePositive(value, errors, path) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    issue(errors, path, "positive_number", "Expected a finite number greater than zero.");
    return false;
  }
  return true;
}

function rejectUnknown(object, allowed, errors, path) {
  if (!isObject(object)) return;
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) issue(errors, `${path}.${key}`, "additional_property", "Unknown field.");
  }
}

function validateStringArray(value, errors, path) {
  if (!Array.isArray(value) || value.length === 0) {
    issue(errors, path, "nonempty_string_array", "Expected at least one non-empty string.");
    return [];
  }
  value.forEach((item, index) => requireText(item, errors, `${path}[${index}]`));
  return cleanStrings(value);
}

function validateDesign(design) {
  const errors = [];
  const warnings = [];

  if (!isObject(design)) {
    issue(errors, "$", "object_required", "DesignSpec must be a JSON object.");
    return { valid: false, errors, warnings, normalized: null, summary: null };
  }

  for (const key of Object.keys(design)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      issue(errors, `$.${key}`, "additional_property", "Unknown top-level field.");
    }
  }

  if (design.schema !== "weft.design/v1") {
    issue(errors, "$.schema", "schema_version", 'Expected "weft.design/v1".');
  }
  requireText(design.name, errors, "$.name");
  requireText(design.intent, errors, "$.intent");
  if (typeof design.name === "string" && design.name.length > 120) {
    issue(errors, "$.name", "max_length", "Name exceeds 120 characters.");
  }
  if (typeof design.intent === "string" && design.intent.length > 1000) {
    issue(errors, "$.intent", "max_length", "Intent exceeds 1000 characters.");
  }
  if (design.units !== "mm") issue(errors, "$.units", "units", 'V1 accepts only "mm".');
  if (!Number.isInteger(design.seed)) issue(errors, "$.seed", "integer", "Seed must be an integer.");

  let capacity = null;
  if (!isObject(design.layout)) {
    issue(errors, "$.layout", "object_required", "Layout must be an object.");
  } else {
    rejectUnknown(design.layout, new Set(["type", "rows", "cols", "pitch"]), errors, "$.layout");
    if (design.layout.type !== "grid") {
      issue(errors, "$.layout.type", "layout_type", 'V1 accepts only the "grid" layout.');
    }
    const { rows, cols, pitch } = design.layout;
    if (!Number.isInteger(rows) || rows < 1 || rows > 8) {
      issue(errors, "$.layout.rows", "range", "Rows must be an integer from 1 through 8.");
    }
    if (!Number.isInteger(cols) || cols < 1 || cols > 8) {
      issue(errors, "$.layout.cols", "range", "Columns must be an integer from 1 through 8.");
    }
    if (Number.isInteger(rows) && Number.isInteger(cols)) capacity = rows * cols;
    if (!Array.isArray(pitch) || pitch.length !== 2) {
      issue(errors, "$.layout.pitch", "pair_required", "Pitch must be [x, y].");
    } else {
      requirePositive(pitch[0], errors, "$.layout.pitch[0]");
      requirePositive(pitch[1], errors, "$.layout.pitch[1]");
    }
  }

  if (!Array.isArray(design.bodies) || design.bodies.length < 1 || design.bodies.length > 64) {
    issue(errors, "$.bodies", "body_count", "Bodies must contain between 1 and 64 entries.");
  } else {
    if (capacity !== null && design.bodies.length > capacity) {
      issue(errors, "$.bodies", "layout_overflow", `Grid capacity is ${capacity}, but ${design.bodies.length} bodies were supplied.`);
    } else if (capacity !== null && design.bodies.length < capacity) {
      issue(warnings, "$.bodies", "unused_cells", `Grid has ${capacity - design.bodies.length} unused cells.`);
    }

    const ids = new Set();
    design.bodies.forEach((body, index) => {
      const path = `$.bodies[${index}]`;
      if (!isObject(body)) {
        issue(errors, path, "object_required", "Body must be an object.");
        return;
      }
      rejectUnknown(body, new Set(["id", "label", "primitive", "contour", "grammar", "height", "variables", "questions"]), errors, path);
      if (!requireText(body.id, errors, `${path}.id`)) return;
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(body.id)) {
        issue(errors, `${path}.id`, "identifier", "ID must start with a letter and contain at most 32 safe characters.");
      }
      if (ids.has(body.id)) issue(errors, `${path}.id`, "duplicate_id", `Duplicate body ID "${body.id}".`);
      ids.add(body.id);
      if (body.label !== undefined && (typeof body.label !== "string" || body.label.length > 120)) {
        issue(errors, `${path}.label`, "label", "Label must be a string of at most 120 characters.");
      }

      if (!PRIMITIVES.has(body.primitive)) {
        issue(errors, `${path}.primitive`, "primitive", "Primitive is not declared by WEFT V1.");
      }
      requirePositive(body.height, errors, `${path}.height`);

      if (!isObject(body.contour) || !CONTOURS.has(body.contour.type)) {
        issue(errors, `${path}.contour`, "contour", "Contour is missing or unsupported.");
      } else {
        rejectUnknown(body.contour, new Set(["type", "radius", "rx", "ry", "points"]), errors, `${path}.contour`);
        if (body.contour.type === "ellipse") {
          requirePositive(body.contour.rx, errors, `${path}.contour.rx`);
          requirePositive(body.contour.ry, errors, `${path}.contour.ry`);
        } else if (body.contour.type === "polyline") {
          if (!Array.isArray(body.contour.points) || body.contour.points.length < 2 ||
              body.contour.points.some((point) => !Array.isArray(point) || point.length !== 2 ||
                point.some((number) => typeof number !== "number" || !Number.isFinite(number)))) {
            issue(errors, `${path}.contour.points`, "points", "Polyline needs at least two finite [x, y] points.");
          }
        } else {
          requirePositive(body.contour.radius, errors, `${path}.contour.radius`);
        }
      }

      if (!isObject(body.grammar) || !GRAMMARS.has(body.grammar.type)) {
        issue(errors, `${path}.grammar`, "grammar", "Grammar is missing or unsupported.");
      } else {
        rejectUnknown(body.grammar, new Set(["type", "pitch", "tab", "phase"]), errors, `${path}.grammar`);
        if (body.grammar.pitch !== undefined) requirePositive(body.grammar.pitch, errors, `${path}.grammar.pitch`);
        if (body.grammar.tab !== undefined) requirePositive(body.grammar.tab, errors, `${path}.grammar.tab`);
        if (body.grammar.phase !== undefined &&
            (typeof body.grammar.phase !== "number" || !Number.isFinite(body.grammar.phase))) {
          issue(errors, `${path}.grammar.phase`, "finite_number", "Phase must be a finite number.");
        }
      }
      if (!isObject(body.variables)) {
        issue(errors, `${path}.variables`, "object_required", "Variables must be an object.");
      }
      validateStringArray(body.questions, errors, `${path}.questions`);
    });
  }

  if (!isObject(design.experiment)) {
    issue(errors, "$.experiment", "object_required", "Experiment must be an object.");
  } else {
    rejectUnknown(design.experiment, new Set(["id", "controlled", "varied", "measure", "hypothesis"]), errors, "$.experiment");
    requireText(design.experiment.id, errors, "$.experiment.id");
    requireText(design.experiment.hypothesis, errors, "$.experiment.hypothesis");
    if (typeof design.experiment.id === "string" && design.experiment.id.length > 80) {
      issue(errors, "$.experiment.id", "max_length", "Experiment ID exceeds 80 characters.");
    }
    if (typeof design.experiment.hypothesis === "string" && design.experiment.hypothesis.length > 1000) {
      issue(errors, "$.experiment.hypothesis", "max_length", "Hypothesis exceeds 1000 characters.");
    }
    const controlled = validateStringArray(design.experiment.controlled, errors, "$.experiment.controlled");
    const varied = validateStringArray(design.experiment.varied, errors, "$.experiment.varied");
    validateStringArray(design.experiment.measure, errors, "$.experiment.measure");
    const overlap = varied.filter((item) => controlled.includes(item));
    if (overlap.length) {
      issue(errors, "$.experiment", "factor_overlap", `Factors cannot be both controlled and varied: ${overlap.join(", ")}.`);
    }
  }

  const normalized = stable(design);
  const summary = designSummary(design);
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalized,
    designHash: sha256(JSON.stringify(normalized)),
    summary
  };
}

function designSummary(design) {
  const bodies = Array.isArray(design?.bodies) ? design.bodies.filter(isObject) : [];
  const heights = bodies.map((body) => body.height).filter((height) => typeof height === "number" && Number.isFinite(height));
  const rows = design?.layout?.rows;
  const cols = design?.layout?.cols;
  const pitch = design?.layout?.pitch;
  const centerSpan = Number.isInteger(rows) && Number.isInteger(cols) && Array.isArray(pitch) && pitch.length === 2
    ? [(cols - 1) * pitch[0], (rows - 1) * pitch[1]]
    : null;
  return {
    name: typeof design?.name === "string" ? design.name : null,
    bodyCount: bodies.length,
    gridCapacity: Number.isInteger(rows) && Number.isInteger(cols) ? rows * cols : null,
    layoutCenterSpanMm: centerSpan,
    heightRangeMm: heights.length ? [Math.min(...heights), Math.max(...heights)] : null,
    primitives: countBy(bodies.map((body) => body.primitive).filter(Boolean)),
    contours: countBy(bodies.map((body) => body.contour?.type).filter(Boolean)),
    grammars: countBy(bodies.map((body) => body.grammar?.type).filter(Boolean)),
    controlled: cleanStrings(design?.experiment?.controlled),
    varied: cleanStrings(design?.experiment?.varied),
    measured: cleanStrings(design?.experiment?.measure)
  };
}

function profileSummaries() {
  return Object.entries(machinesDocument)
    .filter(([id, profile]) => !id.startsWith("_") && isObject(profile))
    .map(([id, profile]) => {
      const assetFields = ["start", "end", "containerTemplate"];
      const missingAssets = assetFields
        .filter((field) => profile[field] && !existsSync(resolve(ROOT, profile[field])))
        .map((field) => ({ field, path: profile[field] }));
      const measured = String(profile.beadSource).toLowerCase() === "measured";
      let readiness = "print_candidate";
      if (!measured) readiness = "calibration_required";
      if (missingAssets.length) readiness = "incomplete_profile";
      return {
        id,
        label: profile.label,
        readiness,
        plateMm: profile.plate,
        maxZMm: profile.maxZ,
        nozzleMm: profile.nozzle,
        measuredBeadMm: profile.bead,
        beadSource: profile.beadSource,
        beadEvidence: profile.beadEvidence,
        layerHeightMm: profile.lh,
        route: profile.route,
        missingAssets,
        warnings: measured
          ? []
          : ["Bead width is assumed. Run the machine/material calibration before treating output as printable."]
      };
    });
}

function benchmarkTask(args = {}) {
  const layer = args.layer || "B1";
  const brief = args.brief || "expressive";
  const mode = args.mode || "C";
  if (!benchmark.layers[layer]) throw new Error(`Unknown benchmark layer: ${layer}`);
  if (!benchmark.briefs[brief]) throw new Error(`Unknown benchmark brief: ${brief}`);
  if (!benchmark.modes[mode]) throw new Error(`Unknown benchmark mode: ${mode}`);
  return {
    benchmark: { id: benchmark.id, title: benchmark.title, version: benchmark.version },
    controls: benchmark.controls,
    brief: benchmark.briefs[brief],
    layer: { id: layer, ...benchmark.layers[layer] },
    mode: { id: mode, ...benchmark.modes[mode] },
    scoring: benchmark.scoring,
    requiredEnvelope: {
      benchmarkId: benchmark.id,
      layer,
      brief,
      mode,
      submission: "Layer-specific JSON value",
      modelMetadata: "Provider, model, settings, elapsed time, token usage, and hashes when available"
    }
  };
}

function addScore(breakdown, name, awarded, possible, evidence) {
  breakdown.push({ name, awarded, possible, evidence });
}

function scoreDesignSubmission(submission, breakdown) {
  const design = submission?.design || submission;
  const validation = validateDesign(design);
  addScore(
    breakdown,
    "schema_validity",
    validation.valid ? 15 : 0,
    15,
    validation.valid ? "DesignSpec passed deterministic V1 validation." : `${validation.errors.length} validation error(s).`
  );

  const experiment = design?.experiment;
  const controlled = cleanStrings(experiment?.controlled);
  const varied = cleanStrings(experiment?.varied);
  const measured = cleanStrings(experiment?.measure);
  const overlap = varied.filter((item) => controlled.includes(item));
  const experimental = controlled.length > 0 && varied.length > 0 && measured.length > 0 &&
    overlap.length === 0 && typeof experiment?.hypothesis === "string" && experiment.hypothesis.trim();
  addScore(
    breakdown,
    "experimental_clarity",
    experimental ? 15 : 0,
    15,
    experimental ? "Controlled, varied, measured, and hypothesis fields are mechanically complete." : "Experimental declaration is incomplete or internally overlaps."
  );

  const capacity = Number.isInteger(design?.layout?.rows) && Number.isInteger(design?.layout?.cols)
    ? design.layout.rows * design.layout.cols
    : null;
  const economical = capacity !== null && Array.isArray(design?.bodies) && design.bodies.length <= capacity;
  addScore(
    breakdown,
    "economy",
    economical ? 5 : 0,
    5,
    economical ? "Body count fits the declared grid." : "Grid/body economy cannot be mechanically established."
  );
  return validation;
}

function scoreBenchmark(args = {}) {
  const layer = args.layer;
  const submission = args.submission;
  if (!benchmark.layers[layer]) throw new Error(`Unknown benchmark layer: ${layer}`);
  if (!isObject(submission)) throw new Error("Submission must be a JSON object.");

  const breakdown = [];
  let validation = null;

  if (layer === "B0") {
    const complete = requireTextValue(submission.goal) &&
      cleanStrings(submission.controlled).length &&
      cleanStrings(submission.varied).length &&
      cleanStrings(submission.measured).length &&
      cleanStrings(submission.material_questions).length;
    const overlap = cleanStrings(submission.varied).filter((item) => cleanStrings(submission.controlled).includes(item));
    addScore(breakdown, "experimental_clarity", complete && !overlap.length ? 15 : 0, 15,
      complete && !overlap.length ? "Required planning fields are present without factor overlap." : "Planning fields are incomplete or overlap.");
    addScore(breakdown, "economy", Object.keys(submission).length <= 7 ? 5 : 0, 5,
      Object.keys(submission).length <= 7 ? "Submission is compact." : "Submission carries unnecessary top-level material.");
  } else if (layer === "B1" || layer === "B5") {
    validation = scoreDesignSubmission(submission, breakdown);
  } else if (layer === "B2") {
    validation = scoreDesignSubmission(submission, breakdown);
    const trace = Array.isArray(submission.tool_trace) ? submission.tool_trace : [];
    const names = trace.map((entry) => typeof entry === "string" ? entry : entry?.name).filter(Boolean);
    const efficient = trace.length > 0 && trace.length <= benchmark.controls.maxToolCalls &&
      names.includes("weft_get_schema") && names.includes("weft_validate_design");
    addScore(breakdown, "tool_efficiency", efficient ? 10 : 0, 10,
      efficient ? `${trace.length} calls included schema retrieval and validation.` : "Trace is missing, over budget, or omits required tools.");
  } else if (layer === "B3") {
    validation = scoreDesignSubmission(submission, breakdown);
    const repaired = requireTextValue(submission.cause) && Array.isArray(submission.changes) &&
      submission.changes.length > 0 && validation.valid;
    addScore(breakdown, "repair_fidelity", repaired ? 10 : 0, 10,
      repaired ? "Cause, changes, and valid repaired design are present." : "Repair evidence is incomplete.");
  } else if (layer === "B4") {
    const known = new Set(profileSummaries().map((profile) => profile.id));
    const profiles = Array.isArray(submission.machine_profiles) ? submission.machine_profiles : [];
    const separated = typeof submission.design_hash === "string" && /^[a-f0-9]{64}$/i.test(submission.design_hash) &&
      submission.design_changed === false && new Set(profiles).size >= 2 &&
      profiles.every((id) => known.has(id)) && requireTextValue(submission.rationale);
    addScore(breakdown, "cross_machine_separation", separated ? 5 : 0, 5,
      separated ? "One design hash is explicitly separated from two known machine profiles." : "Cross-machine evidence is incomplete or changes the design.");
  }

  const automaticScore = breakdown.reduce((sum, item) => sum + item.awarded, 0);
  const automaticMax = breakdown.reduce((sum, item) => sum + item.possible, 0);
  const pendingHuman = ["brief_understanding", "semantic_distinction"];
  const pendingPipeline = ["compiled_validity", "physical_print_quality"];
  if (layer !== "B2") pendingHuman.push("tool_efficiency");
  if (layer !== "B3") pendingHuman.push("repair_fidelity");
  if (layer !== "B4") pendingHuman.push("cross_machine_separation");

  return {
    benchmarkId: benchmark.id,
    layer,
    automaticScore,
    automaticMax,
    breakdown,
    validation,
    pendingHuman,
    pendingPipeline,
    printable: false,
    verdict: "Automatic MCP V1 score is partial evidence only; compilation gates and a physical print are not run here."
  };
}

function requireTextValue(value) {
  return typeof value === "string" && Boolean(value.trim());
}

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const TOOLS = [
  {
    name: "weft_describe",
    description: "Explain WEFT MCP V1 capabilities, evidence boundaries, and the safe model workflow.",
    inputSchema: { type: "object", additionalProperties: false },
    annotations: READ_ONLY
  },
  {
    name: "weft_get_schema",
    description: "Return the authoritative WEFT DesignSpec v1 JSON Schema and its hash.",
    inputSchema: { type: "object", additionalProperties: false },
    annotations: READ_ONLY
  },
  {
    name: "weft_list_profiles",
    description: "List printer profiles with evidence-derived readiness; assumed calibration is never reported as ready.",
    inputSchema: { type: "object", additionalProperties: false },
    annotations: READ_ONLY
  },
  {
    name: "weft_validate_design",
    description: "Validate a profile-neutral DesignSpec and return structured errors, warnings, summary, and a stable hash.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["design"],
      properties: { design: { type: "object" } }
    },
    annotations: READ_ONLY
  },
  {
    name: "weft_preview_design",
    description: "Return a non-printable semantic summary of a DesignSpec. This does not compile or simulate G-code.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["design"],
      properties: { design: { type: "object" } }
    },
    annotations: READ_ONLY
  },
  {
    name: "weft_benchmark_get_task",
    description: "Get one controlled benchmark brief, layer, mode, submission envelope, and scoring policy.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        layer: { enum: ["B0", "B1", "B2", "B3", "B4", "B5"], default: "B1" },
        brief: { enum: ["expressive", "technical"], default: "expressive" },
        mode: { enum: ["A", "B", "C", "D"], default: "C" }
      }
    },
    annotations: READ_ONLY
  },
  {
    name: "weft_benchmark_score",
    description: "Score only mechanically evidenced benchmark dimensions; human, compile, and physical evidence remain pending.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["layer", "submission"],
      properties: {
        layer: { enum: ["B0", "B1", "B2", "B3", "B4", "B5"] },
        submission: { type: "object" }
      }
    },
    annotations: READ_ONLY
  }
];

function describeServer() {
  return {
    name: "weft-mcp",
    version: "0.1.0",
    role: "A local, read-only capability and evaluation boundary between a model's design intent and future verified fabrication.",
    workflow: [
      "Call weft_describe and weft_list_profiles.",
      "Call weft_get_schema.",
      "Author one profile-neutral weft.design/v1 object.",
      "Call weft_validate_design until valid.",
      "Use weft_preview_design only as a semantic summary.",
      "Record the benchmark task and score when comparing models.",
      "Hand a validated design to a separately gated compiler only after that compiler exists and passes machine-specific tests."
    ],
    tools: TOOLS.map((tool) => tool.name),
    declaredPrimitives: [...PRIMITIVES],
    declaredContours: [...CONTOURS],
    declaredGrammars: [...GRAMMARS],
    safetyBoundary: {
      filesystemWrites: false,
      shellExecution: false,
      arbitraryGcode: false,
      compilation: false,
      printerControl: false,
      printableClaims: false
    },
    evidenceRule: "Motion validity, slicer semantics, package validity, and physical print quality are four separate truths."
  };
}

function callTool(name, args = {}) {
  switch (name) {
    case "weft_describe":
      return describeServer();
    case "weft_get_schema":
      return { uri: "weft://schemas/design/v1", sha256: sha256(schemaText), schema: designSchema };
    case "weft_list_profiles":
      return {
        source: "machines.json",
        sha256: sha256(machineText),
        profiles: profileSummaries(),
        policy: "A profile with assumed bead width or missing assets is not ready for trusted output."
      };
    case "weft_validate_design":
      return validateDesign(args.design);
    case "weft_preview_design": {
      const validation = validateDesign(args.design);
      return {
        validation,
        summary: validation.summary,
        printable: false,
        previewKind: "semantic_summary_only",
        reason: "MCP V1 has no GeometryIR, path scheduler, dialect adapter, package gate, slicer preview, or physical result."
      };
    }
    case "weft_benchmark_get_task":
      return benchmarkTask(args);
    case "weft_benchmark_score":
      return scoreBenchmark(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function resourceList() {
  return [
    {
      uri: "weft://schemas/design/v1",
      name: "WEFT DesignSpec v1 schema",
      description: "Authoritative profile-neutral authoring contract.",
      mimeType: "application/schema+json"
    },
    {
      uri: "weft://profiles/machines",
      name: "WEFT machine profile readiness",
      description: "Evidence-derived view of configured machine profiles.",
      mimeType: "application/json"
    },
    ...profileSummaries().map((profile) => ({
      uri: `weft://profiles/machines/${profile.id}`,
      name: profile.label,
      description: `Machine profile; readiness: ${profile.readiness}.`,
      mimeType: "application/json"
    })),
    {
      uri: "weft://benchmarks/BMK-001-expression",
      name: benchmark.title,
      description: benchmark.purpose,
      mimeType: "application/json"
    }
  ];
}

function readResource(uri) {
  let value;
  if (uri === "weft://schemas/design/v1") value = designSchema;
  else if (uri === "weft://profiles/machines") value = { profiles: profileSummaries() };
  else if (uri === "weft://benchmarks/BMK-001-expression") value = benchmark;
  else if (uri.startsWith("weft://profiles/machines/")) {
    const id = uri.slice("weft://profiles/machines/".length);
    value = profileSummaries().find((profile) => profile.id === id);
    if (!value) throw new Error(`Unknown machine profile resource: ${id}`);
  } else {
    throw new Error(`Unknown resource: ${uri}`);
  }
  return {
    contents: [{ uri, mimeType: "application/json", text: JSON.stringify(value, null, 2) }]
  };
}

const PROMPTS = [
  {
    name: "weft-model-benchmark",
    description: "Run one controlled WEFT model benchmark condition.",
    arguments: [
      { name: "layer", description: "B0 through B5", required: false },
      { name: "brief", description: "expressive or technical", required: false },
      { name: "mode", description: "A through D", required: false }
    ]
  }
];

function getPrompt(name, args = {}) {
  if (name !== "weft-model-benchmark") throw new Error(`Unknown prompt: ${name}`);
  const task = benchmarkTask(args);
  return {
    description: `${task.benchmark.id} ${task.layer.id}/${task.mode.id}`,
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: [
          task.brief.prompt,
          "",
          `Benchmark layer: ${task.layer.id} — ${task.layer.name}`,
          `Mode: ${task.mode.id} — ${task.mode.name}`,
          `Submit: ${task.layer.submission}`,
          `Seed: ${task.controls.seed}; maximum tool calls: ${task.controls.maxToolCalls}; maximum repair rounds: ${task.controls.maxRepairRounds}.`,
          "Do not claim printability. Return the required JSON envelope and preserve exact machine/design separation."
        ].join("\n")
      }
    }]
  };
}

function toolResult(value, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
    isError
  };
}

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id: id ?? null, error };
}

function dispatch(message) {
  const params = isObject(message.params) ? message.params : {};
  switch (message.method) {
    case "initialize":
      return {
        protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(params.protocolVersion)
          ? params.protocolVersion
          : SUPPORTED_PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false }, resources: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: { name: "weft-mcp", version: "0.1.0" },
        instructions: "Read-only DesignSpec validation and model benchmarking. V1 never compiles, writes G-code, controls a printer, or claims printability."
      };
    case "ping":
      return {};
    case "tools/list":
      return { tools: TOOLS };
    case "tools/call": {
      if (!requireTextValue(params.name)) {
        throw Object.assign(new Error("Tool name is required."), { rpcCode: -32602 });
      }
      if (!TOOLS.some((tool) => tool.name === params.name)) {
        throw Object.assign(new Error(`Unknown tool: ${params.name}`), { rpcCode: -32602 });
      }
      try {
        return toolResult(callTool(params.name, isObject(params.arguments) ? params.arguments : {}));
      } catch (error) {
        return toolResult({ error: error.message, printable: false }, true);
      }
    }
    case "resources/list":
      return { resources: resourceList() };
    case "resources/read":
      return readResource(params.uri);
    case "resources/templates/list":
      return { resourceTemplates: [] };
    case "prompts/list":
      return { prompts: PROMPTS };
    case "prompts/get":
      return getPrompt(params.name, isObject(params.arguments) ? params.arguments : {});
    default:
      throw Object.assign(new Error(`Method not found: ${message.method}`), { rpcCode: -32601 });
  }
}

let inputBuffer = Buffer.alloc(0);

function send(message, framing) {
  const json = JSON.stringify(message);
  if (framing === "content-length") {
    process.stdout.write(`Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`);
  } else {
    process.stdout.write(`${json}\n`);
  }
}

function handlePayload(text, framing) {
  let message;
  try {
    message = JSON.parse(text);
  } catch (error) {
    send(rpcError(null, -32700, "Parse error", error.message), framing);
    return;
  }

  if (!isObject(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    send(rpcError(message?.id ?? null, -32600, "Invalid Request"), framing);
    return;
  }

  const notification = !Object.prototype.hasOwnProperty.call(message, "id");
  if (notification) return;

  try {
    send(rpcResult(message.id, dispatch(message)), framing);
  } catch (error) {
    send(rpcError(message.id, error.rpcCode || -32602, error.message), framing);
  }
}

function drainInput() {
  while (inputBuffer.length) {
    while (inputBuffer.length && (inputBuffer[0] === 10 || inputBuffer[0] === 13)) {
      inputBuffer = inputBuffer.subarray(1);
    }
    if (!inputBuffer.length) return;

    const prefix = inputBuffer.subarray(0, Math.min(64, inputBuffer.length)).toString("utf8");
    if (/^Content-Length:/i.test(prefix)) {
      let separator = Buffer.from("\r\n\r\n");
      let headerEnd = inputBuffer.indexOf(separator);
      if (headerEnd < 0) {
        separator = Buffer.from("\n\n");
        headerEnd = inputBuffer.indexOf(separator);
      }
      if (headerEnd < 0) return;
      const header = inputBuffer.subarray(0, headerEnd).toString("ascii");
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        handlePayload("", "content-length");
        inputBuffer = inputBuffer.subarray(headerEnd + separator.length);
        continue;
      }
      const length = Number(match[1]);
      const bodyStart = headerEnd + separator.length;
      if (inputBuffer.length < bodyStart + length) return;
      const body = inputBuffer.subarray(bodyStart, bodyStart + length).toString("utf8");
      inputBuffer = inputBuffer.subarray(bodyStart + length);
      handlePayload(body, "content-length");
      continue;
    }

    const newline = inputBuffer.indexOf(10);
    if (newline < 0) return;
    const line = inputBuffer.subarray(0, newline).toString("utf8").trim();
    inputBuffer = inputBuffer.subarray(newline + 1);
    if (line) handlePayload(line, "ndjson");
  }
}

process.stdin.on("data", (chunk) => {
  inputBuffer = Buffer.concat([inputBuffer, chunk]);
  drainInput();
});

process.stdin.on("end", () => {
  const tail = inputBuffer.toString("utf8").trim();
  inputBuffer = Buffer.alloc(0);
  if (tail) handlePayload(tail, "ndjson");
});

process.stdin.resume();
