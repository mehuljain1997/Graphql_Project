import { ApolloClient, gql, NormalizedCacheObject } from 'apollo-boost';
import * as cassandra from 'cassandra-driver';
import * as fs from 'fs';
import 'reflect-metadata';
import { logger } from '../../../logger';
import { ChannelFrequencies, InstantChannelFrequencies, Role, State } from '../../../models/enums';
import { Subscription } from '../../../models/Subscription';
import { SubscriptionId } from '../../../models/SubscriptionId';
import { SubscriptionInput } from '../../../models/SubscriptionInput';
import { SubscriptionUsersInput } from '../../../models/SubscriptionUsersInput';
import { SubscriptionUsersWithSettingsInput } from '../../../models/SubscriptionUsersWithSettingsInput';
import { ApiKeyRepoImpl } from '../../../repo/ApiKeyRepo';
import { cassandraDBHelpers } from '../../../repo/cassandraDBHelpers';
import {
  deleteSubscriptionQuery,
  deleteUserSubscriptionQuery,
  selectSubscriptionQuery,
  subscriptionIdPKeyValues,
  subscriptionPKeyValues,
} from '../../../repo/SubscriptionRepoQueries';
import { cleanApiKeyTable } from '../../functional/repo/ApiKeyResolver.fn';
import { getGraphQlTestClient, getGraphQlTestClientForApiKey } from '../../utils/fn-tests-utils';

const getSubscriptionsGql = fs.readFileSync('test_resources/subscriptions.gql').toString();
const getSubscriptionsNoStateGql = fs.readFileSync('test_resources/subscriptions_optionalState.gql').toString();
const getSubscriptionsWithListOfArtifactsGql =
  fs.readFileSync('test_resources/subscriptionsWithListOfArtifacts.gql').toString();
const subscribeGql = fs.readFileSync('test_resources/subscribe.gql').toString();
const subscribeUsersWithSettingsGql = fs.readFileSync('test_resources/subscribeUsersWithSettings.gql').toString();
const subscribeUsersGql = fs.readFileSync('test_resources/subscribeUsers.gql').toString();
const unsubscribeGql = fs.readFileSync('test_resources/unsubscribe.gql').toString();
const getUserSubsForArtifactIdGql = fs.readFileSync('test_resources/userSubscriptions_ArtifactId.gql').toString();
const updateSubscriptionGql = fs.readFileSync('test_resources/updateSubscription.gql').toString();
const deleteSubscriptionGql = fs.readFileSync('test_resources/delete.gql').toString();
const cascadeDeleteSubscriptionGql = fs.readFileSync('test_resources/deleteCascade.gql').toString();
const gqlTestClient: ApolloClient<NormalizedCacheObject> = getGraphQlTestClient(
  { email: 'martin.hablak@sk.ibm.com', id: 'A24876693' });

const gqlTestClient1: ApolloClient<NormalizedCacheObject> = getGraphQlTestClient(
  { email: 'nyenumul@us.ibm.com', id: 'C-L3CV897' });

const APP_ID = 'w3notifications-test';
const SUBSCRIBER_APP_ID = 'w3notifications-test-subscriber';
const USER_ID = 'A24876693';
const SUBSCRIBER_USER_ID = 'A24876693-SUBSCRIBER';
const USER_ID1 = 'C-L3CV897';
const ARTIFACT_DATE = '2019-07-03T16:17:22.790Z';
const API_KEY_CREATED_BY = '08767M744';

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

