import * as _ from 'lodash';
import { settings } from '../../../config/config';
import { AuthenticationMiddleware } from '../../../middleware/AuthenticationMiddleware';
import { ApiKeyRepoImpl } from '../../../repo/ApiKeyRepo';
import { cassandraDBHelpers } from '../../../repo/cassandraDBHelpers';
import { ApiKeyMutationResolver } from '../../../resolvers/ApiKeyMutationResolver';
import { encrypt } from '../../../resolvers/commons';
import { bluepagesResponse } from '../bluepagesResponse';

const mockApiKeyDBRecord: object = {
  app_id: 'notifications-test', // tslint:disable
  key: `bc8e4b4d81530ef86af50e01a1e98cbd:6e9fafe2810799e2f0e9e806be30cc79ae7000170f14f93a4bd8c24b34091bb482cd6b92f38520617f6c421ecc28f79e5b5bf99b48a7ec6658e97d9a2665bc5f`,
  created_by: 'unit-test',
  createdDate: new Date(),
  updatedDate: new Date(),
};

const appId = 'notifications-test';
const encryptionKey = process.env.AES_ENCRYPTION_KEY || '';

const apiKeyAuthorizedIds: string = settings.apiKeyAuthorizedUserIds;
settings.aesEncryptionKey = 'bUv8GlR3CwX2yISOcPqYrMoVoxqzoLHw';
const encryptedKey: string = settings.aesEncryptionKey;
/**
 * Test suite for Create apikey mutation
 */
describe('Create API key mutation', () => {
  let apiKeyResolver: ApiKeyMutationResolver;
  let apiKeyRepo;
  beforeAll(() => {
    apiKeyRepo = new ApiKeyRepoImpl();
    apiKeyResolver = new ApiKeyMutationResolver(apiKeyRepo);
  });

  afterAll(() => {
    settings.apiKeyAuthorizedUserIds = apiKeyAuthorizedIds;
    settings.aesEncryptionKey = encryptedKey
  });

  /*
  * This test case checks for authorized user able to request api key
  */
  it('Authorized users should be able to create api key', async () => {
    const req = {} as any;
    req['isAuthenticated'] = true;
    settings.apiKeyAuthorizedUserIds = bluepagesResponse.content.user.profile.uid;
    settings.aesEncryptionKey = 'bUv8GlR3CwX2yISOcPqYrMoVoxqzoLHw';
    req.username = bluepagesResponse.content.user.profile.uid;
    const results = {
      first: jest.fn().mockReturnValue(null),
    } as any;
    // tslint:disable
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(results);
    }));
    const returnedKey = await apiKeyResolver.apiKey(req, appId);
    expect(returnedKey).toBeDefined();
    expect(returnedKey.length).toBe(48);
  });
});

/**
 * Test suite for update apikey mutation
 */
