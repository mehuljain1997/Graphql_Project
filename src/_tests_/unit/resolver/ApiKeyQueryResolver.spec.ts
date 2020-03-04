import * as _ from 'lodash';
import { settings } from '../../../config/config';
import { ApiKeyRepoImpl } from '../../../repo/ApiKeyRepo';
import { cassandraDBHelpers } from '../../../repo/cassandraDBHelpers';
import { ApiKeyQueryResolver } from '../../../resolvers/ApiKeyQueryResolver';
import { bluepagesResponse } from '../bluepagesResponse';


const mockApiKeyDBRecord: object = {
  app_id: 'notifications-test', // tslint:disable
  key: `bc8e4b4d81530ef86af50e01a1e98cbd:6e9fafe2810799e2f0e9e806be30cc79ae7000170f14f93a4bd8c24b34091bb482cd6b92f38520617f6c421ecc28f79e5b5bf99b48a7ec6658e97d9a2665bc5f`,
  created_by: 'unit-test',
  createdDate: new Date(),
  updatedDate: new Date(),
};

const appId = 'notifications-test';
const apiKeyAuthorizedIds: string = settings.apiKeyAuthorizedUserIds;
settings.aesEncryptionKey = 'bUv8GlR3CwX2yISOcPqYrMoVoxqzoLHw';
const encryptedKey: string = settings.aesEncryptionKey;
/**
 * Test suite for Read apikey Query
 */
describe('Read API key query', () => {
  let apiKeyResolver: ApiKeyQueryResolver;
  let apiKeyRepo;
  beforeAll(() => {
    apiKeyRepo = new ApiKeyRepoImpl();
    apiKeyResolver = new ApiKeyQueryResolver(apiKeyRepo);
  });

  afterAll(() => {
    settings.apiKeyAuthorizedUserIds = apiKeyAuthorizedIds;
    settings.aesEncryptionKey = encryptedKey
  });

  /*
  * This test case checks for authorized user able to read api key
  */
 it('Authorized users should be able to read api key', async () => {
    const req = {} as any;
    req['isAuthenticated'] = true;
    settings.apiKeyAuthorizedUserIds = bluepagesResponse.content.user.profile.uid;
    req.username = bluepagesResponse.content.user.profile.uid;
    const results = {
      first: jest.fn().mockReturnValue({"[json]": JSON.stringify(mockApiKeyDBRecord)}),
    } as any;
    // tslint:disable
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(results);
    }));
    const returnedKey = await apiKeyResolver.getApiKey(req, appId);
    expect(returnedKey).toBeDefined();
    expect(returnedKey.key.length).toBe(48);
  });

 /*
  * This test case checks for error condition when apikey doesn't exist
  * but in case we are trying to read. 
  */
 it(`Unable to read apikey when apikey doesn't exist`, async () => {
    const req = {} as any;
    req['isAuthenticated'] = true;
    settings.apiKeyAuthorizedUserIds = bluepagesResponse.content.user.profile.uid;
    req.username = bluepagesResponse.content.user.profile.uid;
    const results = {
      first: jest.fn().mockReturnValue(null),
    } as any;
    // tslint:disable
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(results);
    }));
    try {
    const returnedKey = await apiKeyResolver.getApiKey(req, appId);
    expect(returnedKey).not.toBeDefined();
    } catch (err) {
      expect(err.message).toEqual(`ApiKey for the appID:  "notifications-test" doesn't exist.`);
    }
  });
});
