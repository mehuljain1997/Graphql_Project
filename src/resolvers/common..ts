import axios from 'axios';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { toUpper } from 'lodash';
import moment from 'moment';
import randomstring from 'randomstring';
import { logger } from '../logger';
import { AuthenticationMiddleware } from '../middleware/AuthenticationMiddleware';
import { IRequest } from '../middleware/IRequest';
import { ApiKeyRepoImpl } from '../repo/ApiKeyRepo';
import { SubscriptionRepo, SubscriptionRepoCassandra } from '../repo/SubscriptionRepo';
import { ApiKeyMutationResolver } from './ApiKeyMutationResolver';
import { ApiKeyQueryResolver } from './ApiKeyQueryResolver';
import { Unauthenticated } from './exceptions/Unauthenticated';
import { SubscriptionMutationResolver } from './SubscriptionMutationResolver';
import { SubscriptionResolver } from './SubscriptionQueryResolver';

const IV_LENGTH = 16; /** For AES, this is always 16 */

export function authenticatedUserId(req: IRequest): string {
  if (req.username === undefined) {
    throw new Unauthenticated('Not authenticated');
  }
  return req.username;
}

export function isAdmin(role: string): boolean {
  if (role === undefined || role === null) {
    throw new Error('User Role not defined for the subscription');
  }
  if (toUpper(role) === 'AUTHOR') {
    return true;
  }
  return false;
}

/**
 * This method checks if authenticated user is a subscription owner (== matches userId parameter).
 * If it is not then the method will throw an exception.
 * @param req
 * @param userId
 */
export function checkSubscriptionOwner(req: IRequest, userId: string): void {
  AuthenticationMiddleware.checkAuthorizedUser(req, userId,
    `Forbidden: You are not allowed to submit a subscription request for others`);
}

export function validateArtifact(subscription: any): void {
  subscription.artifact.elements.forEach((art) => {
    ensureDateFormat(art.artifactDate);
  });
}

export function validateAppId(appId: string): void {
  if (appId && appId.length > 50) {
    throw new Error('Invalid application Id');
  }
}

export function ensureDateFormat(date: string): void {
  const isValidDate: boolean = moment(date, moment.ISO_8601, true).isValid();
  if (!isValidDate) {
    throw new Error(`Invalid ISO artifactDate format : ${date}`);
  }
}

export function subscriptionResolverFactory(
  subscriptionRepo: SubscriptionRepo,
): SubscriptionResolver {
  return new SubscriptionResolver(subscriptionRepo);
}

export function defaultSubscriptionResolverFactory(): SubscriptionResolver {
  return subscriptionResolverFactory(new SubscriptionRepoCassandra());
}

export function subscriptionMutationResolverFactory(
  subscriptionRepo: SubscriptionRepo,
): SubscriptionMutationResolver {
  return new SubscriptionMutationResolver(subscriptionRepo);
}

export function defaultSubscriptionMutationResolverFactory(): SubscriptionMutationResolver {
  return subscriptionMutationResolverFactory(new SubscriptionRepoCassandra());
}

export function apiKeyResolverFactory(): ApiKeyMutationResolver {
  return new ApiKeyMutationResolver(new ApiKeyRepoImpl());
}

export function apiKeyQueryResolverFactory(): ApiKeyQueryResolver {
  return new ApiKeyQueryResolver(new ApiKeyRepoImpl());
}

export function createRandomToken(): string {
  return randomstring.generate({
    length: 48,
    charset: 'alphanumeric',
  });
}

export function getAuthenticationPolicy(req: IRequest): string {
  let authPolicy: string = '';
  if (req['isAuthenticated'] && req['auth_policy']
    && req['auth_policy'] === AuthenticationMiddleware.AUTH_POLICY_API_KEY) {
    authPolicy = AuthenticationMiddleware.AUTH_POLICY_API_KEY;
  } else if (req['isAuthenticated'] && req['auth_policy']
    && req['auth_policy'] === AuthenticationMiddleware.AUTH_POLICY_BEARER) {
    authPolicy = AuthenticationMiddleware.AUTH_POLICY_BEARER;
  }
  return authPolicy;
}

export function encryptSync(
  text: string,
  secret: string,
): string {
  if (secret.length !== 32) {
    throw new Error('Invalid length of secret. Must be 256 bytes or 32 characters long');
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(secret), iv);
  const cipherInitial = cipher.update(Buffer.from(text));
  const encrypted = Buffer.concat([cipherInitial, cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSync(
  text: string,
  secret: string,
): string {
  if (secret.length !== 32) {
    throw new Error('Invalid length of secret. Must be 256 bytes or 32 characters long');
  }
  const [iv, encrypted]: string[] = text.split(':');
  const decipher = createDecipheriv(
    'aes-256-cbc',
    Buffer.from(secret),
    Buffer.from(iv, 'hex'),
  );
  const decipherInitial = decipher.update(Buffer.from(encrypted, 'hex'));
  const decrypted = Buffer.concat([decipherInitial, decipher.final()]);

  return decrypted.toString();
}

export async function encrypt(
  text: string,
  secret: string,
): Promise<string> {
  try {
    const encryptedValue: string = encryptSync(text, secret);
    logger.info(`Encrypted value: ${encryptedValue}`);
    return encryptedValue;
  } catch (err) {
    throw err;
  }
}

export async function decrypt(
  text: string,
  secret: string,
): Promise<string> {
  try {
    const decryptedValue: string = decryptSync(text, secret);
    logger.debug(`Decrypted value: ${decryptedValue}`);
    return decryptedValue;
  } catch (err) {
    throw err;
  }
}

/**
 * This utility method returns a string array with parsed values of appId & token
 * from apiKey
 *
 * @param apiKey
 */
export function parseAppIdAndToken(apiKey: string): string[] {
  const parsedValues: string[] = [];
  if (apiKey) {
    const index: number = apiKey.lastIndexOf(':');
    if (index > -1) {
      const appId: string = apiKey.substring(0, index);
      const token: string = apiKey.split(':').pop() || '';
      parsedValues[0] = appId;
      parsedValues[1] = token;
    }
  }
  logger.debug(`Parsed appid & token: ${parsedValues}`);
  return parsedValues;
}

  /**
   * This is a utility method to send network calls of type GET.
   *
   * @param url
   * @param config
   */
export function get(url: string, config: object): Promise<any>  {
  logger.debug(`post url: ${url}`);
  logger.debug(`post config: ${JSON.stringify(config)}`);

  return axios.get(url, config)
    .then((response) => {
      logger.debug(`Post request response: ${JSON.stringify(response.data)}`);
      return response.data;
    })
    .catch((error) => {
      logger.error(`Error in POST method(Util): ${error}`);
      throw error;
    });
}
