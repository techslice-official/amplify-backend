## API Report File for "@aws-amplify/sandbox"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

// @public (undocumented)
export type Hook = () => Promise<void>;

// @public
export class HookHandler {
    // (undocumented)
    protected postDeploymentHooks: Array<Hook>;
    // (undocumented)
    protected preDeploymentHooks: Array<Hook>;
    // (undocumented)
    registerPostDeploymentHook: (hook: Hook) => void;
    // (undocumented)
    registerPreDeploymentHook: (hook: Hook) => void;
    // (undocumented)
    unregisterPostDeploymentHook: (hook: Hook) => void;
    // (undocumented)
    unregisterPreDeploymentHook: (hook: Hook) => void;
}

// @public
export type Sandbox = {
    start: (options: SandboxOptions) => Promise<void>;
    stop: () => Promise<void>;
    delete: (options: SandboxDeleteOptions) => Promise<void>;
} & HookHandler;

// @public (undocumented)
export type SandboxDeleteOptions = {
    name?: string;
};

// @public (undocumented)
export type SandboxOptions = {
    dir?: string;
    exclude?: string[];
    name?: string;
    profile?: string;
    clientConfigFilePath?: string;
};

// @public
export class SandboxSingletonFactory {
    constructor(sandboxIdResolver: () => Promise<string>);
    getInstance: () => Promise<Sandbox>;
}

// (No @packageDocumentation comment for this package)

```