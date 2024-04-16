import { beforeEach, describe, it, mock } from 'node:test';
import { StorageAccessOrchestrator } from './storage_access_orchestrator.js';
import { ConstructFactoryGetInstanceProps } from '@aws-amplify/plugin-types';
import { App, Stack } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import assert from 'node:assert';
import { entityIdPathToken } from './constants.js';
import { StorageAccessPolicyFactory } from './storage_access_policy_factory.js';

void describe('StorageAccessOrchestrator', () => {
  void describe('orchestrateStorageAccess', () => {
    let stack: Stack;
    let bucket: Bucket;
    let storageAccessPolicyFactory: StorageAccessPolicyFactory;

    const ssmEnvironmentEntriesStub = [
      { name: 'TEST_BUCKET_NAME', path: 'test/ssm/path/to/bucket/name' },
    ];

    beforeEach(() => {
      stack = createStackAndSetContext();

      bucket = new Bucket(stack, 'testBucket');

      storageAccessPolicyFactory = new StorageAccessPolicyFactory(bucket);
    });
    void it('throws if access prefixes are invalid', () => {
      const acceptResourceAccessMock = mock.fn();
      const storageAccessOrchestrator = new StorageAccessOrchestrator(
        () => ({
          'test/prefix/*': [
            {
              actions: ['get', 'write'],
              getResourceAccessAcceptor: () => ({
                identifier: 'testResourceAccessAcceptor',
                acceptResourceAccess: acceptResourceAccessMock,
              }),
              idSubstitution: '*',
            },
          ],
        }),
        {} as unknown as ConstructFactoryGetInstanceProps,
        ssmEnvironmentEntriesStub,
        storageAccessPolicyFactory,
        () => {
          throw new Error('test validation error');
        }
      );

      assert.throws(
        () => storageAccessOrchestrator.orchestrateStorageAccess(),
        { message: 'test validation error' }
      );
    });

    void it('passes expected policy and ssm context to resource access acceptor', () => {
      const acceptResourceAccessMock = mock.fn();
      const storageAccessOrchestrator = new StorageAccessOrchestrator(
        () => ({
          'test/prefix/*': [
            {
              actions: ['get', 'write'],
              getResourceAccessAcceptor: () => ({
                identifier: 'testResourceAccessAcceptor',
                acceptResourceAccess: acceptResourceAccessMock,
              }),
              idSubstitution: '*',
            },
          ],
        }),
        {} as unknown as ConstructFactoryGetInstanceProps,
        ssmEnvironmentEntriesStub,
        storageAccessPolicyFactory
      );

      storageAccessOrchestrator.orchestrateStorageAccess();
      assert.equal(acceptResourceAccessMock.mock.callCount(), 1);
      assert.deepStrictEqual(
        acceptResourceAccessMock.mock.calls[0].arguments[0].document.toJSON(),
        {
          Statement: [
            {
              Action: 's3:GetObject',
              Effect: 'Allow',
              Resource: `${bucket.bucketArn}/test/prefix/*`,
            },
            {
              Action: 's3:PutObject',
              Effect: 'Allow',
              Resource: `${bucket.bucketArn}/test/prefix/*`,
            },
          ],
          Version: '2012-10-17',
        }
      );
      assert.deepStrictEqual(
        acceptResourceAccessMock.mock.calls[0].arguments[1],
        ssmEnvironmentEntriesStub
      );
    });

    void it('handles multiple permissions for the same resource access acceptor', () => {
      const acceptResourceAccessMock = mock.fn();
      const getResourceAccessAcceptorStub = () => ({
        identifier: 'testResourceAccessAcceptor',
        acceptResourceAccess: acceptResourceAccessMock,
      });
      const storageAccessOrchestrator = new StorageAccessOrchestrator(
        () => ({
          'test/prefix/*': [
            {
              actions: ['get', 'write', 'delete'],
              getResourceAccessAcceptor: getResourceAccessAcceptorStub,
              idSubstitution: '*',
            },
          ],
          'another/prefix/*': [
            {
              actions: ['get'],
              getResourceAccessAcceptor: getResourceAccessAcceptorStub,
              idSubstitution: '*',
            },
          ],
        }),
        {} as unknown as ConstructFactoryGetInstanceProps,
        ssmEnvironmentEntriesStub,
        storageAccessPolicyFactory
      );

      storageAccessOrchestrator.orchestrateStorageAccess();
      assert.equal(acceptResourceAccessMock.mock.callCount(), 1);
      assert.deepStrictEqual(
        acceptResourceAccessMock.mock.calls[0].arguments[0].document.toJSON(),
        {
          Statement: [
            {
              Action: 's3:GetObject',
              Effect: 'Allow',
              Resource: [
                `${bucket.bucketArn}/test/prefix/*`,
                `${bucket.bucketArn}/another/prefix/*`,
              ],
            },
            {
              Action: 's3:PutObject',
              Effect: 'Allow',
              Resource: `${bucket.bucketArn}/test/prefix/*`,
            },
            {
              Action: 's3:DeleteObject',
              Effect: 'Allow',
              Resource: `${bucket.bucketArn}/test/prefix/*`,
            },
          ],
          Version: '2012-10-17',
        }
      );
      assert.deepStrictEqual(
        acceptResourceAccessMock.mock.calls[0].arguments[1],
        ssmEnvironmentEntriesStub
      );
    });

    void it('handles multiple resource access acceptors', () => {
      const acceptResourceAccessMock1 = mock.fn();
      const getResourceAccessAcceptorStub1 = () => ({
        identifier: 'testResourceAccessAcceptor1',
        acceptResourceAccess: acceptResourceAccessMock1,
      });
      const acceptResourceAccessMock2 = mock.fn();
      const getResourceAccessAcceptorStub2 = () => ({
        identifier: 'testResourceAccessAcceptor2',
        acceptResourceAccess: acceptResourceAccessMock2,
      });
      const storageAccessOrchestrator = new StorageAccessOrchestrator(
        () => ({
          'test/prefix/*': [
            {
              actions: ['get', 'write', 'delete'],
              getResourceAccessAcceptor: getResourceAccessAcceptorStub1,
              idSubstitution: '*',
            },
            {
              actions: ['get'],
              getResourceAccessAcceptor: getResourceAccessAcceptorStub2,
              idSubstitution: '*',
            },
          ],
          'another/prefix/*': [
            {
              actions: ['get', 'delete'],
              getResourceAccessAcceptor: getResourceAccessAcceptorStub2,
              idSubstitution: '*',
            },
          ],
        }),
        {} as unknown as ConstructFactoryGetInstanceProps,
        ssmEnvironmentEntriesStub,
        storageAccessPolicyFactory
      );

      storageAccessOrchestrator.orchestrateStorageAccess();
      assert.equal(acceptResourceAccessMock1.mock.callCount(), 1);
      assert.deepStrictEqual(
        acceptResourceAccessMock1.mock.calls[0].arguments[0].document.toJSON(),
        {
          Statement: [
            {
              Action: 's3:GetObject',
              Effect: 'Allow',
              Resource: `${bucket.bucketArn}/test/prefix/*`,
            },
            {
              Action: 's3:PutObject',
              Effect: 'Allow',
              Resource: `${bucket.bucketArn}/test/prefix/*`,
            },
            {
              Action: 's3:DeleteObject',
              Effect: 'Allow',
              Resource: `${bucket.bucketArn}/test/prefix/*`,
            },
          ],
          Version: '2012-10-17',
        }
      );
      assert.equal(acceptResourceAccessMock2.mock.callCount(), 1);
      assert.deepStrictEqual(
        acceptResourceAccessMock2.mock.calls[0].arguments[0].document.toJSON(),
        {
          Statement: [
            {
              Action: 's3:GetObject',
              Effect: 'Allow',
              Resource: [
                `${bucket.bucketArn}/test/prefix/*`,
                `${bucket.bucketArn}/another/prefix/*`,
              ],
            },
            {
              Action: 's3:DeleteObject',
              Effect: 'Allow',
              Resource: `${bucket.bucketArn}/another/prefix/*`,
            },
          ],
          Version: '2012-10-17',
        }
      );
      assert.deepStrictEqual(
        acceptResourceAccessMock1.mock.calls[0].arguments[1],
        ssmEnvironmentEntriesStub
      );
      assert.deepStrictEqual(
        acceptResourceAccessMock2.mock.calls[0].arguments[1],
        ssmEnvironmentEntriesStub
      );
    });

    void it('replaces owner placeholder in s3 prefix', () => {
      const acceptResourceAccessMock = mock.fn();
      const storageAccessOrchestrator = new StorageAccessOrchestrator(
        () => ({
          [`test/${entityIdPathToken}/*`]: [
            {
              actions: ['get', 'write'],
              getResourceAccessAcceptor: () => ({
                identifier: 'testResourceAccessAcceptor',
                acceptResourceAccess: acceptResourceAccessMock,
              }),
              idSubstitution: '{testOwnerSub}',
            },
          ],
        }),
        {} as unknown as ConstructFactoryGetInstanceProps,
        ssmEnvironmentEntriesStub,
        storageAccessPolicyFactory
      );

      storageAccessOrchestrator.orchestrateStorageAccess();
      assert.equal(acceptResourceAccessMock.mock.callCount(), 1);
      assert.deepStrictEqual(
        acceptResourceAccessMock.mock.calls[0].arguments[0].document.toJSON(),
        {
          Statement: [
            {
              Action: 's3:GetObject',
              Effect: 'Allow',
              Resource: `${bucket.bucketArn}/test/{testOwnerSub}/*`,
            },
            {
              Action: 's3:PutObject',
              Effect: 'Allow',
              Resource: `${bucket.bucketArn}/test/{testOwnerSub}/*`,
            },
          ],
          Version: '2012-10-17',
        }
      );
      assert.deepStrictEqual(
        acceptResourceAccessMock.mock.calls[0].arguments[1],
        ssmEnvironmentEntriesStub
      );
    });

    void it('denies parent actions on a subpath by default', () => {
      const acceptResourceAccessMock1 = mock.fn();
      const acceptResourceAccessMock2 = mock.fn();
      const storageAccessOrchestrator = new StorageAccessOrchestrator(
        () => ({
          'foo/*': [
            {
              actions: ['get', 'write'],
              getResourceAccessAcceptor: () => ({
                identifier: 'resourceAccessAcceptor1',
                acceptResourceAccess: acceptResourceAccessMock1,
              }),
              idSubstitution: '*',
            },
          ],
          'foo/bar/*': [
            {
              actions: ['get'],
              getResourceAccessAcceptor: () => ({
                identifier: 'resourceAccessAcceptor2',
                acceptResourceAccess: acceptResourceAccessMock2,
              }),
              idSubstitution: '*',
            },
          ],
        }),
        {} as unknown as ConstructFactoryGetInstanceProps,
        ssmEnvironmentEntriesStub,
        storageAccessPolicyFactory
      );

      storageAccessOrchestrator.orchestrateStorageAccess();
      assert.equal(acceptResourceAccessMock1.mock.callCount(), 1);
      assert.deepStrictEqual(
        acceptResourceAccessMock1.mock.calls[0].arguments[0].document.toJSON(),
        {
          Statement: [
            {
              Action: 's3:GetObject',
              Effect: 'Allow',
              Resource: `${bucket.bucketArn}/foo/*`,
            },
            {
              Action: 's3:GetObject',
              Effect: 'Deny',
              Resource: `${bucket.bucketArn}/foo/bar/*`,
            },
            {
              Action: 's3:PutObject',
              Effect: 'Allow',
              Resource: `${bucket.bucketArn}/foo/*`,
            },
            {
              Action: 's3:PutObject',
              Effect: 'Deny',
              Resource: `${bucket.bucketArn}/foo/bar/*`,
            },
          ],
          Version: '2012-10-17',
        }
      );
      assert.deepStrictEqual(
        acceptResourceAccessMock1.mock.calls[0].arguments[1],
        ssmEnvironmentEntriesStub
      );

      assert.equal(acceptResourceAccessMock2.mock.callCount(), 1);
      assert.deepStrictEqual(
        acceptResourceAccessMock2.mock.calls[0].arguments[0].document.toJSON(),
        {
          Statement: [
            {
              Action: 's3:GetObject',
              Effect: 'Allow',
              Resource: `${bucket.bucketArn}/foo/bar/*`,
            },
          ],
          Version: '2012-10-17',
        }
      );
    });

    void it('combines owner rules for same resource access acceptor', () => {
      const acceptResourceAccessMock = mock.fn();
      const authenticatedResourceAccessAcceptor = () => ({
        identifier: 'authenticatedResourceAccessAcceptor',
        acceptResourceAccess: acceptResourceAccessMock,
      });

      const storageAccessOrchestrator = new StorageAccessOrchestrator(
        () => ({
          'foo/{entity_id}/*': [
            {
              actions: ['write', 'delete'],
              getResourceAccessAcceptor: authenticatedResourceAccessAcceptor,
              idSubstitution: '{idSub}',
            },
            {
              actions: ['get'],
              getResourceAccessAcceptor: authenticatedResourceAccessAcceptor,
              idSubstitution: '*',
            },
          ],
        }),
        {} as unknown as ConstructFactoryGetInstanceProps,
        ssmEnvironmentEntriesStub,
        storageAccessPolicyFactory
      );

      storageAccessOrchestrator.orchestrateStorageAccess();
      assert.equal(acceptResourceAccessMock.mock.callCount(), 1);
      assert.deepStrictEqual(
        acceptResourceAccessMock.mock.calls[0].arguments[0].document.toJSON(),
        {
          Statement: [
            {
              Action: 's3:PutObject',
              Effect: 'Allow',
              Resource: `${bucket.bucketArn}/foo/{idSub}/*`,
            },
            {
              Action: 's3:DeleteObject',
              Effect: 'Allow',
              Resource: `${bucket.bucketArn}/foo/{idSub}/*`,
            },
            {
              Action: 's3:GetObject',
              Effect: 'Allow',
              Resource: `${bucket.bucketArn}/foo/*/*`,
            },
          ],
          Version: '2012-10-17',
        }
      );
      assert.deepStrictEqual(
        acceptResourceAccessMock.mock.calls[0].arguments[1],
        ssmEnvironmentEntriesStub
      );
    });

    void it('handles multiple resource access acceptors on multiple prefixes', () => {
      const acceptResourceAccessMock1 = mock.fn();
      const acceptResourceAccessMock2 = mock.fn();
      const getResourceAccessAcceptorStub1 = () => ({
        identifier: 'resourceAccessAcceptor1',
        acceptResourceAccess: acceptResourceAccessMock1,
      });
      const getResourceAccessAcceptorStub2 = () => ({
        identifier: 'resourceAccessAcceptor2',
        acceptResourceAccess: acceptResourceAccessMock2,
      });

      const storageAccessOrchestrator = new StorageAccessOrchestrator(
        () => ({
          // acceptor1 should have read write on this path
          // acceptor2 should not have any rules for this path
          'foo/*': [
            {
              actions: ['get', 'write'],
              getResourceAccessAcceptor: getResourceAccessAcceptorStub1,
              idSubstitution: '*',
            },
          ],
          // acceptor1 should be denied read and write on this path
          // acceptor2 should have only read on this path
          'foo/bar/*': [
            {
              actions: ['get'],
              getResourceAccessAcceptor: getResourceAccessAcceptorStub2,
              idSubstitution: '{idSub}',
            },
          ],
          // acceptor1 should be denied write on this path (read from parent path covers read on this path)
          // acceptor2 should not have any rules for this path
          'foo/baz/*': [
            {
              actions: ['get'],
              idSubstitution: '*',
              getResourceAccessAcceptor: getResourceAccessAcceptorStub1,
            },
          ],
          // acceptor 1 is denied write on this path (read still allowed)
          // acceptor 2 has read/write/delete on path with ownerSub
          'other/{entity_id}/*': [
            {
              actions: ['get', 'write', 'delete'],
              getResourceAccessAcceptor: getResourceAccessAcceptorStub2,
              idSubstitution: '{idSub}',
            },
            {
              actions: ['get'],
              getResourceAccessAcceptor: getResourceAccessAcceptorStub1,
              idSubstitution: '*',
            },
          ],
        }),
        {} as unknown as ConstructFactoryGetInstanceProps,
        ssmEnvironmentEntriesStub,
        storageAccessPolicyFactory
      );

      storageAccessOrchestrator.orchestrateStorageAccess();
      assert.equal(acceptResourceAccessMock1.mock.callCount(), 1);
      assert.deepStrictEqual(
        acceptResourceAccessMock1.mock.calls[0].arguments[0].document.toJSON(),
        {
          Statement: [
            {
              Action: 's3:GetObject',
              Effect: 'Allow',
              Resource: [
                `${bucket.bucketArn}/foo/*`,
                `${bucket.bucketArn}/other/*/*`,
              ],
            },
            {
              Action: 's3:GetObject',
              Effect: 'Deny',
              Resource: `${bucket.bucketArn}/foo/bar/*`,
            },
            {
              Action: 's3:PutObject',
              Effect: 'Allow',
              Resource: `${bucket.bucketArn}/foo/*`,
            },
            {
              Action: 's3:PutObject',
              Effect: 'Deny',
              Resource: [
                `${bucket.bucketArn}/foo/bar/*`,
                `${bucket.bucketArn}/foo/baz/*`,
              ],
            },
          ],
          Version: '2012-10-17',
        }
      );
      assert.deepStrictEqual(
        acceptResourceAccessMock1.mock.calls[0].arguments[1],
        ssmEnvironmentEntriesStub
      );

      assert.equal(acceptResourceAccessMock2.mock.callCount(), 1);
      assert.deepStrictEqual(
        acceptResourceAccessMock2.mock.calls[0].arguments[0].document.toJSON(),
        {
          Statement: [
            {
              Action: 's3:GetObject',
              Effect: 'Allow',
              Resource: [
                `${bucket.bucketArn}/foo/bar/*`,
                `${bucket.bucketArn}/other/{idSub}/*`,
              ],
            },
            {
              Action: 's3:PutObject',
              Effect: 'Allow',
              Resource: `${bucket.bucketArn}/other/{idSub}/*`,
            },
            {
              Action: 's3:DeleteObject',
              Effect: 'Allow',
              Resource: `${bucket.bucketArn}/other/{idSub}/*`,
            },
          ],
          Version: '2012-10-17',
        }
      );
    });

    void it('combines actions from multiple rules on the same resource access acceptor', () => {
      const acceptResourceAccessMock = mock.fn();
      const authenticatedResourceAccessAcceptor = () => ({
        identifier: 'authenticatedResourceAccessAcceptor',
        acceptResourceAccess: acceptResourceAccessMock,
      });

      const storageAccessOrchestrator = new StorageAccessOrchestrator(
        () => ({
          'foo/*': [
            {
              actions: ['get'],
              getResourceAccessAcceptor: authenticatedResourceAccessAcceptor,
              idSubstitution: '*',
            },
            {
              actions: ['write'],
              getResourceAccessAcceptor: authenticatedResourceAccessAcceptor,
              idSubstitution: '{idSub}',
            },
            {
              actions: ['delete'],
              getResourceAccessAcceptor: authenticatedResourceAccessAcceptor,
              idSubstitution: '*',
            },
          ],
        }),
        {} as unknown as ConstructFactoryGetInstanceProps,
        ssmEnvironmentEntriesStub,
        storageAccessPolicyFactory
      );

      storageAccessOrchestrator.orchestrateStorageAccess();
      assert.equal(acceptResourceAccessMock.mock.callCount(), 1);
      assert.deepStrictEqual(
        acceptResourceAccessMock.mock.calls[0].arguments[0].document.toJSON(),
        {
          Statement: [
            {
              Action: 's3:GetObject',
              Effect: 'Allow',
              Resource: `${bucket.bucketArn}/foo/*`,
            },
            {
              Action: 's3:PutObject',
              Effect: 'Allow',
              Resource: `${bucket.bucketArn}/foo/*`,
            },
            {
              Action: 's3:DeleteObject',
              Effect: 'Allow',
              Resource: `${bucket.bucketArn}/foo/*`,
            },
          ],
          Version: '2012-10-17',
        }
      );
      assert.deepStrictEqual(
        acceptResourceAccessMock.mock.calls[0].arguments[1],
        ssmEnvironmentEntriesStub
      );
    });

    void it('replaces "read" access with "get" and "list" and merges duplicate actions', () => {
      const acceptResourceAccessMock = mock.fn();
      const authenticatedResourceAccessAcceptor = () => ({
        identifier: 'authenticatedResourceAccessAcceptor',
        acceptResourceAccess: acceptResourceAccessMock,
      });

      const storageAccessOrchestrator = new StorageAccessOrchestrator(
        () => ({
          'foo/bar/*': [
            {
              actions: ['read', 'get', 'list'],
              getResourceAccessAcceptor: authenticatedResourceAccessAcceptor,
              idSubstitution: '*',
            },
            {
              actions: ['list'],
              getResourceAccessAcceptor: authenticatedResourceAccessAcceptor,
              idSubstitution: '*',
            },
          ],
          'other/baz/*': [
            {
              actions: ['read'],
              getResourceAccessAcceptor: authenticatedResourceAccessAcceptor,
              idSubstitution: '*',
            },
          ],
        }),
        {} as unknown as ConstructFactoryGetInstanceProps,
        ssmEnvironmentEntriesStub,
        storageAccessPolicyFactory
      );

      storageAccessOrchestrator.orchestrateStorageAccess();
      assert.equal(acceptResourceAccessMock.mock.callCount(), 1);
      assert.deepStrictEqual(
        acceptResourceAccessMock.mock.calls[0].arguments[0].document.toJSON(),
        {
          Statement: [
            {
              Action: 's3:GetObject',
              Effect: 'Allow',
              Resource: [
                `${bucket.bucketArn}/foo/bar/*`,
                `${bucket.bucketArn}/other/baz/*`,
              ],
            },
            {
              Action: 's3:ListBucket',
              Effect: 'Allow',
              Resource: bucket.bucketArn,
              Condition: {
                StringLike: {
                  's3:prefix': [
                    'foo/bar/*',
                    'foo/bar/',
                    'other/baz/*',
                    'other/baz/',
                  ],
                },
              },
            },
          ],
          Version: '2012-10-17',
        }
      );
      assert.deepStrictEqual(
        acceptResourceAccessMock.mock.calls[0].arguments[1],
        ssmEnvironmentEntriesStub
      );
    });
  });
});

const createStackAndSetContext = (): Stack => {
  const app = new App();
  app.node.setContext('amplify-backend-name', 'testEnvName');
  app.node.setContext('amplify-backend-namespace', 'testBackendId');
  app.node.setContext('amplify-backend-type', 'branch');
  const stack = new Stack(app);
  return stack;
};
