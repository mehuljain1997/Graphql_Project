import { ApolloClient, gql, NormalizedCacheObject } from 'apollo-boost';
import * as fs from 'fs';
import 'reflect-metadata';
import { logger } from '../../../logger';
import { ApiKey } from '../../../models/ApiKey';
import { Role } from '../../../models/enums';
import { ApiKeyRepo, ApiKeyRepoImpl } from '../../../repo/ApiKeyRepo';
import { deleteApiKeyQuery } from '../../../repo/ApiKeyRepoQueries';
import { cassandraDBHelpers } from '../../../repo/cassandraDBHelpers';
import { getGraphQlTestClient, getGraphQlTestClientForApiKey } from '../../utils/fn-tests-utils';

const apiKeyGql = fs.readFileSync('test_resources/apiKey.gql').toString();
const updateApiKeyGql = fs.readFileSync('test_resources/updateApiKey.gql').toString();
const getApiKeyGql = fs.readFileSync('test_resources/getApiKey.gql').toString();
const validateApiKeyGql = fs.readFileSync('test_resources/validateApiKey.gql').toString();
const getSubscriptionsWithListOfArtifactsGql =
fs.readFileSync('test_resources/subscriptionsWithListOfArtifacts.gql').toString();
const getSubscriptionsGql = fs.readFileSync('test_resources/subscriptions.gql').toString();
const getUserSubscriptionsGql = fs.readFileSync('test_resources/userSubscriptions.gql').toString();
const getUserSubsForArtifactIdGql = fs.readFileSync('test_resources/userSubscriptions_ArtifactId.gql').toString();
const gqlTestClient: ApolloClient<NormalizedCacheObject> = getGraphQlTestClient(
  { email: 'rajpuppa@in.ibm.com', id: '08767M744' });
const gqlTestClientUnauthorized: ApolloClient<NormalizedCacheObject> = getGraphQlTestClient(
  { email: 'unauth@ibm.com', id: 'UNAUTH744' });
const APP_ID = 'w3notifications-test';
const INVALID_APP_ID = 'INVALID_APP_ID';
const USER_ID = 'TEST_USER';
const APP_ID_MUTATION = 'notification-test-mutation';
const APP_ID_MUTATION_1 = 'notification-test-mutation1';
const CREATED_BY = '08767M744';
const UPDATED_BY = '08767M744';
const testApiEntries: string[] = [];

afterAll(async () => {
  await cassandraDBHelpers.shutdown();
});

// Below tests might have to go into integration tests later
describe('create api key', () => {
  let apiKeyRepo: ApiKeyRepo;
  beforeAll(async () => {
    apiKeyRepo = ApiKeyRepoImpl.getInstance();
  });

  afterAll(async () => {
    await cleanApiKeyTable(testApiEntries);
  });

  /*
  * This test case creates api key
  */

  it('create API key', async () => {
    const apiKey = await apiKeyRepo.createApiKey(APP_ID, CREATED_BY);
    expect(apiKey).not.toBeNull();
    expect(apiKey).not.toBeUndefined();
    expect(apiKey.length).toEqual(48);
    testApiEntries.push(APP_ID);
  });

  /*
  * This test case creates api key and verifies it by reading using GET
  */
  it('Return prevously creaed api key when api key already exists for an app id', async () => {
    const apiKey = await apiKeyRepo.createApiKey(APP_ID, CREATED_BY);
    testApiEntries.push(APP_ID);
    expect(apiKey).not.toBeNull();
    expect(apiKey).not.toBeUndefined();
    expect(apiKey.length).toEqual(48);
    const returnedApiKey = await apiKeyRepo.getApiKey(APP_ID);
    expect(returnedApiKey.key).toEqual(apiKey);
  });

  /*
  * This test case reads the exising api key
  */
  it('Read api key', async () => {
    const returnedApiKey = await apiKeyRepo.getApiKey(APP_ID);
    expect(returnedApiKey).not.toBeNull();
    expect(returnedApiKey).not.toBeUndefined();
    expect(returnedApiKey.key.length).toEqual(48);
  });
});

