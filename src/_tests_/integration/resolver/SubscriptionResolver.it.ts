import { ApolloClient, gql, NormalizedCacheObject } from 'apollo-boost';
import * as cassandra from 'cassandra-driver';
import * as fs from 'fs';
import 'reflect-metadata';
import { logger } from '../../../logger';
import { ChannelFrequencies, Role, State } from '../../../models/enums';
import { SubscriptionId } from '../../../models/SubscriptionId';
import { SubscriptionInput } from '../../../models/SubscriptionInput';
import { cassandraDBHelpers } from '../../../repo/cassandraDBHelpers';
import {
  deleteSubscriptionQuery,
  deleteUserSubscriptionQuery,
  selectSubscriptionQuery,
  subscriptionIdPKeyValues,
} from '../../../repo/SubscriptionRepoQueries';
import { getGraphQlTestClient } from '../../utils/fn-tests-utils';

const getSubscriptionsGql = fs.readFileSync('test_resources/subscriptions.gql').toString();
const getSubscriptionsNoStateGql = fs.readFileSync(
  'test_resources/subscriptions_optionalState.gql').toString();
const subscribeGql = fs.readFileSync('test_resources/subscribe.gql').toString();
const unsubscribeGql = fs.readFileSync('test_resources/unsubscribe.gql').toString();
const updateSubscriptionGql = fs.readFileSync('test_resources/updateSubscription.gql').toString();
const deleteSubscriptionGql = fs.readFileSync('test_resources/delete.gql').toString();
const gqlTestClient: ApolloClient<NormalizedCacheObject> = getGraphQlTestClient(
  { email: 'martin.hablak@sk.ibm.com', id: 'A24876693' });

const APP_ID = 'w3notifications-test';
const USER_ID = 'A24876693';
const ARTIFACT_DATE = '2019-07-03T16:17:22.790Z';

const subscriptionId: SubscriptionId = {
  appId: APP_ID,
  artifactId: {
    elements: [{ id: 'cio' }, { id: 'blog' }],
  },
  userId: USER_ID,
  state: State.ACTIVE,
};

const subscriptionIdOptionalWebBell: SubscriptionId = {
  appId: APP_ID,
  artifactId: {
    elements: [{ id: 'cio_test' }, { id: 'blog_test' }],
  },
  userId: USER_ID,
  state: State.ACTIVE,
};

const inactiveSubscriptionId = { ...subscriptionId, state: State.INACTIVE };

const subscriptionInput: SubscriptionInput = {
  appId: APP_ID,
  artifact: {
    elements: [
      {
        artifactIdElement: { id: 'cio' },
        title: 'CIO',
        artifactDate: ARTIFACT_DATE,
      },
      {
        artifactIdElement: { id: 'blog' },
        title: 'Blog',
        artifactDate: ARTIFACT_DATE,
      },
    ],
  },
  channelSettings: {
    email: {
      frequency: ChannelFrequencies.DAILY,
    },
    webBell: {
      frequency: ChannelFrequencies.NA,
    },
  },
  role: Role.AUTHOR,
  userId: USER_ID,
  subscriptionType: 'blog',
};

const subscriptionInputOptionalWebBell: SubscriptionInput = {
  appId: APP_ID,
  artifact: {
    elements: [
      {
        artifactIdElement: { id: 'cio_test' },
        title: 'CIO',
        artifactDate: ARTIFACT_DATE,
      },
      {
        artifactIdElement: { id: 'blog_test' },
        title: 'Blog',
        artifactDate: ARTIFACT_DATE,
      },
    ],
  },
  channelSettings: {
    email: {
      frequency: ChannelFrequencies.DAILY,
    },
  },
  role: Role.AUTHOR,
  userId: USER_ID,
  subscriptionType: 'blog',
};

async function subscribe(input: SubscriptionInput): Promise<any> {
  return gqlTestClient.mutate({
    mutation: gql(subscribeGql),
    variables: {
      subscriptionInput: input,
    },
  });
}

async function cleanUpSubscription(id: SubscriptionId): Promise<void> {
  await cassandraDBHelpers.execute(
    deleteSubscriptionQuery,
    subscriptionIdPKeyValues(id),
  );
  await cassandraDBHelpers.execute(
    deleteUserSubscriptionQuery,
    subscriptionIdPKeyValues(id),
  );
}

