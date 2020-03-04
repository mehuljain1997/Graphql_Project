import * as cassandra from 'cassandra-driver';
import { toLower, toUpper } from 'lodash';
import { settings } from '../config/config';
import { logger } from '../logger';
import { ApiKey } from '../models/ApiKey';
import { decrypt } from '../resolvers/commons';

export const idFields = ['app_id'];
export const selectApiKeyByAppId: string = `select JSON * from apiKeys where app_id= ?`;
export const apiKeyFields = idFields.concat(['key', 'created_by', 'created_date', 'updated_date']);
export const apiKeyInsertFields = apiKeyFields.join(',');
export const apiKeyInsertParams = apiKeyFields.map(_ => '?').join(',');
export const insertSubscriptionQuery = `insert into ${apiKeysTableName()}
  (${apiKeyInsertFields}) values
  (${apiKeyInsertParams})`;
export const updateApikeyQuery = `update ${apiKeysTableName()} set key = ?
where app_id = ?`;
export const deleteApiKeyQuery: string
  = `delete from ${apiKeysTableName()} where app_id= ? `;
export function apiKeysTableName(): string {
  return 'apiKeys';
}

export function getApiKeyInstance(
    appId: string,
    key: string,
    createdBy: string,
  ): ApiKey {
  const now = new Date();
  const apiKey: ApiKey = {
    appId,
    key,
    createdBy,
    createdDate: now,
    updatedDate: now,
  };
  return apiKey;
}

export function appKeyPKeyValues(
    appId: string,
  ): any[] {
  const pkValues = [toLower(appId)];
  logger.debug('appKeyPKeyValues: ', pkValues);
  return pkValues;
}

export async function rowToApiKey(row: cassandra.types.Row): Promise<ApiKey> {
  const decryptedKey: string = await decrypt(row['key'], settings.aesEncryptionKey);
  const apiKey: ApiKey = {
    appId: row['app_id'],
    key: decryptedKey,
    createdBy: row['created_by'],
    createdDate: row['created_date'],
    updatedDate: row['updated_date'],
  };
  logger.debug('Returning api key: ', apiKey, ' Row: ', row);
  return apiKey;
}

export function apiKeyToDbParams(
    apiKey: ApiKey,
  ): any[] {
  return [
    toLower(apiKey.appId),
    apiKey.key,
    toUpper(apiKey.createdBy),
    apiKey.createdDate,
    apiKey.updatedDate,
  ];
}
