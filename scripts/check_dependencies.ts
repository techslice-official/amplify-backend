import { glob } from 'glob';
import { DependenciesValidator } from './components/dependencies_validator.js';

await new DependenciesValidator(
  await glob('packages/*'),
  {
    'aws-amplify': {
      allowList: ['@aws-amplify/integration-tests'],
    },
    '@aws-amplify/datastore': {
      allowList: ['@aws-amplify/integration-tests'],
    },
    '@aws-amplify/core': {
      allowList: ['@aws-amplify/integration-tests'],
    },
    '@aws-amplify/cli-core': {
      allowList: [
        '@techslice-official/backend-cli',
        '@techslice-official/sandbox',
        'create-amplify',
      ],
    },
  },
  [['aws-cdk', 'aws-cdk-lib']]
).validate();