describe('Subscription resolvers', () => {
  describe('unsubscribe', () => {
    beforeAll(async () => {
      await subscribe(subscriptionInput);
      await gqlTestClient.mutate({
        mutation: gql(unsubscribeGql),
        variables: {
          subscriptionId,
        },
      });
    });

    afterAll(async () => {
      await cleanUpSubscription(inactiveSubscriptionId);
    });

    it('read inactive subscriptions', async () => {
      const response = await gqlTestClient.query({
        query: gql(getSubscriptionsGql),
        variables: {
          appId:APP_ID,
          userId:USER_ID,
          role: Role.AUTHOR,
          states: 'INACTIVE',
          artifactIds: {
            elements: [
              {
                id: 'cio',
              },
              {
                id: 'blog',
              }],
          },
        },
      });
      expect(response.data.subscriptions).toBeDefined();
      const subscriptionArray = response.data.subscriptions;
      expect(subscriptionArray[0].appId).toEqual(subscriptionInput.appId);
      expect(subscriptionArray[0].userId).toEqual(subscriptionInput.userId);
      expect(subscriptionArray[0].subscriptionType).toEqual(subscriptionInput.subscriptionType);
      expect(subscriptionArray[0].state).toEqual('INACTIVE');
      expect(subscriptionArray[0].artifact.elements.length).toEqual(2);
      [0, 1].map((idx: number) => {
        expect(subscriptionArray[0].artifact.elements[idx].title)
          .toEqual(subscriptionInput.artifact.elements[idx].title);
        expect(subscriptionArray[0].artifact.elements[idx].artifactIdElement.id)
          .toEqual(subscriptionInput.artifact.elements[idx].artifactIdElement.id);
        expect(
          subscriptionArray[0].channelSettings.email.frequency,
        ).toEqual(
          subscriptionInput.channelSettings.email.frequency,
        );
      });
    });

    it('should not read inactive subscriptions with no state filter', async () => {
      const response = await gqlTestClient.query({
        query: gql(getSubscriptionsNoStateGql),
        variables: {
          appId: APP_ID,
          userId:USER_ID,
          role: Role.AUTHOR,
          artifactIds: {
            elements: [
              {
                id: 'cio',
              },
              {
                id: 'blog',
              }],
          },
        },
      });
      expect(response.data.subscriptions).toBeDefined();
      const subscriptionArray = response.data.subscriptions;
      expect(subscriptionArray.length).toEqual(0);
    });
  });

  describe('subscribe feature', () => {
    it('should subscribe user with optional webBell', async () => {
      let response: any;
      try {
        response = await subscribe(subscriptionInputOptionalWebBell);
      } catch (err) {
        logger.error(`Error in subscribe feature: ${JSON.stringify(err)}`);
      }
      expect(response.data.subscribe).toBeDefined();
      const subscription = response.data.subscribe;
      expect(subscription.appId).toEqual(subscriptionInputOptionalWebBell.appId);
      expect(subscription.userId).toEqual(subscriptionInputOptionalWebBell.userId);
      expect(subscription.subscriptionType).toEqual(subscriptionInputOptionalWebBell.subscriptionType);
      expect(subscription.artifact.elements.length).toEqual(2);
      [0, 1].map((idx: number) => {
        expect(subscription.artifact.elements[idx].title)
          .toEqual(subscriptionInputOptionalWebBell.artifact.elements[idx].title);
        expect(subscription.artifact.elements[idx].artifactIdElement.id)
          .toEqual(subscriptionInputOptionalWebBell.artifact.elements[idx].artifactIdElement.id);
        expect(
          subscription.channelSettings.email.frequency,
        ).toEqual(
          subscriptionInputOptionalWebBell.channelSettings.email.frequency,
        );
        expect(
          subscription.channelSettings.webBell,
        ).toBeNull();
      });
      await cleanUpSubscription(subscriptionIdOptionalWebBell);
    });
  });

  describe('update subscription', () => {
    it('should change subscription settings', async () => {
      await subscribe(subscriptionInput);

      const updatedArtifact = {
        elements: [
          {
            artifactIdElement: { id: 'cio' },
            title: 'CIO',
            artifactDate: ARTIFACT_DATE,
          },
          {
            artifactIdElement: { id: 'blog' },
            title: 'Blog',
            artifactDate: ARTIFACT_DATE,
          },
        ],
      };
      const updatedInput: SubscriptionInput = {
        ...subscriptionInput,
        artifact: updatedArtifact,
      };

      const result = await gqlTestClient.mutate({
        mutation: gql(updateSubscriptionGql),
        variables: {
          subscriptionInput: updatedInput,
        },
      });
      const updatedSubscription = result.data.updateSubscription;
      expect(updatedSubscription[0].channelSettings.email.frequency)
          .toEqual(updatedInput.channelSettings.email.frequency);
      if (updatedInput.channelSettings.webBell) {
        expect(updatedSubscription[0].channelSettings.webBell.frequency)
        .toEqual(updatedInput.channelSettings.webBell.frequency);
      }
      await cleanUpSubscription(subscriptionId);
    });
  });

  describe('remove subscription feature', () => {
    beforeAll(async () => {
      await subscribe(subscriptionInput);
      await gqlTestClient.mutate({
        mutation: gql(deleteSubscriptionGql),
        variables: {
          appId:APP_ID,
          userId:USER_ID,
          artifactIds: {
            elements: [
              {
                id: 'cio',
              },
              {
                id: 'blog',
              }],
          },
        },
      });
    });

    it('should not contain inactive record', async () => {
      await cassandraDBHelpers.execute(selectSubscriptionQuery,
        subscriptionIdPKeyValues(inactiveSubscriptionId))
        .then((result: cassandra.types.ResultSet) => {
          const row = result.first();
          if (row !== null) {
            fail('Inactive subscription found');
            return;
          }
          expect(row).toEqual(null);
        });
    });

    it('should not contain the same active record', async () => {
      try {
        await cassandraDBHelpers.execute(selectSubscriptionQuery,
          subscriptionIdPKeyValues(subscriptionId))
          .then((result: cassandra.types.ResultSet) => {
            const row = result.first();
            if (row !== null) {
              fail('Active subscription found');
              return;
            }
            expect(row).toEqual(null);
          });
      } catch (err) {
        logger.error(`Error::: ${JSON.stringify(err)}`);
      }
    });
  });

  afterAll(async () => {
    await cassandraDBHelpers.shutdown();
  });
});
