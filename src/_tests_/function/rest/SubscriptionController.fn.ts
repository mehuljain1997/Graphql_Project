import { ApolloClient, gql, NormalizedCacheObject } from 'apollo-boost';
import * as fs from 'fs';
import 'reflect-metadata';
import { logger } from '../../../logger';
import { ChannelFrequencies, Role, State } from '../../../models/enums';
import { Response } from '../../../models/Response';
import { SubscriptionId } from '../../../models/SubscriptionId';
import { SubscriptionInput } from '../../../models/SubscriptionInput';
import { ApiKeyRepo, ApiKeyRepoImpl } from '../../../repo/ApiKeyRepo';
import { cassandraDBHelpers } from '../../../repo/cassandraDBHelpers';
import {
  deleteSubscriptionQuery,
  deleteUserSubscriptionQuery,
  subscriptionIdPKeyValues,
} from '../../../repo/SubscriptionRepoQueries';
import { get } from '../../../resolvers/commons';
import { cleanApiKeyTable } from '../../functional/repo/ApiKeyResolver.fn';
import { getGraphQlTestClient, getRestURL } from '../../utils/fn-tests-utils';

const subscribeGql = fs.readFileSync('test_resources/subscribe.gql').toString();

const APP_ID = 'w3notifications-test';
const USER_ID = 'A24876693';
const USER_ID_TEST = 'USER_ID_TEST';
const ARTIFACT_DATE = '2019-07-03T16:17:22.790Z';
const GQL_TEST_CLIENT_1: ApolloClient<NormalizedCacheObject> = getGraphQlTestClient(
    { email: 'something@something.com', id: USER_ID });
const GQL_TEST_CLIENT_2: ApolloClient<NormalizedCacheObject> = getGraphQlTestClient(
        { email: 'something@something.com', id: USER_ID_TEST });

const subscriptionId: SubscriptionId = {
  appId: APP_ID,
  artifactId: {
    elements: [{ id: 'cio' }, { id: 'blog' }],
  },
  userId: USER_ID,
  state: State.ACTIVE,
};
const CREATED_BY = '08767M744';
const subscriptionIdTestUser: SubscriptionId = {
  appId: APP_ID,
  artifactId: {
    elements: [{ id: 'cio' }, { id: 'blog' }],
  },
  userId: USER_ID_TEST,
  state: State.ACTIVE,
};

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

const subscriptionInputTestUser: SubscriptionInput = {
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
  userId: USER_ID_TEST,
  subscriptionType: 'blog',
};

