import { glob } from 'glob';
import path from 'path';
import assert from 'node:assert';
import * as fse from 'fs-extra/esm';
import * as fs from 'fs';

const UPDATE_SNAPSHOTS = process.env.UPDATE_INTEGRATION_SNAPSHOTS === 'true';

/**
 * Essentially a snapshot validator.
 *
 * It checks that actualDir and expectedDir have the same files (ignoring ignoreFiles defined below)
 * It then checks that all JSON files parse to identical objects
 * It fails if a non-JSON file is found
 * @param actualDir The actual cdk synth output generated by the test
 * @param expectedDir The expected cdk synth output
 */
export const validateCdkOutDir = async (
  actualDir: string,
  expectedDir: string
) => {
  // These are CDK internal bookkeeping files that change across minor versions of CDK.
  // We only care about validating the CFN templates
  const ignoreFiles = ['tree.json', 'cdk.out', 'manifest.json'];

  const actualPaths = await glob(path.join(actualDir, '*'));
  const expectedPaths = await glob(path.join(expectedDir, '*'));

  /**
   * Filter out ignoreFiles and sort
   */
  const normalize = (paths: string[]) =>
    paths
      .filter((p) => !ignoreFiles.some((ignoreFile) => p.endsWith(ignoreFile)))
      .filter((p) => !path.basename(p).startsWith('asset.'))
      .sort();

  const normalizedActualPaths = normalize(actualPaths);
  const normalizedExpectedPaths = normalize(expectedPaths);

  if (UPDATE_SNAPSHOTS) {
    normalizedActualPaths.forEach((actualPath) => {
      const destination = path.resolve(expectedDir, path.basename(actualPath));
      fse.copySync(actualPath, destination);
    });
    return;
  }

  assert.deepStrictEqual(
    normalizedActualPaths.map((fileName) => path.basename(fileName)),
    normalizedExpectedPaths.map((fileName) => path.basename(fileName))
  );

  // check that JSON files parse to the same object
  for (let i = 0; i < normalizedActualPaths.length; i++) {
    const actualFile = normalizedActualPaths[i];
    const expectedFile = normalizedExpectedPaths[i];
    if (path.extname(normalizedActualPaths[i]) !== '.json') {
      assert.fail(`Unknown file type ${actualFile}`);
    }
    const actualObj = JSON.parse(fs.readFileSync(actualFile, 'utf-8'));
    const expectedObj = JSON.parse(fs.readFileSync(expectedFile, 'utf-8'));
    assert.deepStrictEqual(actualObj, expectedObj);
  }
};