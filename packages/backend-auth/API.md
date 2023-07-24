## API Report File for "@aws-amplify/backend-auth"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

import { AmplifyAuth } from '@aws-amplify/auth-construct';
import { AmplifyAuthProps } from '@aws-amplify/auth-construct';
import { AuthResources } from '@aws-amplify/plugin-types';
import { ConstructFactory } from '@aws-amplify/plugin-types';
import { ConstructFactoryGetInstanceProps } from '@aws-amplify/plugin-types';

// @public
export class AmplifyAuthFactory implements ConstructFactory<AmplifyAuth & AuthResources> {
    constructor(props: AmplifyAuthProps);
    getInstance({ constructContainer, outputStorageStrategy, importPathVerifier, }: ConstructFactoryGetInstanceProps): AmplifyAuth;
    // (undocumented)
    readonly provides = "AuthResources";
}

// @public
export const Auth: typeof AmplifyAuthFactory;

// (No @packageDocumentation comment for this package)

```