describe('create api key by graphql mutation', () => {
  let apiKeyRepo: ApiKeyRepo;
  beforeAll(async () => {
    apiKeyRepo = ApiKeyRepoImpl.getInstance();
  });

  afterAll(async () => {
    await cleanApiKeyTable(testApiEntries);
  });

  /*
  * This test case creates api key using GraphQL mutation
  */
  it('create API key', async () => {
    const response = await createApiKey(APP_ID_MUTATION);
    expect(response.data).not.toBeNull();
    expect(response.data).not.toBeUndefined();
    expect(response.data.apiKey.length).toEqual(48);
    testApiEntries.push(APP_ID_MUTATION);
  });

  /*
  * This test case creates api key using GraphQL mutation and verifies the same
  */
  it('Create api key and verify by get', async () => {
    const response = await createApiKey(APP_ID_MUTATION);
    testApiEntries.push(APP_ID_MUTATION);
    expect(response.data).not.toBeNull();
    expect(response.data).not.toBeUndefined();
    expect(response.data.apiKey.length).toEqual(48);
    const returnedApiKey: ApiKey = await apiKeyRepo.getApiKey(APP_ID_MUTATION);
    expect(response.data.apiKey).toEqual(returnedApiKey.key);
  });

  /*
  * This test case checks for unauthorized user not able to create api key
  */
  it('Unauthorized users not allowed to create api key', async () => {
    try {
      await createApiKeyWithApolloClient(gqlTestClientUnauthorized, APP_ID_MUTATION);
      expect(false).toBeTruthy();
    } catch (err) {
      expect(err.networkError.result.message).toEqual('You are not authorized for apiKey Mutation.');
    }
    testApiEntries.push(APP_ID_MUTATION);
  });
});