describe('Update API key mutation', () => {
  let apiKeyResolver: ApiKeyMutationResolver;
  let apiKeyRepo;
  beforeAll(() => {
    apiKeyRepo = new ApiKeyRepoImpl();
    apiKeyResolver = new ApiKeyMutationResolver(apiKeyRepo);
  });

  afterAll(() => {
    settings.apiKeyAuthorizedUserIds = apiKeyAuthorizedIds;
    settings.aesEncryptionKey = encryptedKey
  });

  /*
  * This test case checks for authorized user able to update api key
  */
  it('Authorized users should be able to update api key', async () => {
    const req = {} as any;
    req['isAuthenticated'] = true;
    settings.apiKeyAuthorizedUserIds = bluepagesResponse.content.user.profile.uid;
    settings.aesEncryptionKey = 'bUv8GlR3CwX2yISOcPqYrMoVoxqzoLHw';
    req.username = bluepagesResponse.content.user.profile.uid;
    const results = {
      first: jest.fn().mockReturnValue({ "[json]": JSON.stringify(mockApiKeyDBRecord) }),
    } as any;
    // tslint:disable
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(results);
    }));
    const returnedKey = await apiKeyResolver.updateApiKey(req, appId);
    const encryptedKey: string = await encrypt(returnedKey, settings.aesEncryptionKey);
    expect(returnedKey).toBeDefined();
    expect(encryptedKey).not.toEqual(mockApiKeyDBRecord['key']);
    expect(returnedKey.length).toBe(48);
  });

  /*
  * This test case checks for error condition when apikey doesn't exist
  * but in case we are trying to update. 
  */
  it(`Unable to update apikey when apikey doesn't exist`, async () => {
    const req = {} as any;
    req['isAuthenticated'] = true;
    settings.apiKeyAuthorizedUserIds = bluepagesResponse.content.user.profile.uid;
    settings.aesEncryptionKey = 'bUv8GlR3CwX2yISOcPqYrMoVoxqzoLHw';
    req.username = bluepagesResponse.content.user.profile.uid;
    const results = {
      first: jest.fn().mockReturnValue(null),
    } as any;
    // tslint:disable
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(results);
    }));
    try {
      const returnedKey = await apiKeyResolver.updateApiKey(req, appId);
      expect(returnedKey).not.toBeDefined();
    } catch (err) {
      expect(err.message).toEqual(`API key doesn't exist for the appId.`);
    }
  });

  /*
  * This test case checks for error condition when read apikey is failed
  */
  it(`Unable to update apikey when read apikey failure`, async () => {
    const req = {} as any;
    req['isAuthenticated'] = true;
    settings.apiKeyAuthorizedUserIds = bluepagesResponse.content.user.profile.uid;
    settings.aesEncryptionKey = 'bUv8GlR3CwX2yISOcPqYrMoVoxqzoLHw';
    req.username = bluepagesResponse.content.user.profile.uid;
    const results = {
      first: jest.fn().mockReturnValue(null),
    } as any;
    // tslint:disable
    cassandraDBHelpers.execute = jest.fn().mockImplementationOnce(() => {
      throw Error(`Unable to update API key. Please try again or try after sometime.`);
    });
    try {
      const returnedKey = await apiKeyResolver.updateApiKey(req, appId);
      expect(returnedKey).not.toBeDefined();
    } catch (err) {
      expect(err.message).toEqual(`Unable to update API key. Please try again or try after sometime.`);
    }
  });
});

/**
 * Test suite for verify apikey mutation
 */
describe('Verify API key mutation', () => {
  let apiKeyResolver: ApiKeyMutationResolver;
  let apiKeyRepo;
  beforeAll(() => {
    apiKeyRepo = new ApiKeyRepoImpl();
    apiKeyResolver = new ApiKeyMutationResolver(apiKeyRepo);
  });

  afterAll(() => {
    settings.apiKeyAuthorizedUserIds = apiKeyAuthorizedIds;
    settings.aesEncryptionKey = encryptedKey
  });

  /*
  * This test case checks if api key is valid or not
  */
  it('Verify api key - Success case', async () => {
    const req = {} as any;
    req['isAuthenticated'] = true;
    req['auth_policy'] = AuthenticationMiddleware.AUTH_POLICY_API_KEY;
    const response = await apiKeyResolver.validateApiKey(req);
    expect(response).toBeDefined();
    expect(response).toEqual('API key is valid');
  });

  /*
  * This test case checks if api key is valid or not
  */
  it('Verify api key - Missing or Invalid apiKey', async () => {
    const req = {} as any;
    req['isAuthenticated'] = true;
    req['auth_policy'] = AuthenticationMiddleware.AUTH_POLICY_BEARER;
    try {
      await apiKeyResolver.validateApiKey(req);
      expect(false).toBeTruthy();
    } catch (err) {
      expect(err.message).toEqual('Missing or invalid apiKey');
    }
  });

  /*
  * This test case checks if api key is valid or not
  */
  it('Verify api key - Missing or Invalid apiKey', async () => {
    const req = {} as any;
    try {
      await apiKeyResolver.validateApiKey(req);
      expect(false).toBeTruthy();
    } catch (err) {
      expect(err.message).toEqual(`Access denied! You don't have permission for this action!`);
    }
  });
});