const subscriptionId1: SubscriptionId = {
  appId: SUBSCRIBER_APP_ID,
  artifactId: {
    elements: [{ id: 'cio_subscriber' }, { id: 'blog_subscriber' }],
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

const subscriptionInputForSite: SubscriptionInput = {
  appId: APP_ID,
  artifact: {
    elements: [
      {
        artifactIdElement: { id: 'cio' },
        title: 'CIO',
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
  subscriptionType: 'site',
};

const subscriptionIdForSite: SubscriptionId = {
  appId: APP_ID,
  artifactId: {
    elements: [{ id: 'cio' }],
  },
  userId: USER_ID,
  state: State.ACTIVE,
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

const subscriptionInputForSubscriber: SubscriptionInput = {
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
  role: Role.SUBSCRIBER,
  userId: USER_ID,
  subscriptionType: 'blog',
};


const mobileSubscriptionId: SubscriptionId = {
  appId: APP_ID,
  artifactId: {
    elements: [{ id: 'site' }, { id: 'blog' }],
  },
  userId: USER_ID,
  state: State.ACTIVE,
};

const mobileSubscriptionInput: SubscriptionInput = {
  appId: APP_ID,
  artifact: {
    elements: [
      {
        artifactIdElement: { id: 'site' },
        title: 'site',
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
      frequency: ChannelFrequencies.INSTANTLY,
    },
  },
  role: Role.SUBSCRIBER,
  userId: USER_ID,
  subscriptionType: 'blog',
};

const subscriptionRoleInput: SubscriptionInput = {
  appId: SUBSCRIBER_APP_ID,
  artifact: {
    elements: [
      {
        artifactIdElement: { id: 'cio_subscriber' },
        title: 'CIO',
        artifactDate: ARTIFACT_DATE,
      },
      {
        artifactIdElement: { id: 'blog_subscriber' },
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
  role: Role.SUBSCRIBER,
  userId: USER_ID,
  subscriptionType: 'blog',
};

const subscriptionUsersInput: SubscriptionUsersInput = {
  appId: subscriptionInput.appId,
  artifact: subscriptionInput.artifact,
  channelSettings: subscriptionInput.channelSettings,
  role: subscriptionInput.role,
  subscriptionType: subscriptionInput.subscriptionType,
  userIds: ['USER1', 'USER2', 'USER3'],
};

const subscriptionUsersWithSettingsInput: SubscriptionUsersWithSettingsInput = {
  appId: subscriptionInput.appId,
  artifact: subscriptionInput.artifact,
  usersWithSettings: [
    {
      userId: 'USER1',
      channelSettings: {
        email: {
          frequency: ChannelFrequencies.INSTANTLY,
        },
      },
      role: Role.AUTHOR,
      subscriptionType: 'subscriptionType',
    },
    {
      userId: 'USER2',
      channelSettings: {
        email: {
          frequency: ChannelFrequencies.DAILY,
        },
      },
      role: Role.SUBSCRIBER,
      subscriptionType: 'subscriptionType',
    },
    {
      userId: 'USER3',
      channelSettings: {
        email: {
          frequency: ChannelFrequencies.WEEKLY,
        },
      },
      role: Role.AUTHOR,
      subscriptionType: 'subscriptionType',
    },
  ],
};

describe('unsubscribe feature', () => {
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
        appId: 'w3notifications-test',
        userId: USER_ID,
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
        appId: 'w3notifications-test',
        userId: USER_ID,
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

  it('should contain inactive record', async () => {
    cassandraDBHelpers.execute(selectSubscriptionQuery,
      subscriptionIdPKeyValues(inactiveSubscriptionId))
      .then((result: cassandra.types.ResultSet) => {
        const row = result.first();
        if (row === null) {
          fail('Inactive subscription not found');
          return;
        }
        expect(row['state']).toEqual(State.INACTIVE);
      });
  });

  it('should create an an inactive record with the same appId, artifactId, and userId', async () => {
    cassandraDBHelpers.execute(selectSubscriptionQuery,
      subscriptionIdPKeyValues(inactiveSubscriptionId))
      .then((result: cassandra.types.ResultSet) => {
        const row = result.first();
        if (row === null) {
          fail('Inactive subscription not found');
          return;
        }
        expect(row['state']).toEqual(State.INACTIVE);
      });
  });

  it('should not contain the same active record', async () => {
    cassandraDBHelpers.execute(selectSubscriptionQuery,
      subscriptionIdPKeyValues(subscriptionId))
      .then((result: cassandra.types.ResultSet) => {
        const row = result.first();
        if (row !== null) {
          fail('Inactive subscription not found');
          return;
        }
      });
  });
});

describe('subscribe feature', () => {
  it('should subscribe user', async () => {
    const response = await subscribe(subscriptionInput);
    expect(response.data.subscribe).toBeDefined();
    const subscription = response.data.subscribe;
    expect(subscription.appId).toEqual(subscriptionInput.appId);
    expect(subscription.userId).toEqual(subscriptionInput.userId);
    expect(subscription.subscriptionType).toEqual(subscriptionInput.subscriptionType);
    expect(subscription.artifact.elements.length).toEqual(2);
    [0, 1].map((idx: number) => {
      expect(subscription.artifact.elements[idx].title)
        .toEqual(subscriptionInput.artifact.elements[idx].title);
      expect(subscription.artifact.elements[idx].artifactIdElement.id)
        .toEqual(subscriptionInput.artifact.elements[idx].artifactIdElement.id);
      expect(
        subscription.channelSettings.email.frequency,
      ).toEqual(
        subscriptionInput.channelSettings.email.frequency,
      );
      if (subscriptionInput.channelSettings.webBell) {
        expect(
          subscription.channelSettings.webBell.frequency,
        ).toEqual(
          subscriptionInput.channelSettings.webBell.frequency,
        );
      }
    });
    await cleanUpSubscription(subscriptionId);
  });

  it('should subscribe user with optional webBell', async () => {
    const response = await subscribe(subscriptionInputOptionalWebBell);

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

  it('should subscribe artifact for role subscriber', async () => {
    await subscribe(subscriptionRoleInput);
    const getSubscriptions = getSubscriptionsGql;
    const response = await gqlTestClient.query({
      query: gql(getSubscriptions),
      variables: {
        appId: SUBSCRIBER_APP_ID,
        userId: USER_ID,
        role: Role.SUBSCRIBER,
        states: 'ACTIVE',
        artifactIds: {
          elements: [
            {
              id: 'cio_subscriber',
            },
            {
              id: 'blog_subscriber',
            }],
        },
      },
    });
    expect(response.data.subscriptions).toBeDefined();
    const subscriptionArray = response.data.subscriptions;
    expect(subscriptionArray[0].appId).toEqual(subscriptionRoleInput.appId);
    expect(subscriptionArray[0].userId).toEqual(subscriptionRoleInput.userId);
    expect(subscriptionArray[0].subscriptionType).toEqual(subscriptionRoleInput.subscriptionType);
    expect(subscriptionArray[0].state).toEqual('ACTIVE');
    expect(subscriptionArray[0].role).toEqual(Role.SUBSCRIBER);
    expect(subscriptionArray[0].artifact.elements.length).toEqual(2);
    [0, 1].map((idx: number) => {
      expect(subscriptionArray[0].artifact.elements[idx].title)
        .toEqual(subscriptionRoleInput.artifact.elements[idx].title);
      expect(subscriptionArray[0].artifact.elements[idx].artifactIdElement.id)
        .toEqual(subscriptionRoleInput.artifact.elements[idx].artifactIdElement.id);
      expect(
        subscriptionArray[0].channelSettings.email.frequency,
      ).toEqual(
        subscriptionRoleInput.channelSettings.email.frequency,
      );
    });

    await cleanUpSubscription(subscriptionId1);
  });

  it('should subscribe multiple authors for an artifact', async () => {
    await subscribe(subscriptionInput);
    const subscriptionInput1: SubscriptionInput = {
      ...subscriptionInput,
      userId: USER_ID1,
    };
    await subscribe1(subscriptionInput1);
    const getSubscriptions = getSubscriptionsGql;
    const response = await gqlTestClient.query({
      query: gql(getSubscriptions),
      variables: {
        appId: APP_ID,
        states: 'ACTIVE',
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
    expect(subscriptionArray[0].state).toEqual('ACTIVE');
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
    expect(subscriptionArray[0].role).toEqual(Role.AUTHOR);
    await cleanUpSubscription(subscriptionId);
    await cleanUpSubscription({
      ...subscriptionId,
      userId: USER_ID1,
    });
  });

  it('subscribe subscriptions for mobilePush notifications', async () => {
    const mobileSubsription = {
      ...mobileSubscriptionInput,
      channelSettings: {
        email: {
          frequency: ChannelFrequencies.INSTANTLY,
        },
        mobilePush: {
          frequency: InstantChannelFrequencies.INSTANTLY,
        },
      },
    };
    await subscribe(mobileSubsription);
    const getSubscriptions = getSubscriptionsGql;
    const response = await gqlTestClient.query({
      query: gql(getSubscriptions),
      variables: {
        appId: APP_ID,
        role: Role.SUBSCRIBER,
        states: 'ACTIVE',
        artifactIds: {
          elements: [
            {
              id: 'site',
            },
            {
              id: 'blog',
            }],
        },
      },
    });
    expect(response.data.subscriptions).toBeDefined();
    const subscriptionArray = response.data.subscriptions;
    expect(subscriptionArray[0].appId).toEqual(mobileSubscriptionInput.appId);
    expect(subscriptionArray[0].userId).toEqual(mobileSubscriptionInput.userId);
    expect(subscriptionArray[0].subscriptionType).toEqual(mobileSubscriptionInput.subscriptionType);
    expect(subscriptionArray[0].artifact.elements.length).toEqual(2);
    [0, 1].map((idx: number) => {
      expect(subscriptionArray[0].artifact.elements[idx].title)
        .toEqual(mobileSubscriptionInput.artifact.elements[idx].title);
      expect(subscriptionArray[0].artifact.elements[idx].artifactIdElement.id)
        .toEqual(mobileSubscriptionInput.artifact.elements[idx].artifactIdElement.id);
      expect(
        subscriptionArray[0].channelSettings.email.frequency,
      ).toEqual(
        mobileSubsription.channelSettings.email.frequency,
      );
      expect(subscriptionArray[0].channelSettings.mobilePush.frequency).toBeDefined();
      if (subscriptionArray[0].channelSettings.mobilePush.frequency) {
        expect(
          subscriptionArray[0].channelSettings.mobilePush.frequency,
        ).toEqual(
          mobileSubsription.channelSettings.mobilePush.frequency,
        );
      }
    });
    await cleanUpSubscription(mobileSubscriptionId);
  });
});

describe('subscribeUsers feature', () => {

  describe('subscribe users', () => {

    const testApiEntries: string[] = [];

    afterAll(async () => {
      await cleanApiKeyTable(testApiEntries);
    });

    it('subscribe users', async () => {
      const apiKeyResponse: string = await ApiKeyRepoImpl.getInstance().createApiKey(APP_ID, API_KEY_CREATED_BY);
      testApiEntries.push(APP_ID);
      const formattedApiKey = APP_ID.concat(':').concat(apiKeyResponse);
      const base64EncodedKey = Buffer.from(formattedApiKey).toString('base64');
      const gqlTestClientForApiKey: ApolloClient<NormalizedCacheObject> = getGraphQlTestClientForApiKey(
        base64EncodedKey);
      const response = await subscribeUsers(gqlTestClientForApiKey, subscriptionUsersInput);
      expect(response.data.subscribeUsers).toBeDefined();
      const subscriptions: Subscription[] = response.data.subscribeUsers;
      expect(subscriptions.length).toBe(subscriptionUsersInput.userIds.length);
      for (let index = 0; index < subscriptions.length; index = index + 1) {
        const sub: Subscription = subscriptions[index];
        expect(sub.appId).toEqual(subscriptionUsersInput.appId);
        expect(sub.artifact.elements.length).toEqual(2);
        [0, 1].map((idx: number) => {
          expect(sub.artifact.elements[idx].artifactIdElement.id)
            .toEqual(subscriptionUsersInput.artifact.elements[idx].artifactIdElement.id);
          expect(sub.artifact.elements[idx].title)
            .toEqual(subscriptionUsersInput.artifact.elements[idx].title);
        });
        expect(sub.userId).toEqual(subscriptionUsersInput.userIds[index]);
        expect(sub.channelSettings).toMatchObject(subscriptionUsersInput.channelSettings);
        expect(sub.role).toEqual(subscriptionUsersInput.role);
      }
      for (const subscription of subscriptions) {
        const sub: Subscription = {
          ...subscription,
          state: State.ACTIVE,
        };
        await cleanUpSubscription1(sub);
      }
    });
  });

  it('should return 401 without an API key', async () => {
    try {
      await subscribeUsers(gqlTestClient, subscriptionUsersInput);
      expect(false).toBe(true);
    } catch (err) {
      expect(err.networkError.result.code).toEqual(401);
      expect(err.networkError.result.message).toEqual('API key based authentication strategy must be used for subscribeUsers Mutation.');
    }
  });
});

describe('subscribeUsersWithSettings feature', () => {

  describe('subscribe users with settings', () => {

    const testApiEntries: string[] = [];

    afterAll(async () => {
      await cleanApiKeyTable(testApiEntries);
    });

    it('subscribe users with settings', async () => {
      const apiKeyResponse: string = await ApiKeyRepoImpl.getInstance().createApiKey(APP_ID, API_KEY_CREATED_BY);
      testApiEntries.push(APP_ID);
      const formattedApiKey = APP_ID.concat(':').concat(apiKeyResponse);
      const base64EncodedKey = Buffer.from(formattedApiKey).toString('base64');
      const gqlTestClientForApiKey: ApolloClient<NormalizedCacheObject> = getGraphQlTestClientForApiKey(
        base64EncodedKey);
      const response = await subscribeUsersWithSettings(gqlTestClientForApiKey, subscriptionUsersWithSettingsInput);
      expect(response.data.subscribeUsersWithSettings).toBeDefined();
      const subscriptions: Subscription[] = response.data.subscribeUsersWithSettings;
      expect(subscriptions.length).toBe(subscriptionUsersWithSettingsInput.usersWithSettings.length);
      for (let index = 0; index < subscriptions.length; index = index + 1) {
        const sub: Subscription = subscriptions[index];
        expect(sub.appId).toEqual(subscriptionUsersWithSettingsInput.appId);
        [0, 1].map((idx: number) => {
          expect(sub.artifact.elements[idx].artifactIdElement.id)
            .toEqual(subscriptionUsersInput.artifact.elements[idx].artifactIdElement.id);
          expect(sub.artifact.elements[idx].title)
            .toEqual(subscriptionUsersInput.artifact.elements[idx].title);
        });
        expect(sub.userId).toEqual(subscriptionUsersWithSettingsInput.usersWithSettings[index].userId);
        expect(sub.channelSettings).toMatchObject(subscriptionUsersWithSettingsInput.usersWithSettings[index].channelSettings);
        expect(sub.role).toEqual(subscriptionUsersWithSettingsInput.usersWithSettings[index].role);
      }
      for (const subscription of subscriptions) {
        const sub: Subscription = {
          ...subscription,
          state: State.ACTIVE,
        };
        await cleanUpSubscription1(sub);
      }
    });
  });

  it('should return 401 without an API key', async () => {
    try {
      await subscribeUsersWithSettings(gqlTestClient, subscriptionUsersWithSettingsInput);
      expect(false).toBe(true);
    } catch (err) {
      expect(err.networkError.result.code).toEqual(401);
      expect(err.networkError.result.message).toEqual('API key based authentication strategy must be used for subscribeUsersWithSettings Mutation.');
    }
  });
});

describe('read list of subscriptions by SubscriptionsWithListOfArtifacts', () => {
  it('read list of  subscriptions by SubscriptionsWithListOfArtifacts', async () => {
    await subscribe(subscriptionInput);
    await subscribe(subscriptionInputOptionalWebBell);
    const getSubscriptions: string = getSubscriptionsWithListOfArtifactsGql;
    const response: any = await gqlTestClient.query({
      query: gql(getSubscriptions),
      variables: {
        appId: APP_ID,
        artifactIds: [{
          elements: [
            {
              id: 'cio',
            }, {
              id: 'blog',
            }],
        }, {
          elements: [{
            id: 'cio_test',
          }, {
            id: 'blog_test',
          }],
        }],
      },
    });
    expect(response.data.subscriptionsWithListOfArtifacts).toBeDefined();
    expect(response.data.subscriptionsWithListOfArtifacts.length).toBe(2);
    const subscriptionArray: any = response.data.subscriptionsWithListOfArtifacts;
    expect(subscriptionArray[0].appId).toEqual(subscriptionInput.appId);
    expect(subscriptionArray[0].userId).toEqual(subscriptionInput.userId);
    expect(subscriptionArray[0].subscriptionType).toEqual(subscriptionInput.subscriptionType);
    expect(subscriptionArray[0].state).toEqual('ACTIVE');
    expect(subscriptionArray[0].artifact.elements.length).toEqual(2);
    expect(subscriptionArray[1].appId).toEqual(subscriptionIdOptionalWebBell.appId);
    expect(subscriptionArray[1].userId).toEqual(subscriptionIdOptionalWebBell.userId);
    expect(subscriptionArray[1].state).toEqual('ACTIVE');
    expect(subscriptionArray[1].artifact.elements.length).toEqual(2);
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

    await cleanUpSubscription(subscriptionId);
    await cleanUpSubscription(subscriptionIdOptionalWebBell);
  });
});

describe('update subscription', () => {
  it('should change subscription settings', async () => {
    await subscribe(subscriptionInput);
    await subscribe(subscriptionInputOptionalWebBell);

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
    const updateArtifactTitle = {
      elements: [
        {
          artifactIdElement: { id: 'cio_test' },
          title: 'cio_test',
          artifactDate: ARTIFACT_DATE,
        },
        {
          artifactIdElement: { id: 'blog_test' },
          title: 'blog_test',
          artifactDate: ARTIFACT_DATE,
        },
      ],
    };
    const updatedInput1: SubscriptionInput = {
      ...subscriptionInput,
      artifact: updatedArtifact,
    };
    const updatedInput2: SubscriptionInput = {
      ...subscriptionInputOptionalWebBell,
      artifact: updateArtifactTitle,
    };

    const result = await gqlTestClient.mutate({
      mutation: gql(updateSubscriptionGql),
      variables: {
        subscriptionInput: [updatedInput1, updatedInput2],
      },
    });
    const updatedSubscription = result.data.updateSubscription;
    expect(updatedSubscription[0].channelSettings.email.frequency)
      .toEqual(updatedInput1.channelSettings.email.frequency);
    if (updatedInput1.channelSettings.webBell) {
      expect(updatedSubscription[0].channelSettings.webBell.frequency)
        .toEqual(updatedInput1.channelSettings.webBell.frequency);
    }
    expect(updatedSubscription[0].appId)
      .toEqual(updatedInput1.appId);
    expect(updatedSubscription[0].userId)
      .toEqual(updatedInput1.userId);
    expect(updatedSubscription[0].artifact.elements[0].title)
      .toEqual(updatedInput1.artifact.elements[0].title);
    expect(updatedSubscription[0].artifact.elements[1].title)
      .toEqual(updatedInput1.artifact.elements[1].title);

    expect(updatedSubscription[1].channelSettings.email.frequency)
      .toEqual(updatedInput2.channelSettings.email.frequency);
    if (updatedInput2.channelSettings.webBell) {
      expect(updatedSubscription[1].channelSettings.webBell.frequency)
        .toEqual(updatedInput2.channelSettings.webBell.frequency);
    }
    expect(updatedSubscription[1].artifact.elements[0].title)
      .toEqual(updatedInput2.artifact.elements[0].title);
    expect(updatedSubscription[1].artifact.elements[1].title)
      .toEqual(updatedInput2.artifact.elements[1].title);
    await cleanUpSubscription(subscriptionId);
    await cleanUpSubscription(subscriptionIdOptionalWebBell);
    // TODO: we need to issue query against cassandra to ensure we updated record
  });
});


describe('remove subscription feature', () => {
  beforeAll(async () => {
    await subscribe(subscriptionInput);
    await gqlTestClient.mutate({
      mutation: gql(deleteSubscriptionGql),
      variables: {
        appId: 'w3notifications-test',
        userId: USER_ID,
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


  it('read author subscriptions', async () => {
    const response = await gqlTestClient.query({
      query: gql(getSubscriptionsGql),
      variables: {
        appId: 'w3notifications-test',
        userId: USER_ID,
        role: Role.AUTHOR,
        states: 'ACTIVE',
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
    const sub = [];
    expect(response.data.subscriptions).toEqual(sub);
  });

  it('should not contain inactive record', async () => {
    cassandraDBHelpers.execute(selectSubscriptionQuery,
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
    cassandraDBHelpers.execute(selectSubscriptionQuery,
      subscriptionIdPKeyValues(subscriptionId))
      .then((result: cassandra.types.ResultSet) => {
        const row = result.first();
        if (row !== null) {
          fail('Active subscription found');
          return;
        }
        expect(row).toEqual(null);
      });
  });
});


describe('remove subscription for subscriber feature', () => {
  beforeAll(async () => {
    await subscribe(subscriptionInputForSubscriber);
  });
  it('delete subscriber subscriptions', async () => {
    await gqlTestClient.mutate({
      mutation: gql(deleteSubscriptionGql),
      variables: {
        appId: 'w3notifications-test',
        userId: USER_ID,
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
    }).then((response) => {
      expect(false).toBeTruthy();
    }).catch((error) => {
      const code = error.graphQLErrors[0].status;
      const expectedCode = 403;
      const resp = JSON.stringify(error.graphQLErrors[0].message);
      const expected = '\"Forbidden: You are not allowed to perform this action\"';
      expect(resp).toEqual(expected);
      expect(code).toEqual(expectedCode);
    });
  });
});

describe('read subscriptions feature', () => {
  it('read active subscriptions', async () => {
    await subscribe(subscriptionInput);

    const getSubscriptions = getSubscriptionsGql;
    const response = await gqlTestClient.query({
      query: gql(getSubscriptions),
      variables: {
        appId: APP_ID,
        userId: USER_ID,
        role: Role.AUTHOR,
        states: 'ACTIVE',
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
    expect(subscriptionArray[0].state).toEqual('ACTIVE');
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

    await cleanUpSubscription(subscriptionId);
  });
});

describe('read usersubscriptions feature', () => {
  it('read active usersubscriptions', async () => {
    await subscribe(subscriptionInput);
    const getUserSubsForArtifactId = getUserSubsForArtifactIdGql;
    const response = await gqlTestClient.query({
      query: gql(getUserSubsForArtifactId),
      variables: {
        userId: USER_ID,
        appId: APP_ID,
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

    expect(response.data.userSubscriptions).toBeDefined();
    expect(response.data.userSubscriptions.length).toEqual(1);

    await cleanUpSubscription(subscriptionId);
  });
});

describe('cascadedelete subscription feature', () => {
  beforeAll(async () => {
    await subscribe(subscriptionInputForSite);
    await gqlTestClient.mutate({
      mutation: gql(cascadeDeleteSubscriptionGql),
      variables: {
        appId: 'w3notifications-test',
        userId: USER_ID,
        artifactIds: {
          elements: [
            {
              id: 'cio',
            }],
        },
      },
    });
  });

  it('read casecadedelete user subscriptions', async () => {
    const response = await gqlTestClient.query({
      query: gql(getSubscriptionsGql),
      variables: {
        appId: 'w3notifications-test',
        userId: USER_ID,
        role: Role.AUTHOR,
        states: 'ACTIVE',
        artifactIds: {
          elements: [
            {
              id: 'cio',
            }],
        },
      },
    });
    const sub = [];
    expect(response.data.subscriptions).toEqual(sub);
  });
});


describe('cascadedelete subscription feature - blog delete', () => {
  beforeAll(async () => {
    await subscribe(subscriptionInputForSite);
    await subscribe(subscriptionInput);
    await gqlTestClient.mutate({
      mutation: gql(cascadeDeleteSubscriptionGql),
      variables: {
        appId: 'w3notifications-test',
        userId: USER_ID,
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

  afterAll(async () => {
    await cleanUpSubscription(subscriptionIdForSite);
  });

  it('read cascadedelete author subscriptions - blog delete', async () => {
    const response = await gqlTestClient.query({
      query: gql(getSubscriptionsGql),
      variables: {
        appId: 'w3notifications-test',
        userId: USER_ID,
        role: Role.AUTHOR,
        states: 'ACTIVE',
        artifactIds: {
          elements: [
            {
              id: 'cio',
            }],
        },
      },
    });
    expect(response.data.subscriptions.length).toBe(1);
  });
});

describe('cascadeDelete subscription for subscriber feature', () => {
  beforeAll(async () => {
    await subscribe(subscriptionInputForSite);
  });

  afterAll(async () => {
    await cleanUpSubscription(subscriptionIdForSite);
  });

  it('cascadeDelete subscriptions- subscriber delete', async () => {
    const response = await gqlTestClient.mutate({
      mutation: gql(cascadeDeleteSubscriptionGql),
      variables: {
        appId: 'w3notifications-test',
        userId: SUBSCRIBER_USER_ID,
        artifactIds: {
          elements: [
            {
              id: 'cio',
            }],
        },
      },
    }).then(() => {
      expect(false).toBeTruthy();
    }).catch((error) => {
      const resp = JSON.stringify(error.graphQLErrors[0].message);
      const expected = '\"Forbidden: You are not allowed to submit a subscription request for others\"';
      expect(resp).toEqual(expected);
    });
  });
});

describe('Update subscriptions feature', () => {
  it('update subscriptions for mobilePush notifications', async () => {
    const mobileSubsription = {
      ...mobileSubscriptionInput,
      channelSettings: {
        email: {
          frequency: ChannelFrequencies.INSTANTLY,
        },
        mobilePush: {
          frequency: InstantChannelFrequencies.INSTANTLY,
        },
      },
    };
    await subscribe(mobileSubscriptionInput);
    await updateSubscription(mobileSubsription);
    const getSubscriptions = getSubscriptionsGql;
    const response = await gqlTestClient.query({
      query: gql(getSubscriptions),
      variables: {
        appId: APP_ID,
        role: Role.SUBSCRIBER,
        states: 'ACTIVE',
        artifactIds: {
          elements: [
            {
              id: 'site',
            },
            {
              id: 'blog',
            }],
        },
      },
    });
    expect(response.data.subscriptions).toBeDefined();
    const subscriptionArray = response.data.subscriptions;
    expect(subscriptionArray[0].appId).toEqual(mobileSubscriptionInput.appId);
    expect(subscriptionArray[0].userId).toEqual(mobileSubscriptionInput.userId);
    expect(subscriptionArray[0].subscriptionType).toEqual(mobileSubscriptionInput.subscriptionType);
    expect(subscriptionArray[0].artifact.elements.length).toEqual(2);
    [0, 1].map((idx: number) => {
      expect(subscriptionArray[0].artifact.elements[idx].title)
        .toEqual(mobileSubscriptionInput.artifact.elements[idx].title);
      expect(subscriptionArray[0].artifact.elements[idx].artifactIdElement.id)
        .toEqual(mobileSubscriptionInput.artifact.elements[idx].artifactIdElement.id);
      expect(
        subscriptionArray[0].channelSettings.email.frequency,
      ).toEqual(
        mobileSubscriptionInput.channelSettings.email.frequency,
      );
      expect(subscriptionArray[0].channelSettings.mobilePush.frequency).toBeDefined();
      if (subscriptionArray[0].channelSettings.mobilePush.frequency) {
        expect(
          subscriptionArray[0].channelSettings.mobilePush.frequency,
        ).toEqual(
          mobileSubsription.channelSettings.mobilePush.frequency,
        );
      }
    });
    await cleanUpSubscription(mobileSubscriptionId);
  });
});

async function subscribe(input: SubscriptionInput): Promise<any> {
  try {
    return gqlTestClient.mutate({
      mutation: gql(subscribeGql),
      variables: {
        subscriptionInput: input,
      },
    });
  } catch (err) {
    logger.error(`Error in subscriber::: ${JSON.stringify(err)}`);
  }
}

async function subscribe1(input: SubscriptionInput): Promise<any> {
  return gqlTestClient1.mutate({
    mutation: gql(subscribeGql),
    variables: {
      subscriptionInput: input,
    },
  });
}

async function subscribeUsers(
  gqlClient: ApolloClient<NormalizedCacheObject>,
  input: SubscriptionUsersInput): Promise<any> {
  return gqlClient.mutate({
    mutation: gql(subscribeUsersGql),
    variables: {
      subscriptionUsersInput: input,
    },
  });
}

async function subscribeUsersWithSettings(
  gqlClient: ApolloClient<NormalizedCacheObject>,
  input: SubscriptionUsersWithSettingsInput): Promise<any> {
  return gqlClient.mutate({
    mutation: gql(subscribeUsersWithSettingsGql),
    variables: {
      subscriptionUsersWithSettingsInput: input,
    },
  });
}

async function updateSubscription(input: SubscriptionInput): Promise<any> {
  return gqlTestClient.mutate({
    mutation: gql(updateSubscriptionGql),
    variables: {
      subscriptionInput: input,
    },
  });
}

afterAll(async () => {
  await cassandraDBHelpers.shutdown();
});

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

async function cleanUpSubscription1(subscription: Subscription): Promise<void> {
  await cassandraDBHelpers.execute(
    deleteSubscriptionQuery,
    subscriptionPKeyValues(subscription),
  );
  await cassandraDBHelpers.execute(
    deleteUserSubscriptionQuery,
    subscriptionPKeyValues(subscription),
  );
}
