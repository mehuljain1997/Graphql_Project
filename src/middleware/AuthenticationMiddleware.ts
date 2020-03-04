import axios from 'axios';
import * as _ from 'lodash';
import qs from 'qs';
import requestPromise from 'request-promise';
import { Next, Response } from 'restify';
import { BadRequestError, InternalServerError } from 'restify-errors';
import { ForbiddenError } from 'type-graphql';
import { settings } from '../config/config';
import { logger } from '../logger';
import { ApiKey } from '../models/ApiKey';
import { ApiKeyRepo, ApiKeyRepoImpl } from '../repo/ApiKeyRepo';
import { parseAppIdAndToken } from '../resolvers/commons';
import { NotFound } from '../resolvers/exceptions/NotFound';
import { Unauthorized } from '../resolvers/exceptions/Unauthorized';
import { IRequest } from './IRequest';
import { IRouteOptions } from './IRouteOptions';

interface UserDetails {
  email: string;
  id: string;
}

enum OperationType {
  QUERY = 'QUERY', MUTATION = 'MUTATION', REST = 'REST',
}

interface OperationDetails {
  operationName: string;
  operationType: OperationType;
}

/**
 * This is a middleware Class which contains methods to perform authentication header validation
 * and read authentication plugin response.
 */
export class AuthenticationMiddleware {

  public static graphQlPath: IRouteOptions = {
    path: '/graphql',
    authRequired: true,
  };

  public static healthCheckPath: IRouteOptions = {
    path: '/health/ping',
    authRequired: false,
    version: settings.apiVersion,
  };

  public static subscriptionsPath: IRouteOptions = {
    path: '/subscriptions',
    authRequired: true,
    version: settings.apiVersion,
  };

  public static graphQlUIPath: IRouteOptions = {
    path: '/graphiql',
    authRequired: false,
  };

  public static AUTH_POLICY_BEARER: string = 'bearer';

  public static AUTH_POLICY_API_KEY: string = 'apiKey';

  /**
   * This method checks for the required authentication headers.
   * @param req
   * @param res
   * @param next
   */
  public static checkAuthentication(req: IRequest, res: Response, next: Next): any {
    const w3idAuthPluginRequest = req as IRequest;
    const route = (w3idAuthPluginRequest.getRoute() as any).spec as IRouteOptions;
    if (route.authRequired) {
      if (process.env.APP_ENVIRONMENT === 'production') {
        AuthenticationMiddleware.ensureAuthenticated(req, res, next);
      } else {
        try {
          const authorization: any = _.get(req, 'headers.authorization');
          logger.debug(`Authorization: ${authorization}`);
          if (!_.isEmpty(authorization) && authorization.includes('id') && authorization.includes('email')) {
            const spaceIndex: number = _.indexOf(authorization, ' ');
            const token: string = authorization.substring(spaceIndex + 1);
            // To remove hidden/special characters in the string
            const details: UserDetails = AuthenticationMiddleware.stringToJSON(token);
            req.username = details['id'];
            req['isAuthenticated'] = true;
            req['auth_policy'] = AuthenticationMiddleware.AUTH_POLICY_BEARER;
            logger.debug(` ** User Authenticated successfully **: ${req.username}`);
            return next();
          }
          AuthenticationMiddleware.ensureAuthenticated(req, res, next);
        } catch (err) {
          logger.error(`Invalid token format: ${err}`);
          res.send(400, { code: 400, message: `Bad Request token format: ${err}` });
          return next(false);
        }
      }
    } else {
      return next();
    }
  }

  /**
   * This method checks rules based on authentication headers before authentication.
   * It can respond with 401 code.
   * Example: API key based authentication strategy must be used for deleteCascade Mutation.
   * @param req
   * @param res
   * @param next
   */
  public static checkPreAuthentication(req: IRequest, res: Response, next: Next): any {
    const operationDetails: OperationDetails | undefined = AuthenticationMiddleware.getOperationDetails(req);
    if (operationDetails === undefined) {
      return next();
    }
    const errMessage: string | undefined =
      AuthenticationMiddleware.getPreAuthenticationErrorMessage(req, operationDetails);
    if (errMessage === undefined) {
      return next();
    }
    res.send(401, { code: 401, message: errMessage });
    return next(false);
  }

