import * as cassandra from 'cassandra-driver';
import * as _ from 'lodash';
import { settings } from '../config/config';
import { logger } from '../logger';
import { ApiKey } from '../models/ApiKey';
import * as apiKeyQueries from '../repo/ApiKeyRepoQueries';
import { createRandomToken, decrypt, encrypt } from '../resolvers/commons';
import { NotFound } from '../resolvers/exceptions/NotFound';
import { cassandraDBHelpers } from './cassandraDBHelpers';

export interface ApiKeyRepo {
  getApiKey(
    appId: string,
  ): Promise<ApiKey>;

  createApiKey(
    appId: string,
    createdBy: string,
  ): Promise<string>;

  updateApiKey(
    appId: string,
    updatedBy: string,
  ): Promise<string>;
}

export class ApiKeyRepoImpl implements ApiKeyRepo {

  public static getInstance(): ApiKeyRepoImpl {
    if (!this.instance) {
      this.instance = new ApiKeyRepoImpl();
      logger.info(`Created new instance of ApiKeyRepoImpl`);
    }
    return this.instance;
  }

  private static instance: ApiKeyRepoImpl;

  /**
   * This method returns the API key for the provided appId stored in Cassandra DB.
   *
   * @param appId
   */
  public async getApiKey(
        appId: string,
    ): Promise<ApiKey> {
    return cassandraDBHelpers.execute(apiKeyQueries.selectApiKeyByAppId,
            apiKeyQueries.appKeyPKeyValues(_.toLower(appId)))
            .then((result: cassandra.types.ResultSet) => {
              const row = result.first();
              if (row === null) {
                throw new NotFound(
                  `ApiKey for the appID:  ${JSON.stringify(appId)} doesn't exist.`,
                );
              }
              const apiKey: Promise<ApiKey> = apiKeyQueries.rowToApiKey(JSON.parse(row['[json]']));
              return apiKey;
            }).catch((err) => {
              logger.error(`Error (getApiKey): ${err}`);
              throw err;
            });
  }

  /**
   * This method creates a new api key for the provided appId.
   *
   * @param appId
   * @param createdBy
   */
  public async createApiKey(
    appId: string,
    createdBy: string,
    ): Promise<string> {

    let apiKey: ApiKey;

    // Check if api key exists for the provided appId. If exists, return it without
    // creating new key.
    try {
      apiKey = await this.getApiKey(appId);
      logger.debug(`API key already exists for the appId: ${appId}`);
      logger.debug(`API key: ${apiKey.key}`);
      return apiKey.key;
    } catch (err) {
      if (err instanceof NotFound) {
        logger.info(`API key doesn't exist for the appId: ${appId}. Will attempt to create new.`);
      } else {
        logger.error(err);
        throw Error(`Unable to create API key. Please try again or try after sometime.`);
      }
    }

    logger.info('Creating new api key...');
    let apiToken = createRandomToken(); // create new random api token
    await encrypt(apiToken, settings.aesEncryptionKey).then((value) => {
      apiToken = value;
    });
    apiKey = apiKeyQueries.getApiKeyInstance(appId, apiToken, createdBy);
    return cassandraDBHelpers.execute(apiKeyQueries.insertSubscriptionQuery,
      apiKeyQueries.apiKeyToDbParams(apiKey))
      .then((result: cassandra.types.ResultSet) => {
        logger.info(`API key created for appId: ${appId}.`);
        return decrypt(apiKey.key, settings.aesEncryptionKey);
      }).catch((error) => {
        logger.error(`Error while creating api key ${error}`);
        throw Error(`Unable to create API key. Please try again or try after sometime.`);
      });
  }

  /**
   * This method updates api key for the provided appId.
   *
   * @param appId
   * @param updatedBy
   */
  public async updateApiKey(
    appId: string,
    updatedBy: string,
    ): Promise<string> {

    let apiKey: ApiKey;
    // Check if api key exists for the provided appId. If exists,
    // update api key.
    try {
      await this.getApiKey(appId);
    } catch (err) {
      if (err instanceof NotFound) {
        logger.info(`API key doesn't exist for the appId: ${appId}.`);
        throw Error(`API key doesn't exist for the appId.`);
      } else {
        logger.error(err);
        throw Error(`Unable to update API key. Please try again or try after sometime.`);
      }
    }

    logger.info('Updating api key...');
    let apiToken = createRandomToken(); // create new random api token
    await encrypt(apiToken, settings.aesEncryptionKey).then((value) => {
      apiToken = value;
    });
    apiKey = apiKeyQueries.getApiKeyInstance(appId, apiToken, updatedBy);
    return cassandraDBHelpers.execute(apiKeyQueries.updateApikeyQuery,
      [apiToken, appId])
      .then((result: cassandra.types.ResultSet) => {
        logger.info(`API key updated for appId: ${appId}.`);
        return decrypt(apiKey.key, settings.aesEncryptionKey);
      }).catch((error) => {
        logger.error(`Error while updating api key ${error}`);
        throw Error(`Unable to update API key. Please try again or try after sometime.`);
      });
  }
}
