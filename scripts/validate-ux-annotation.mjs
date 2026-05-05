#!/usr/bin/env node

/**
 * validate-ux-annotation.mjs
 *
 * Validates exported UX Review annotation JSON files against the
 * annotation-schema.json schema and performs additional safety checks.
 *
 * Usage:
 *   node scripts/validate-ux-annotation.mjs docs/ux-review/ux-review-2026-05-05-skills.json
 *   node scripts/validate-ux-annotation.mjs docs/ux-review/*.json
 *
 * Exit codes:
 *   0 — All files valid
 *   1 — One or more files failed validation
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const SCHEMA_PATH = resolve(PROJECT_ROOT, "docs/ux-review/annotation-schema.json");

// ── Known sensitive field patterns to flag ──────────────────────────
const SENSITIVE_PATTERNS = [
  /token/i,
  /secret/i,
  /password/i,
  /credential/i,
  /api[_-]?key/i,
  /auth[_-]?header/i,
  /bearer/i,
  /jwt/i,
  /session[_-]?id/i,
  /access[_-]?key/i,
  /private[_-]?key/i,
  /pii/i,
  /ssn/i,
  /email/i, // email may appear legitimately; flag as warning
];

// ── Valid enums (must match TypeScript types) ───────────────────────
const VALID_ISSUE_TYPES = [
  "too-large",
  "too-prominent",
  "wrong-action-hierarchy",
  "navigation-looks-like-mutation",
  "empty-looking-section",
  "duplicate-information",
  "raw-data-too-visible",
  "diagnostics-too-prominent",
  "needs-compact-representation",
  "label-unclear",
  "other",
];

const VALID_SEVERITIES = ["critical", "major", "minor", "suggestion"];

// ── Utility functions ───────────────────────────────────────────────

function loadJson(filePath) {
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function loadSchema() {
  if (!existsSync(SCHEMA_PATH)) {
    console.error(`⚠ Schema file not found at ${SCHEMA_PATH}. Skipping schema validation.`);
    return null;
  }
  return loadJson(SCHEMA_PATH);
}

/**
 * Attempts to validate JSON structure using a simple shallow check.
 * This avoids pulling in a full JSON Schema validator (ajv) as a dependency.
 * For production use, consider: `npx ajv validate -s schema.json -d data.json`
 */
function validateWithSchema(data, schema) {
  if (!schema) return null; // schema not found — skip validation

  const errors = [];

  // Check required envelope fields
  if (schema.required && Array.isArray(schema.required)) {
    for (const field of schema.required) {
      if (!(field in data)) {
        errors.push(`Missing required envelope field: "${field}"`);
      }
    }
  }

  // Check schema version
  if (
    data.schemaVersion &&
    schema.properties?.schemaVersion?.enum &&
    !schema.properties.schemaVersion.enum.includes(data.schemaVersion)
  ) {
    errors.push(
      `Invalid schemaVersion "${data.schemaVersion}". Expected one of: ${schema.properties.schemaVersion.enum.join(", ")}`,
    );
  }

  // Check annotations array
  if (!Array.isArray(data.annotations)) {
    errors.push('"annotations" must be an array');
    return errors;
  }

  // Check per-annotation required fields
  const annotationSchema = schema.definitions?.AnnotationRecord;
  const requiredAnnotationFields = annotationSchema?.required ?? [];

  data.annotations.forEach((ann, i) => {
    for (const field of requiredAnnotationFields) {
      if (!(field in ann) || ann[field] === undefined || ann[field] === null) {
        errors.push(`annotations[${i}] missing required field: "${field}"`);
      }
    }
  });

  return errors.length > 0 ? errors : null;
}

/**
 * Checks for sensitive field names in the export data.
 * Data-ux attributes are metadata-only (no secrets) per design, but
 * this catches accidental inclusion.
 */
function checkSensitiveFields(data, filePath) {
  const warnings = [];

  function walk(obj, path) {
    if (!obj || typeof obj !== "object") return;

    if (Array.isArray(obj)) {
      obj.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      const fullPath = `${path}.${key}`;

      // Check the key itself
      for (const pattern of SENSITIVE_PATTERNS) {
        if (pattern.test(key)) {
          const isEmail = pattern === /email/i;
          const msg =
            `${filePath}:${fullPath} — key name matches sensitive pattern "${pattern}". ` +
            "Verify this field does not contain secrets, tokens, or PII.";
          if (isEmail) {
            console.info(`ℹ ${msg}`);
          } else {
            warnings.push(`⚠ ${msg}`);
          }
        }
      }

      // Recurse into nested objects
      if (value && typeof value === "object") {
        walk(value, fullPath);
      }
    }
  }

  walk(data, "root");

  return warnings;
}