const subsriptionConfigByUserIdToken = {
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer {"email":"test@something.com","id":"${USER_ID}"}`, // tslint:disable
    },
  };
const subsriptionConfigByApiToken = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: ``,
      },
  }; 
const testApiEntries: string[] = []; 

describe('read subscriptions using REST endpoint w/ UserID', () => {
  it('read active usersubscriptions', async () => {
    await subscribe(subscriptionInput);
    const url: string = getRestURL('subscriptions').
    concat('?').
    concat(`appId=${subscriptionInput.appId}`).
    concat('&').
    concat(`artifactIds={"elements":[{"id":"${subscriptionInput.artifact.elements[0].artifactIdElement.id}"},
    {"id":"${subscriptionInput.artifact.elements[1].artifactIdElement.id}"}]}`);
    const response: Response = await get(url, subsriptionConfigByUserIdToken);
    expect(response.status).toBe('success');
    expect(response).toBeDefined();
    expect(response.data.subscriptions).toBeDefined();
    if (response.data.subscriptions) {
      expect(response.data.subscriptions.length).toEqual(1);
    }
  });

  afterAll(async () => {
    await cleanUpSubscription(subscriptionId);
  });
});

describe('Forbidden error using REST endpoint w/ UserID', () => {
  it('To throw 403 error code', async () => {
    const url: string = getRestURL('subscriptions').
    concat('?').
    concat(`appId=${subscriptionInput.appId}`).
    concat('&').
    concat(`userId=${USER_ID_TEST}`).
    concat('&').
    concat(`artifactIds={"elements":[{"id":"${subscriptionInput.artifact.elements[0].artifactIdElement.id}"},
    {"id":"${subscriptionInput.artifact.elements[1].artifactIdElement.id}"}]}`);
    get(url, subsriptionConfigByUserIdToken).then((response) => {
      expect(false).toBeTruthy();
    }).catch((err) => {
      expect(err).toBeDefined();
      expect(err.message).toBe('Request failed with status code 403');
    });
  });
});

describe('read subscriptions using REST endpoint w/ apiKey', () => {
    let apiKeyRepo: ApiKeyRepo;
    beforeAll(async () => {
        apiKeyRepo = ApiKeyRepoImpl.getInstance();
      });
    it('read active usersubscriptions', async () => {
    const apiKeyResponse: string = await apiKeyRepo.createApiKey(APP_ID, CREATED_BY);
    testApiEntries.push(APP_ID);
    const formattedApiKey = APP_ID.concat(':').concat(apiKeyResponse);
    const base64EncodedKey = Buffer.from(formattedApiKey).toString('base64');
      await subscribe(subscriptionInput);
      await subscribe1(subscriptionInputTestUser);
      const url: string = getRestURL('subscriptions').
      concat('?').
      concat(`appId=${subscriptionInput.appId}`).
      concat('&').
      concat(`artifactIds={"elements":[{"id":"${subscriptionInput.artifact.elements[0].artifactIdElement.id}"},
      {"id":"${subscriptionInput.artifact.elements[1].artifactIdElement.id}"}]}`);
      subsriptionConfigByApiToken.headers.Authorization = `apiKey ${base64EncodedKey}`;
      const response: Response = await get(url, subsriptionConfigByApiToken);
      expect(response).toBeDefined();
      expect(response.status).toBe('success');
      expect(response.data.subscriptions).toBeDefined();
      if (response.data.subscriptions) {
        expect(response.data.subscriptions.length).toEqual(2);
      }

    });
    afterAll(async () => {
        await cleanApiKeyTable(testApiEntries);
        await cleanUpSubscription(subscriptionId);
        await cleanUpSubscription(subscriptionIdTestUser);
      });
  });

  describe('read subscriptions using REST endpoint w/ apiKey', () => {
    let apiKeyRepo: ApiKeyRepo;
    beforeAll(async () => {
        apiKeyRepo = ApiKeyRepoImpl.getInstance();
      });
    it('read active usersubscriptions', async () => {
    const apiKeyResponse: string = await apiKeyRepo.createApiKey(APP_ID, CREATED_BY);
    testApiEntries.push(APP_ID);
    const formattedApiKey = APP_ID.concat(':').concat(apiKeyResponse);
    const base64EncodedKey = Buffer.from(formattedApiKey).toString('base64');
      await subscribe(subscriptionInput);
      await subscribe1(subscriptionInputTestUser);
      let url: string = getRestURL('subscriptions').
      concat('?').
      concat(`appId=${subscriptionInput.appId}`).
      concat('&').
      concat(`artifactIds={"elements":[{"id":"${subscriptionInput.artifact.elements[0].artifactIdElement.id}"},
      {"id":"${subscriptionInput.artifact.elements[1].artifactIdElement.id}"}]}`);
      subsriptionConfigByApiToken.headers.Authorization = `apiKey ${base64EncodedKey}`;
      const response: Response = await get(url, subsriptionConfigByApiToken);
      expect(response).toBeDefined();
      expect(response.status).toBe('success');
      expect(response.data.subscriptions).toBeDefined();
      if (response.data.subscriptions) {
        expect(response.data.subscriptions.length).toEqual(2);
      }

      // w/ FetchSize = 1
      url = url.concat('&fetchSize=1');
      const responseByFetchSize: Response = await get(url, subsriptionConfigByApiToken);
      expect(responseByFetchSize).toBeDefined();
      expect(responseByFetchSize.status).toBe('success');
      expect(responseByFetchSize.data.subscriptions).toBeDefined();
      if (responseByFetchSize.data.subscriptions) {
        expect(responseByFetchSize.data.subscriptions.length).toEqual(1);
        expect(responseByFetchSize.data.subscriptions[0].userId).toBe(USER_ID);
      }
      expect(responseByFetchSize.data.pageState).toBeDefined();
      let pageState: string | undefined = responseByFetchSize.data.pageState;
      url = url.concat(`&pageState=${pageState}`);

      // w/ pageState
      const responseByPageState: Response = await get(url, subsriptionConfigByApiToken);
      expect(responseByPageState).toBeDefined();
      expect(responseByPageState.status).toBe('success');
      expect(responseByPageState.data.subscriptions).toBeDefined();
      if (responseByPageState.data.subscriptions) {
        expect(responseByPageState.data.subscriptions.length).toEqual(1);
        expect(responseByPageState.data.subscriptions[0].userId).toBe(USER_ID_TEST);
      }
    });
    afterAll(async () => {
        await cleanApiKeyTable(testApiEntries);
        await cleanUpSubscription(subscriptionId);
        await cleanUpSubscription(subscriptionIdTestUser);
      });
  });

async function subscribe(input: SubscriptionInput): Promise<any> {
  try {
    return GQL_TEST_CLIENT_1.mutate({
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
    try {
      return GQL_TEST_CLIENT_2.mutate({
        mutation: gql(subscribeGql),
        variables: {
          subscriptionInput: input,
        },
      });
    } catch (err) {
      logger.error(`Error in subscriber::: ${JSON.stringify(err)}`);
    }
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