  /**
   * This method checks rules based on authentication headers after authentication.
   * It can respond with 403 code.
   * Example: Authorization for operations related to API keys.
   * @param req
   * @param res
   * @param next
   */
  public static checkPostAuthentication(req: IRequest, res: Response, next: Next): any {
    const operationDetails: OperationDetails | undefined = AuthenticationMiddleware.getOperationDetails(req);
    if (operationDetails === undefined) {
      return next();
    }
    switch (operationDetails.operationType) {
      case OperationType.QUERY: {
        switch (operationDetails.operationName) {
          case 'getApiKey': {
            logger.info('Checking for user authorization');
            if (!AuthenticationMiddleware.isAuthorizedToRequestApiKey(req)) {
              // tslint:disable-next-line:max-line-length
              res.send(403, { code: 403, message: `You are not authorized for ${operationDetails.operationName} Query.` });
              return next(false);
            }
            return next();
          }
        }
        return next();
      }
      case OperationType.MUTATION: {
        switch (operationDetails.operationName) {
          case 'apiKey':
          case 'updateApiKey': {
            logger.info('Checking for user authorization');
            if (!AuthenticationMiddleware.isAuthorizedToRequestApiKey(req)) {
              // tslint:disable-next-line:max-line-length
              res.send(403, { code: 403, message: `You are not authorized for ${operationDetails.operationName} Mutation.` });
              return next(false);
            }
            return next();
          }
        }
        return next();
      }
    }
    return next();
  }

  /**
   * This method checks if authenticated user matches with userId from parameter.
   * If it does not match then the method will throw an exception.
   * @param req
   * @param userId
   * @param errMessage
   */
  public static checkAuthorizedUser(req: IRequest, userId: string, errMessage?: string): void {
    if (!AuthenticationMiddleware.getInstance().isAuthorizedUser(req, userId)) {
      throw new Unauthorized(errMessage ? errMessage : 'Forbidden');
    }
  }

