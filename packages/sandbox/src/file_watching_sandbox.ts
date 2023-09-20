import debounce from 'debounce-promise';
import parcelWatcher, { subscribe } from '@parcel/watcher';
import { AmplifySandboxExecutor } from './sandbox_executor.js';
import { Sandbox, SandboxDeleteOptions, SandboxOptions } from './sandbox.js';
import parseGitIgnore from 'parse-gitignore';
import path from 'path';
import fs from 'fs';
import { Hook, HookHandler } from './hook_handler.js';

/**
 * Runs a file watcher and deploys
 */
export class FileWatchingSandbox extends HookHandler implements Sandbox {
  private watcherSubscription: Awaited<ReturnType<typeof subscribe>>;
  private outputFilesExcludedFromWatch = ['cdk.out'];
  /**
   * Creates a watcher process for this instance
   */
  constructor(
    private readonly sandboxId: string,
    private readonly executor: AmplifySandboxExecutor
  ) {
    process.once('SIGINT', () => void this.stop());
    process.once('SIGTERM', () => void this.stop());
    super();
  }

  /**
   * @inheritdoc
   */
  start = async (options: SandboxOptions) => {
    const { profile } = options;
    if (profile) {
      process.env.AWS_PROFILE = profile;
    }
    const sandboxId = options.name ?? this.sandboxId;

    const ignoredPaths = this.getGitIgnoredPaths();
    this.outputFilesExcludedFromWatch =
      this.outputFilesExcludedFromWatch.concat(...ignoredPaths);

    console.debug(`[Sandbox] Initializing...`);
    // Since 'cdk deploy' is a relatively slow operation for a 'watch' process,
    // introduce a concurrency latch that tracks the state.
    // This way, if file change events arrive when a 'cdk deploy' is still executing,
    // we will batch them, and trigger another 'cdk deploy' after the current one finishes,
    // making sure 'cdk deploy's  always execute one at a time.
    // Here's a diagram showing the state transitions:

    // --------    file changed     --------------    file changed     --------------  file changed
    // |      | ------------------> |            | ------------------> |            | --------------|
    // | open |                     | deploying  |                     |   queued   |               |
    // |      | <------------------ |            | <------------------ |            | <-------------|
    // --------  'cdk deploy' done  --------------  'cdk deploy' done  --------------

    let latch: 'open' | 'deploying' | 'queued' = 'open';

    const deployAndWatch = debounce(async () => {
      console.log('[Sandbox] Running pre-deployment hooks');
      await this.runHooks(this.preDeploymentHooks);
      console.log('[Sandbox] Pre-deployment hooks complete');
      latch = 'deploying';
      await this.executor.deploy({
        backendId: sandboxId,
        branchName: 'sandbox',
      });

      // If latch is still 'deploying' after the 'await', that's fine,
      // but if it's 'queued', that means we need to deploy again
      while ((latch as 'deploying' | 'queued') === 'queued') {
        // TypeScript doesn't realize latch can change between 'awaits' ¯\_(ツ)_/¯,
        // and thinks the above 'while' condition is always 'false' without the cast
        latch = 'deploying';
        console.log(
          "[Sandbox] Detected file changes while previous deployment was in progress. Invoking 'sandbox' again"
        );
        await this.executor.deploy({
          backendId: sandboxId,
          branchName: 'sandbox',
        });
      }
      latch = 'open';
      this.emitWatching();
      console.log('[Sandbox] Running post-deployment hooks');
      await this.runHooks(this.postDeploymentHooks);
      console.log('[Sandbox] Post-deployment hooks complete');
    });

    this.watcherSubscription = await parcelWatcher.subscribe(
      options.dir ?? process.cwd(),
      async (_, events) => {
        // it doesn't matter which file changed, we are just using events to log the filenames. We deploy full state.
        await Promise.all(
          events.map(({ type: eventName, path }) => {
            console.log(
              `[Sandbox] Triggered due to a file ${eventName} event: ${path}`
            );
          })
        );
        if (latch === 'open') {
          await deployAndWatch();
        } else {
          // this means latch is either 'deploying' or 'queued'
          latch = 'queued';
          console.log(
            '[Sandbox] Previous deployment is still in progress. ' +
              'Will queue for another deployment after this one finishes'
          );
        }
      },
      {
        ignore: this.outputFilesExcludedFromWatch.concat(
          ...(options.exclude ?? [])
        ),
      }
    );

    // Start the first full deployment without waiting for a file change
    await deployAndWatch();
  };
  private runHooks = async (hooks: Hook[]) => {
    return Promise.all(hooks.map((hook) => hook()));
  };

  /**
   * @inheritdoc
   */
  stop = async () => {
    console.debug(`[Sandbox] Shutting down`);
    await this.watcherSubscription.unsubscribe();
  };

  /**
   * @inheritdoc
   */
  delete = async (options: SandboxDeleteOptions) => {
    const sandboxAppId = options.name ?? this.sandboxId;
    console.log(
      '[Sandbox] Deleting all the resources in the sandbox environment...'
    );
    await this.executor.destroy({
      backendId: sandboxAppId,
      branchName: 'sandbox',
    });
    console.log('[Sandbox] Finished deleting.');
  };

  /**
   * Just a shorthand console log to indicate whenever watcher is going idle
   */
  private emitWatching = () => {
    console.log(`[Sandbox] Watching for file changes...`);
  };

  /**
   * Reads and parses .gitignore file and returns the list of paths
   */
  private getGitIgnoredPaths = () => {
    const gitIgnoreFilePath = path.join(process.cwd(), '.gitignore');
    if (fs.existsSync(gitIgnoreFilePath)) {
      return parseGitIgnore
        .parse(gitIgnoreFilePath)
        .patterns.map((pattern: string) =>
          pattern.startsWith('/') ? pattern.substring(1) : pattern
        );
    }
    return [];
  };
}