import { execa as _execa } from 'execa';
import {
  DependencyType,
  PackageManagerController,
} from './package_manager_controller.js';
import { logger } from './logger.js';

/**
 *
 */
export class NpmPackageManagerController implements PackageManagerController {
  /**
   * Abstraction around npm commands that are needed to initialize a project and install dependencies
   */
  constructor(
    private readonly projectRoot: string,
    private readonly execa = _execa,
  ) {}
  private readonly executableName = 'npm';

  /**
   * Installs the given package names as devDependencies
   */
  installDependencies = async (
    packageNames: string[],
    type: DependencyType
  ): Promise<void> => {
    const args = ['install'].concat(...packageNames);
    if (type === 'dev') {
      args.push('--save-dev');
    }
    args.push(...['--silent', '--quiet']);
    const childProcess = this.execa(this.executableName, args, {
      stdio: 'inherit',
      cwd: this.projectRoot,
    });
    // childProcess.stdout?.setEncoding('utf8');
    // childProcess.stderr?.setEncoding('utf8');
    // childProcess.stdout?.on('data', data => logger.debug(data));
    // // NPM warns statements such as "npm WARN deprecated" are printed here
    // childProcess.stderr?.on('data', data => logger.debug(data));
    await childProcess;
  }
}