  /**
   * @description Converts a string response to an object.
   * @param {string} string - The string you want to convert.
   * @returns {object} - an object.
   */
  public static stringToJSON(input: string): any {
    let newInput = input.replace(/\\n/g, '\\n')
      .replace(/\\'/g, '\\\'')
      .replace(/\\"/g, '\\"')
      .replace(/\\&/g, '\\&')
      .replace(/\\r/g, '\\r')
      .replace(/\\t/g, '\\t')
      .replace(/\\b/g, '\\b')
      .replace(/\\f/g, '\\f');
    // remove non-printable and other non-valid JSON chars
    newInput = newInput.replace(/[\u0000-\u001F]+/g, '');
    return JSON.parse(input);
  }

  /**
   * This method makes the AuthenticationMiddleware instance singleton.
   */
  public static getInstance(): AuthenticationMiddleware {
    if (!AuthenticationMiddleware.instance) {
      AuthenticationMiddleware.instance = new AuthenticationMiddleware();
    }
    return AuthenticationMiddleware.instance;
  }

  /**
   * This method validates w3Id and JWT based token
   *
   * @param req
   * @param res
   * @param next
   * @returns whether to forward to next layer or not
   */
  public static async ensureAuthenticated(req: IRequest, res: Response, next: Next): Promise<any> {
    try {
      if (!req.headers.authorization) {
        logger.info('Missing required authentication header in the request.');
        res.send(401, { code: 401, message: 'Missing required authentication header' });
        return next(false);
      }
      const authorization: string = _.get(req, 'headers.authorization');
      const bearerToken: string[] = _.split(authorization, ' ');
      if (bearerToken.length < 2) {
        logger.error('Missing required authentication token');
        res.send(401, { code: 401, message: 'Missing required authentication token' });
        return next(false);
      }

      // Check if request to be authenticated by API key
      if (bearerToken[0] === AuthenticationMiddleware.AUTH_POLICY_API_KEY) {
        try {
          const isValidApiKey: boolean = await AuthenticationMiddleware.verifyApiKey(res, bearerToken[1]);
          if (isValidApiKey) {
            req['isAuthenticated'] = true;
            req['auth_policy'] = AuthenticationMiddleware.AUTH_POLICY_API_KEY;
            logger.info(` ** Authenticated successfully by api key **`);
            return next();
          }
          res.send(401, { code: 401, message: 'Api key is not valid. Please verify and try again' });
          logger.warn(`Unable to authenticate with the provided api key`);
          return next(false);
        } catch (err) {
          logger.error(`Error while validating api token: ${err}`);
          return next(false);
        }
      }

      if (bearerToken[1].length > 50) {
        try {
          // request-promise will throw an error for any non 200 range response (unless simple: false option is set)
          const jwtRes = await AuthenticationMiddleware.introspectJWT(res, authorization);
          logger.debug(`Response from JWT : ${JSON.stringify(jwtRes)}`);
          const userId: string = _.get(jwtRes, 'uid');
          if (!_.isEmpty(userId)) {
            req.username = userId;
            req['isAuthenticated'] = true;
            req['auth_policy'] = AuthenticationMiddleware.AUTH_POLICY_BEARER;
            logger.debug(` ** User Authenticated successfully **: ${req.username}`);
            return next();
          }
          res.send(401, { code: 401, message: 'Unable to retreive userId from JWT response' });
          logger.error(`Unable to retreive userId from JWT response`);
          return next(false);
        } catch (err) {
          logger.error(`Error while validating JWT token: ${err}`);
          return next(false);
        }
      }

      try {
        const resp = await AuthenticationMiddleware.introspectW3ID(res, bearerToken[1]);
        logger.debug(`Response from W3ID Introspect : ${JSON.stringify(resp)}`);
        const mail: string = _.get(resp, 'sub');
        if (mail === null || mail === undefined) {
          res.send(401, { code: 401, message: 'Unable to retrieve mailId from w3Id auth response' });
          logger.error('Unable to retrieve mailId from w3Id auth response');
          return next(false);
        }
        const upProfiles: string = `${settings.upUrl}`.concat(`&emails=${mail}`);
        try {
          const bpResp = await requestPromise.get({
            method: 'GET',
            uri: upProfiles,
            headers: {
              'User-Agent': 'Request-Promise',
            },
            json: true,
          });
          logger.debug(`Response from bluepages ${JSON.stringify(bpResp[0])}`);
          const uid: string = _.get(bpResp[0], 'userId');
          if (!_.isEmpty(uid)) {
            req.username = uid;
            req['isAuthenticated'] = true;
            req['auth_policy'] = AuthenticationMiddleware.AUTH_POLICY_BEARER;
            logger.debug(` ** User Authenticated successfully **: ${req.username}`);
            return next();
          }
          res.send(404, { code: 404, message: `Profile Not Found in bluepages for ${mail}` });
          logger.error(`Profile Not Found in bluepages for ${mail}`);
          return next(false);
        } catch (err) {
          logger.error(`Error while retrieving bluepages profile: ${err}`);
        }
        res.send(401, { code: 401, message: 'Unable to retrieve bluepages profile' });
        logger.error('Unable to retrieve bluepages profile');
        return next(false);
      } catch (err) {
        logger.warn(`Error during w3Id token validation ${err}`);
        return next(false);
      }
    } catch (err) {
      logger.error(`Errorr in ensureAuthenticated: ${err}`);
      return next(false);
    }
  }

  /**
   * This method validates the w3ID based token
   *
   * @param res
   * @param token
   * @returns userdetails
   */
  public static async introspectW3ID(res: Response, token: string): Promise<any> {
    let result: any;
    try {
      result = await axios.request({
        data: qs.stringify({
          token,
          client_id: `${settings.clientId}`,
          client_secret: `${settings.clientSecret}`,
        }),
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        method: 'post',
        url: `${settings.introspectionUrl}`,
      });
    } catch (e) {
      logger.error(`Error while validating w3Id token ${e}`);
      result = e.response;
    }
    if (result.status === undefined || result.status === 400) {
      res.send(400, { code: 400, message: 'Bad Request Error' });
      logger.error('Bad Request Error while Validating w3Id token');
      throw new BadRequestError('Bad Request Error while Validating w3Id token');
    }
    if (result.status !== 200) {
      res.send(result.status, { code: result.status, message: 'Internal Server Error' });
      logger.error('Internal Server Error while Validating w3Id token');
      throw new InternalServerError('Internal Server Error while Validating w3Id token');
    }
    const { data }: any = result;
    if (!data.active) {
      res.send(401, { code: 401, message: 'w3ID access token invalid or expired' });
      logger.warn('w3ID access token invalid or expired');
      // tslint:disable-next-line: no-string-throw
      throw 'w3ID access token is invalid or expired';
    }
    return data;
  }

  /**
   * This method validates the JWT based token
   *
   * @param res
   * @param next
   * @param token
   * @returns userdetails
   */
  public static async introspectJWT(res: Response, token: any): Promise<any> {
    try {
      // request-promise will throw an error for any non 200 range response (unless simple: false option is set)
      const authRes = await requestPromise.get({
        method: 'GET',
        uri: `${settings.jwtUrl}`,
        headers: {
          Authorization: token,
        },
        json: true,
      });
      return authRes;
    } catch (err) {
      logger.warn(`introspectJWT error: ${err}`);
    }
    logger.warn('Invalid JWT token or expired');
    res.send(401, { code: 401, message: 'Invalid JWT token or expired' });
    // tslint:disable-next-line: no-string-throw
    throw 'JWT token is invalid.';
  }

  /**
   * This method verifies the api key requestor is authorized or not.
   *
   * @param req
   */
  public static isAuthorizedToRequestApiKey(req: IRequest): boolean {
    const authenticatedUser: string = _.toUpper(req.username);
    const apiKeyAuthorizedUserIds: string[] = _.split(settings.apiKeyAuthorizedUserIds, ',');
    const flag: boolean = req['isAuthenticated'] && apiKeyAuthorizedUserIds.indexOf(authenticatedUser) !== -1;
    logger.debug(`Authorization status: UID ${_.toUpper(authenticatedUser)} :: ${flag}`);
    return flag;
  }

  /**
   * This method verifies if the the api key is valid nor not.
   *
   * @param req
   */
  public static isValidApiKey(req: IRequest): string {
    let message: string = 'API key is not valid';
    if (req['isAuthenticated']) {
      if (req['auth_policy'] === AuthenticationMiddleware.AUTH_POLICY_API_KEY) {
        message = 'API key is valid';
      } else {
        throw Error(`Missing or invalid apiKey`);
      }
    } else {
      throw new ForbiddenError();
    }
    return message;
  }

  /**
   * This method validates the apikey of the incoming request
   *
   * @param res
   * @param apiKey
   */
  public static async verifyApiKey(res: Response, apiKey: any): Promise<boolean> {
    let flag: boolean = false;
    try {
      const decodedBase64Key = Buffer.from(apiKey, 'base64').toString('utf-8');
      const [appId, apiToken]: string[] = parseAppIdAndToken(decodedBase64Key);
      logger.debug(`app id: ${appId}`);
      logger.debug(`app token: ${apiToken}`);
      if (appId && apiToken) {
        const apiKeyRepo: ApiKeyRepo = ApiKeyRepoImpl.getInstance();
        try {
          // Fetch api key from DB and compare with incoming token
          const persistedKey: ApiKey = await apiKeyRepo.getApiKey(appId);
          if (persistedKey.key === apiToken) {
            flag = true;
          }
        } catch (err) {
          if (err instanceof NotFound) {
            return flag;
          }
          throw err;
        }
      }
      return flag;
    } catch (err) {
      logger.error(`Api key verification error: ${err}`);
      res.send(500, { code: 500, message: 'Unable to verify API key' });
      throw new Error('Unable to verify API key');
    }
  }

  private static instance: AuthenticationMiddleware;

  private static getPreAuthenticationErrorMessage(
    req: IRequest, operationDetails: OperationDetails,
  ): string | undefined {
    switch (operationDetails.operationType) {
      case OperationType.QUERY: {
        switch (operationDetails.operationName) {
          case 'getApiKey': {
            return !AuthenticationMiddleware.usesAuthPolicyBearer(req) ?
              `w3id/jwt token based authentication strategy must be used for ${operationDetails.operationName} Query.` :
              undefined;
          }
          case 'subscriptions':
          case 'userSubscriptions': {
            return !AuthenticationMiddleware.usesAuthPolicyBearer(req)
              && !AuthenticationMiddleware.usesAuthPolicyApiKey(req) ?
              // tslint:disable-next-line:max-line-length
              `w3id/jwt token or API key based authentication strategy must be used for ${operationDetails.operationName} Query.` :
              undefined;
          }
        }
        return undefined;
      }
      case OperationType.MUTATION: {
        switch (operationDetails.operationName) {
          case 'apiKey':
          case 'delete':
          case 'deleteCascade':
          case 'subscribe':
          case 'unsubscribe':
          case 'updateApiKey':
          case 'updateSubscription': {
            return !AuthenticationMiddleware.usesAuthPolicyBearer(req) ?
              // tslint:disable-next-line:max-line-length
              `w3id/jwt token based authentication strategy must be used for ${operationDetails.operationName} Mutation.` :
              undefined;
          }
          case 'subscribeUsers':
          case 'subscribeUsersWithSettings': {
            return !AuthenticationMiddleware.usesAuthPolicyApiKey(req) ?
              // tslint:disable-next-line:max-line-length
              `API key based authentication strategy must be used for ${operationDetails.operationName} Mutation.` :
              undefined;
          }
        }
        return undefined;
      }
      case OperationType.REST: {
        switch (operationDetails.operationName) {
          case 'subscriptions': {
            return !AuthenticationMiddleware.usesAuthPolicyBearer(req)
              && !AuthenticationMiddleware.usesAuthPolicyApiKey(req) ?
              // tslint:disable-next-line:max-line-length
              `w3id/jwt token or API key based authentication strategy must be used for ${operationDetails.operationName} Query.` :
              undefined;
          }
        }
        return undefined;
      }
    }
    return undefined;
  }

  private static getOperationDetails(req: IRequest): OperationDetails | undefined {
    const pathValue: string = req.path();
    if (pathValue && pathValue === '/subscriptions') {
      logger.debug(`Path value: ${req.path()}`);
      return { operationName: 'subscriptions', operationType: OperationType.REST };
    }
    const operationType: OperationType | undefined = AuthenticationMiddleware.getOperationType(req.body.query);
    if (operationType === undefined) {
      return undefined;
    }
    const operationName: string | undefined = AuthenticationMiddleware.getOperationName(req.body.query);
    if (operationName === undefined) {
      return undefined;
    }
    return { operationName, operationType };
  }

  private static getOperationType(query: string): OperationType | undefined {
    const trimmed = query.trim();
    if (trimmed.startsWith('query')) {
      return OperationType.QUERY;
    }
    if (trimmed.startsWith('mutation')) {
      return OperationType.MUTATION;
    }
    return undefined;
  }

  private static getOperationName(query: string): string | undefined {
    const ixOfCurlyBracket: number = query.indexOf('{');
    if (ixOfCurlyBracket === -1) {
      return undefined;
    }
    const ixOfParenthesis: number = query.indexOf('(', ixOfCurlyBracket);
    if (ixOfParenthesis === -1) {
      return undefined;
    }
    return query.substr(ixOfCurlyBracket + 1, ixOfParenthesis - ixOfCurlyBracket - 1).trim();
  }

  private static usesAuthPolicyBearer(req: IRequest): boolean {
    if (!req.headers.authorization) {
      return false;
    }
    const authorization: string = _.get(req, 'headers.authorization');
    const bearerToken: string[] = _.split(authorization, ' ');
    if (bearerToken.length < 2) {
      return false;
    }
    return bearerToken[0].toLowerCase() === AuthenticationMiddleware.AUTH_POLICY_BEARER.toLowerCase();
  }

  private static usesAuthPolicyApiKey(req: IRequest): boolean {
    if (!req.headers.authorization) {
      return false;
    }
    const authorization: string = _.get(req, 'headers.authorization');
    const bearerToken: string[] = _.split(authorization, ' ');
    if (bearerToken.length < 2) {
      return false;
    }
    return bearerToken[0] === AuthenticationMiddleware.AUTH_POLICY_API_KEY;
  }

  /**
   * This method compares the User id as found in the incoming Subscription request
   * and the authenticated User ID (after token auth).
   *
   * @param req
   * @param userId
   */
  public isAuthorizedUser(req: IRequest, userId: string): boolean {
    let flag: boolean = false;
    if (req['isAuthenticated'] && (_.toUpper(req.username) === _.toUpper(userId))) {
      flag = true;
    }
    logger.debug(`Authorization status: UID ${userId} :: ${flag}`);
    return flag;
  }

  /**
   * This method verifies whether the request is authorized to perform the action.
   *
   * @param req
   */
  public isAuthorizedRequest(req: IRequest): boolean {
    let flag: boolean = false;
    if (req['isAuthenticated'] && req['auth_policy']
      && req['auth_policy'] === AuthenticationMiddleware.AUTH_POLICY_API_KEY) {
      flag = true;
    } else if (req['isAuthenticated'] && req['auth_policy']
      && req['auth_policy'] === AuthenticationMiddleware.AUTH_POLICY_BEARER) {
      flag = true;
    }
    logger.debug(`Authorization status of the request :: ${flag}`);
    return flag;
  }
}
 