describe('Read subscription with artifact ids and valid api key', () => {
  let apiKeyResponse;
  let apiKeyRepo: ApiKeyRepo;
  let gqlTestClientForApiKey: ApolloClient<NormalizedCacheObject>;
  beforeAll(async () => {
    apiKeyRepo = ApiKeyRepoImpl.getInstance();
    apiKeyResponse = await apiKeyRepo.createApiKey(APP_ID_MUTATION_1, CREATED_BY);
    testApiEntries.push(APP_ID_MUTATION_1);
    const formattedApiKey = APP_ID_MUTATION_1.concat(':').concat(apiKeyResponse);
    const base64EncodedKey = Buffer.from(formattedApiKey).toString('base64');
    gqlTestClientForApiKey = getGraphQlTestClientForApiKey(
      base64EncodedKey);
  });

  afterAll(async () => {
    await cleanApiKeyTable(testApiEntries);
  });

  /*
  * This test case checks we are able to read subscriptios using api key
  */
  it('Read subscription with artifact ids and valid api key', async () => {
    const getSubscriptions = getSubscriptionsGql;
    const response = await gqlTestClientForApiKey.query({
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
    expect(response.data.subscriptions.length).toEqual(0);
  });
});

describe('Read subscription by SubscriptionsWithListOfArtifactIds and valid api key',  () => {
  let apiKeyResponse: any;
  let apiKeyRepo: ApiKeyRepo;
  let gqlTestClientForApiKey: ApolloClient<NormalizedCacheObject>;
  beforeAll(async () => {
    apiKeyRepo = ApiKeyRepoImpl.getInstance();
    apiKeyResponse = await apiKeyRepo.createApiKey(APP_ID_MUTATION_1, CREATED_BY);
    testApiEntries.push(APP_ID_MUTATION_1);
    const formattedApiKey: string = APP_ID_MUTATION_1.concat(':').concat(apiKeyResponse);
    const base64EncodedKey: string = Buffer.from(formattedApiKey).toString('base64');
    gqlTestClientForApiKey = getGraphQlTestClientForApiKey(
      base64EncodedKey);
  });

  afterAll(async () => {
    await cleanApiKeyTable(testApiEntries);
  });

  /*
  * This test case checks we are able to read subscriptios using api key
  */
  it('Read subscription by SubscriptionsWithListOfArtifactIds and valid api key', async () => {
    const getSubscriptions: string = getSubscriptionsWithListOfArtifactsGql;
    const response: any = await gqlTestClientForApiKey.query({
      query: gql(getSubscriptions),
      variables: {
        appId: APP_ID,
        userId:USER_ID,
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
    expect(response.data.subscriptionsWithListOfArtifacts).toBeDefined();
    expect(response.data.subscriptionsWithListOfArtifacts.length).toEqual(0);
  });
});

// describe('Read user subscriptions with valid api key',  () => {

describe('Read user subscriptions with valid api key', () => {

  let apiKeyResponse;
  let apiKeyRepo: ApiKeyRepo;
  let gqlTestClientForApiKey: ApolloClient<NormalizedCacheObject>;
  beforeAll(async () => {
    apiKeyRepo = ApiKeyRepoImpl.getInstance();
    apiKeyResponse = await apiKeyRepo.createApiKey(APP_ID_MUTATION, CREATED_BY);
    testApiEntries.push(APP_ID_MUTATION);
    const formattedApiKey = APP_ID_MUTATION.concat(':').concat(apiKeyResponse);
    const base64EncodedKey = Buffer.from(formattedApiKey).toString('base64');
    gqlTestClientForApiKey = getGraphQlTestClientForApiKey(
      base64EncodedKey);
  });

  afterAll(async () => {
    await cleanApiKeyTable(testApiEntries);
  });

  /*
  * This test case checks we are able to read subscriptios using api key
  */
  it('Read user subscription with valid api key and mandatory user id', async () => {
    const getUserSubscriptions = getUserSubscriptionsGql;
    const response = await gqlTestClientForApiKey.query({
      query: gql(getUserSubscriptions),
      variables: {
        userId: USER_ID,
      },
    });
    expect(response.data.userSubscriptions).toBeDefined();
    expect(response.data.userSubscriptions.length).toEqual(0);
  });

  /*
  * This test case checks for 400 bad request error when invoked w/o user id
  */
  it('Read user subscription with valid api key and w/o mandatory user id', async () => {
    const getUserSubscriptions = getUserSubscriptionsGql;
    try {
      await gqlTestClientForApiKey.query({
        query: gql(getUserSubscriptions),
      });
      expect(false).toBeTruthy();
    } catch (err) {
      expect(err.graphQLErrors[0].message).toEqual('Badrequest. UserId is not provided.');
    }
  });

  it('Read user subscription with valid api key and w/o mandatory user id,app_id,artifact_id', async () => {
    const getUserSubsForArtifactId = getUserSubsForArtifactIdGql;
    const response = await gqlTestClientForApiKey.query({
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
    expect(response.data.userSubscriptions.length).toEqual(0);
  });
});

describe('Read subscriptions by artifact Ids with invalid api key', () => {
  let apiKeyResponse;
  let gqlTestClientForApiKey: ApolloClient<NormalizedCacheObject>;
  beforeAll(async () => {
    apiKeyResponse = 'invalid token';
    const formattedApiKey = APP_ID_MUTATION.concat(':').concat(apiKeyResponse);
    const base64EncodedKey = Buffer.from(formattedApiKey).toString('base64');
    gqlTestClientForApiKey = getGraphQlTestClientForApiKey(
      base64EncodedKey);
  });

  afterAll(async () => {
    await cleanApiKeyTable(testApiEntries);
  });

  /*
  * This test case checks we are unable to read subscriptios using invalid api key
  */
  it('Read subscription by artifact id with invalid api key to throw 401 error', async () => {
    const getSubscriptions = getSubscriptionsGql;
    try {
      const response = await gqlTestClientForApiKey.query({
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
      expect(false).toEqual(true);
    } catch (err) {
      expect(err.networkError.result.code).toEqual(401);
      expect(err.networkError.result.message).toEqual('Api key is not valid. Please verify and try again');
    }
  });
});

describe('Read subscriptions by SubscriptionsWithListOfArtifactIds with invalid api key',  () => {
  let apiKeyResponse;
  let gqlTestClientForApiKey: ApolloClient<NormalizedCacheObject>;
  beforeAll(async () => {
    apiKeyResponse = 'invalid token';
    const formattedApiKey = APP_ID_MUTATION.concat(':').concat(apiKeyResponse);
    const base64EncodedKey = Buffer.from(formattedApiKey).toString('base64');
    gqlTestClientForApiKey = getGraphQlTestClientForApiKey(
      base64EncodedKey);
  });

  afterAll(async () => {
    await cleanApiKeyTable(testApiEntries);
  });

  /*
  * This test case checks we are unable to read subscriptios using invalid api key
  */
  it('Read subscription by SubscriptionsWithListOfArtifactIds with invalid api key to throw 401 error', async () => {
    const getSubscriptions = getSubscriptionsWithListOfArtifactsGql;
    try {
      const response = await gqlTestClientForApiKey.query({
        query: gql(getSubscriptions),
        variables: {
          appId:APP_ID,
          userId:USER_ID,
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
      expect(false).toEqual(true);
    } catch (err) {
      expect(err.networkError.result.code).toEqual(401);
      expect(err.networkError.result.message).toEqual('Api key is not valid. Please verify and try again');
    }
  });
});


describe('update api key', () => {
  let apiKeyRepo: ApiKeyRepo;
  beforeAll(async () => {
    apiKeyRepo = ApiKeyRepoImpl.getInstance();
  });

  afterAll(async () => {
    await cleanApiKeyTable(testApiEntries);
  });

  /*
  * This test case updates api key
  */
  it('update existing API key by app id', async () => {
    testApiEntries.push(APP_ID);
    const newApiKey = await apiKeyRepo.createApiKey(APP_ID, CREATED_BY);
    const updatedApiKey = await apiKeyRepo.updateApiKey(APP_ID, UPDATED_BY);
    expect(updatedApiKey).not.toBeNull();
    expect(updatedApiKey).not.toBeUndefined();
    expect(updatedApiKey.length).toEqual(48);
    expect(newApiKey).not.toEqual(updatedApiKey);
  });

  /*
  * This test case handles error case of trying to update apikey when it doesn't exist
  */
  it(`Return error when api key doesn't exist for an appid`, async () => {
    try {
      await apiKeyRepo.updateApiKey(INVALID_APP_ID, UPDATED_BY);
      expect(false).toBeTruthy();
    } catch (err) {
      expect(err.message).toEqual(`API key doesn't exist for the appId.`);
    }
  });
});

describe('read api key', () => {
  let apiKeyRepo: ApiKeyRepo;
  beforeAll(async () => {
    apiKeyRepo = ApiKeyRepoImpl.getInstance();
  });

  afterAll(async () => {
    await cleanApiKeyTable(testApiEntries);
  });

  /*
  * This test case reads api key
  */
  it('read existing API key by app id', async () => {
    testApiEntries.push(APP_ID);
    const newApiKey = await apiKeyRepo.createApiKey(APP_ID, CREATED_BY);
    const apiKey: ApiKey = await apiKeyRepo.getApiKey(APP_ID);
    expect(apiKey).not.toBeNull();
    expect(apiKey).not.toBeUndefined();
    expect(apiKey.key.length).toEqual(48);
    expect(apiKey.key).toEqual(newApiKey);
  });

  /*
  * This test case handles error case of trying to update apikey when it doesn't exist
  */
  it(`Return error when api key doesn't exist for an appid`, async () => {
    try {
      await apiKeyRepo.getApiKey(INVALID_APP_ID);
      expect(false).toBeTruthy();
    } catch (err) {
      expect(err.message).toEqual(`ApiKey for the appID:  ${JSON.stringify(INVALID_APP_ID)} doesn't exist.`);
    }
  });
});

describe('update api key by graphql mutation', () => {
  let apiKeyRepo: ApiKeyRepo;
  beforeAll(async () => {
    apiKeyRepo = ApiKeyRepoImpl.getInstance();
  });

  afterAll(async () => {
    await cleanApiKeyTable(testApiEntries);
  });

  /*
  * This test case updates api key using GraphQL mutation
  */
  it('update API key', async () => {
    const createApiKeyResponse = await createApiKey(APP_ID_MUTATION);
    const response = await updateApiKey(APP_ID_MUTATION);
    expect(response.data).not.toBeNull();
    expect(response.data).not.toBeUndefined();
    expect(response.data.updateApiKey.length).toEqual(48);
    expect(response.data.updateApiKey).not.toEqual(createApiKeyResponse.data.apiKey);
    testApiEntries.push(APP_ID_MUTATION);
  });

  /*
  * This test case checks for unauthorized user not able to update api key
  */
  it('Unauthorized users not allowed to update api key', async () => {
    await createApiKey(APP_ID_MUTATION);
    try {
      await updateApiKeyWithApolloClient(gqlTestClientUnauthorized, APP_ID_MUTATION);
      expect(false).toBeTruthy();
    } catch (err) {
      expect(err.networkError.result.message).toEqual('You are not authorized for updateApiKey Mutation.');
    }
    testApiEntries.push(APP_ID_MUTATION);
  });
});

describe('read api key by graphql mutation', () => {
  afterAll(async () => {
    await cleanApiKeyTable(testApiEntries);
  });

  /*
  * This test case reads api key using GraphQL mutation
  */
  it('read API key', async () => {
    const createApiKeyResponse = await createApiKey(APP_ID_MUTATION);
    const readApiKeyResponse = await readApiKey(APP_ID_MUTATION);
    expect(readApiKeyResponse.data).not.toBeNull();
    expect(readApiKeyResponse.data).not.toBeUndefined();
    expect(readApiKeyResponse.data.getApiKey.key.length).toEqual(48);
    expect(readApiKeyResponse.data.getApiKey.key).toEqual(createApiKeyResponse.data.apiKey);
    testApiEntries.push(APP_ID_MUTATION);
  });

  /*
  * This test case checks for unauthorized user not able to read api key
  */
  it('Unauthorized users not allowed to read api key', async () => {
    await createApiKey(APP_ID_MUTATION);
    try {
      await readApiKeyWithApolloClient(gqlTestClientUnauthorized, APP_ID_MUTATION);
      expect(false).toBeTruthy();
    } catch (err) {
      expect(err.networkError.result.message).toEqual('You are not authorized for getApiKey Query.');
    }
    testApiEntries.push(APP_ID_MUTATION);
  });
});

/**
 * Test suite for the validate apikey cases
 */
describe('validate api key by graphql mutation', () => {
  let gqlTestClientForApiKey: ApolloClient<NormalizedCacheObject>;
  let apiKeyResponse;
  afterAll(async () => {
    await cleanApiKeyTable(testApiEntries);
  });

  it('vaidate API key - Success case', async () => {
    apiKeyResponse = await createApiKey(APP_ID_MUTATION_1);
    const formattedApiKey = APP_ID_MUTATION_1.concat(':').concat(apiKeyResponse.data.apiKey);
    const base64EncodedKey = Buffer.from(formattedApiKey).toString('base64');
    gqlTestClientForApiKey = getGraphQlTestClientForApiKey(
      base64EncodedKey);
    const response = await validateApiKey(gqlTestClientForApiKey);
    expect(response.data).not.toBeNull();
    expect(response.data).not.toBeUndefined();
    expect(response.data.validateApiKey).toEqual('API key is valid');
    testApiEntries.push(APP_ID_MUTATION);
  });

  it('vaidate API key - Error case 401 with invalid appId', async () => {
    apiKeyResponse = await createApiKey(APP_ID_MUTATION_1);
    const formattedApiKey = 'Invalid'.concat(':').concat(apiKeyResponse.data.apiKey);
    const base64EncodedKey = Buffer.from(formattedApiKey).toString('base64');
    gqlTestClientForApiKey = getGraphQlTestClientForApiKey(
      base64EncodedKey);
    try {
      await validateApiKey(gqlTestClientForApiKey);
    } catch (err) {
      expect(err.networkError).not.toBeNull();
      expect(err.networkError).not.toBeUndefined();
      expect(err.networkError.result).not.toBeNull();
      expect(err.networkError.result).not.toBeUndefined();
      expect(err.networkError.result.code).not.toBeNull();
      expect(err.networkError.result.code).not.toBeUndefined();
      expect(err.networkError.result.code).toEqual(401);
      expect(err.networkError.result.message).toEqual('Api key is not valid. Please verify and try again');
    }
    testApiEntries.push(APP_ID_MUTATION);
  });

  it('vaidate API key - Error case 401 with invalid Key', async () => {
    apiKeyResponse = await createApiKey(APP_ID_MUTATION_1);
    const formattedApiKey = APP_ID_MUTATION_1.concat(':').concat('wVOkoOpbyERkIMMepTJyrk1cmKC4tcNqDU8kzEUwOYTKFvCB');
    const base64EncodedKey = Buffer.from(formattedApiKey).toString('base64');
    gqlTestClientForApiKey = getGraphQlTestClientForApiKey(
      base64EncodedKey);
    try {
      await validateApiKey(gqlTestClientForApiKey);
    } catch (err) {
      logger.error(`Error::: ${JSON.stringify(err)}`);
      expect(err.networkError).not.toBeNull();
      expect(err.networkError).not.toBeUndefined();
      expect(err.networkError.result).not.toBeNull();
      expect(err.networkError.result).not.toBeUndefined();
      expect(err.networkError.result.code).not.toBeNull();
      expect(err.networkError.result.code).not.toBeUndefined();
      expect(err.networkError.result.code).toEqual(401);
      expect(err.networkError.result.message).toEqual('Api key is not valid. Please verify and try again');
    }
    testApiEntries.push(APP_ID_MUTATION);
  });

  it('vaidate API key - Error case - Missing or invalid apiKey', async () => {
    try {
      await validateApiKey(gqlTestClient);
    } catch (err) {
      expect(err.graphQLErrors).not.toBeNull();
      expect(err.graphQLErrors).not.toBeUndefined();
      expect(err.graphQLErrors.length).toBeGreaterThan(0);
      expect(err.graphQLErrors[0].message).toEqual('Missing or invalid apiKey');
    }
    testApiEntries.push(APP_ID_MUTATION);
  });
});

/*
* This method invokes graphql mutaton to create apikey
*/
async function createApiKey(applicationId: string): Promise<any> {
  return createApiKeyWithApolloClient(gqlTestClient, applicationId);
}

/*
* This method invokes graphql mutaton to create apikey
*/
async function createApiKeyWithApolloClient(
  gqlClient: ApolloClient<NormalizedCacheObject>, applicationId: string,
): Promise<any> {
  return gqlClient.mutate({
    mutation: gql(apiKeyGql),
    variables: {
      appId: applicationId,
    },
  });
}

/*
* This method invokes graphql mutation to update apikey
*/
async function updateApiKey(applicationId: string): Promise<any> {
  return updateApiKeyWithApolloClient(gqlTestClient, applicationId);
}

/*
* This method invokes graphql mutation to update apikey
*/
async function updateApiKeyWithApolloClient(
  gqlClient: ApolloClient<NormalizedCacheObject>, applicationId: string,
): Promise<any> {
  return gqlClient.mutate({
    mutation: gql(updateApiKeyGql),
    variables: {
      appId: applicationId,
    },
  });
}

/*
* This method invokes graphql query to read apikey
*/
async function readApiKey(applicationId: string): Promise<any> {
  return readApiKeyWithApolloClient(gqlTestClient, applicationId);
}

/*
* This method invokes graphql query to read apikey
*/
async function readApiKeyWithApolloClient(
  gqlClient: ApolloClient<NormalizedCacheObject>, applicationId: string,
): Promise<any> {
  return gqlClient.query({
    query: gql(getApiKeyGql),
    variables: {
      appId: applicationId,
    },
  });
}

/*
* This method invokes graphql mutaton to valiate apikey
*/
async function validateApiKey(gqlTestClientForApiKey: ApolloClient<NormalizedCacheObject>): Promise<any> {
  return gqlTestClientForApiKey.mutate({
    mutation: gql(validateApiKeyGql),
  });
}

/*
 * This method removes the test entry from api key table
 */
export async function cleanApiKeyTable(appIds: string[]): Promise<void> {
  await Promise.all(appIds.map(cleanApiKeyTable1));
}

export function cleanApiKeyTable1(appId: string): Promise<any> {
  return cassandraDBHelpers.execute(
    deleteApiKeyQuery,
    [appId],
  );
}