/**
 * Validates enum values against the allowed sets.
 */
function checkEnumValues(annotations, filePath) {
  const issues = [];

  annotations.forEach((ann, i) => {
    if (ann.issueType && !VALID_ISSUE_TYPES.includes(ann.issueType)) {
      issues.push(
        `${filePath}: annotations[${i}] — invalid issueType "${ann.issueType}". ` +
          `Valid values: ${VALID_ISSUE_TYPES.join(", ")}`,
      );
    }

    if (ann.severity && !VALID_SEVERITIES.includes(ann.severity)) {
      issues.push(
        `${filePath}: annotations[${i}] — invalid severity "${ann.severity}". ` +
          `Valid values: ${VALID_SEVERITIES.join(", ")}`,
      );
    }
  });

  return issues;
}

/**
 * Validates ISO-8601 date format roughly.
 */
const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/**
 * Checks that date fields on the envelope and each annotation are valid ISO-8601.
 */
function checkEnvelopeDates(data, filePath) {
  const issues = [];

  if (data.generatedAt && !ISO_REGEX.test(data.generatedAt)) {
    issues.push(`${filePath}: envelope — "generatedAt" is not a valid ISO-8601 date: "${data.generatedAt}"`);
  }

  if (Array.isArray(data.annotations)) {
    data.annotations.forEach((ann, i) => {
      if (ann.createdAt && !ISO_REGEX.test(ann.createdAt)) {
        issues.push(`${filePath}: annotations[${i}] — "createdAt" is not a valid ISO-8601 date: "${ann.createdAt}"`);
      }
      if (ann.resolvedAt && !ISO_REGEX.test(ann.resolvedAt)) {
        issues.push(`${filePath}: annotations[${i}] — "resolvedAt" is not a valid ISO-8601 date: "${ann.resolvedAt}"`);
      }
    });
  }

  return issues;
}

// ── Main ────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: node scripts/validate-ux-annotation.mjs <file1.json> [file2.json ...]");
    console.error("  or:  node scripts/validate-ux-annotation.mjs docs/ux-review/*.json");
    process.exit(1);
  }

  const schema = loadSchema();
  let allValid = true;
  let totalFiles = 0;
  let passedFiles = 0;
  let failedFiles = 0;

  for (const arg of args) {
    const filePath = resolve(PROJECT_ROOT, arg);

    if (!existsSync(filePath)) {
      console.error(`✖ File not found: ${filePath}`);
      allValid = false;
      failedFiles++;
      continue;
    }

    totalFiles++;
    let data;

    try {
      data = loadJson(filePath);
    } catch (err) {
      console.error(`✖ ${filePath}: Invalid JSON — ${err.message}`);
      allValid = false;
      failedFiles++;
      continue;
    }

    console.log(`\n── ${filePath} ──`);

    const fileErrors = [];

    // 1. Schema validation
    const schemaErrors = validateWithSchema(data, schema);
    if (schemaErrors) {
      fileErrors.push(...schemaErrors);
    }

    // 2. Sensitive field check
    if (data.annotations) {
      const sensitiveWarnings = checkSensitiveFields(data, filePath);
      sensitiveWarnings.forEach((w) => console.warn(w));

      // 3. Enum validation
      const enumErrors = checkEnumValues(data.annotations, filePath);
      fileErrors.push(...enumErrors);

      // 4. Date format validation
      const dateErrors = checkEnvelopeDates(data, filePath);
      fileErrors.push(...dateErrors);
    }

    // 5. Check _instructions presence
    if (!data._instructions || data._instructions.length < 10) {
      fileErrors.push('Missing or too short "_instructions" field');
    }

    // Report
    if (fileErrors.length > 0) {
      console.error(`✖ ${filePath} — ${fileErrors.length} error(s):`);
      fileErrors.forEach((err) => console.error(`  • ${err}`));
      allValid = false;
      failedFiles++;
    } else {
      console.log(`✓ ${filePath} — valid`);
      passedFiles++;
    }
  }

  // Summary
  console.log(`\n── Summary ──`);
  console.log(`  Total: ${totalFiles}`);
  console.log(`  Passed: ${passedFiles}`);
  console.log(`  Failed: ${failedFiles}`);

  if (!allValid) {
    process.exit(1);
  }
}

main();
