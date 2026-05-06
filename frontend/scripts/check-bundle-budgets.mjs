import { gzipSync } from 'node:zlib';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST_ASSETS_DIR = fileURLToPath(new URL('../dist/assets/', import.meta.url));

const BUDGETS = {
  initialJsRaw: 510_000,
  initialJsGzip: 160_000,
  appShellRaw: 85_000,
  appShellGzip: 27_000,
  largestJsRaw: 205_000,
  largestJsGzip: 65_000,
  routeChunkRaw: 100_000,
  routeChunkGzip: 25_000,
  cssRaw: 300_000,
  cssGzip: 40_000,
};

/**
 * Format a byte count as a kilobyte value for build output.
 * @param bytes - Byte count.
 * @returns Human-readable kilobyte value.
 */
function formatKilobytes(bytes) {
  return `${(bytes / 1000).toFixed(2)} kB`;
}

/**
 * Calculate gzip-compressed size for an asset buffer.
 * @param buffer - Asset bytes.
 * @returns Compressed byte count.
 */
function gzipSize(buffer) {
  return gzipSync(buffer, { level: 9 }).byteLength;
}

/**
 * Read production build assets into size records.
 * @returns {Promise<Array<{name: string, raw: number, gzip: number}>>}
 * Asset records with raw and gzip sizes.
 */
async function readAssetRecords() {
  const names = await readdir(DIST_ASSETS_DIR);
  return Promise.all(
    names.map(async (name) => {
      const buffer = await readFile(join(DIST_ASSETS_DIR, name));
      return {
        name,
        raw: buffer.byteLength,
        gzip: gzipSize(buffer),
      };
    }),
  );
}

/**
 * Sum raw and gzip sizes for a set of asset records.
 * @param {Array<{raw: number, gzip: number}>} records - Asset records.
 * @returns {{raw: number, gzip: number}} Combined raw and gzip size.
 */
function sumRecords(records) {
  return records.reduce(
    (total, record) => ({
      raw: total.raw + record.raw,
      gzip: total.gzip + record.gzip,
    }),
    { raw: 0, gzip: 0 },
  );
}

/**
 * Track whether a metric is over budget and print a readable line.
 * @param {string} label - Metric label.
 * @param {number} actual - Actual byte count.
 * @param {number} budget - Budget byte count.
 * @param {string[]} failures - Mutable failure list.
 */
function assertBudget(label, actual, budget, failures) {
  const status = actual <= budget ? 'OK' : 'OVER';
  process.stdout.write(
    `${status.padEnd(4)} ${label.padEnd(24)} ${formatKilobytes(actual)} / ${formatKilobytes(budget)}\n`,
  );
  if (actual > budget) {
    failures.push(`${label}: ${formatKilobytes(actual)} > ${formatKilobytes(budget)}`);
  }
}

/**
 * Check production bundle assets against ForgeFrame budgets.
 * @returns {Promise<void>} Resolves when budgets pass.
 * @throws {Error} If build assets are missing or malformed.
 */
async function main() {
  const records = await readAssetRecords();
  const jsRecords = records.filter((record) => record.name.endsWith('.js'));
  const cssRecords = records.filter((record) => record.name.endsWith('.css'));
  const appShell = jsRecords.find((record) => record.name.startsWith('index-'));
  const initialJs = jsRecords.filter(
    (record) => record.name.startsWith('index-') || record.name.startsWith('vendor-'),
  );
  const routeChunks = jsRecords.filter(
    (record) => !record.name.startsWith('index-') && !record.name.startsWith('vendor-'),
  );
  const largestJs = [...jsRecords].sort((left, right) => right.raw - left.raw)[0];

  if (!appShell || !largestJs) {
    throw new Error('No production JavaScript chunks found. Run npm run build first.');
  }

  const initialTotals = sumRecords(initialJs);
  const cssTotals = sumRecords(cssRecords);
  const largestRouteChunk = [...routeChunks].sort((left, right) => right.raw - left.raw)[0];
  const failures = [];

  process.stdout.write('ForgeFrame bundle budget check\n');
  assertBudget('initial JS raw', initialTotals.raw, BUDGETS.initialJsRaw, failures);
  assertBudget('initial JS gzip', initialTotals.gzip, BUDGETS.initialJsGzip, failures);
  assertBudget('app shell raw', appShell.raw, BUDGETS.appShellRaw, failures);
  assertBudget('app shell gzip', appShell.gzip, BUDGETS.appShellGzip, failures);
  assertBudget('largest JS raw', largestJs.raw, BUDGETS.largestJsRaw, failures);
  assertBudget('largest JS gzip', largestJs.gzip, BUDGETS.largestJsGzip, failures);
  assertBudget('CSS raw', cssTotals.raw, BUDGETS.cssRaw, failures);
  assertBudget('CSS gzip', cssTotals.gzip, BUDGETS.cssGzip, failures);

  if (largestRouteChunk) {
    assertBudget(
      `route raw ${largestRouteChunk.name}`,
      largestRouteChunk.raw,
      BUDGETS.routeChunkRaw,
      failures,
    );
    assertBudget(
      `route gzip ${largestRouteChunk.name}`,
      largestRouteChunk.gzip,
      BUDGETS.routeChunkGzip,
      failures,
    );
  }

  if (failures.length > 0) {
    process.stderr.write(`\nBundle budgets exceeded:\n- ${failures.join('\n- ')}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write('\nBundle budgets passed.\n');
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
