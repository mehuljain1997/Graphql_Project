import axios, { AxiosResponse } from 'axios';
import requestPromise from 'request-promise';
import { Response } from 'restify';
import { BadRequestError, InternalServerError, UnauthorizedError } from 'restify-errors';
import { AuthenticationMiddleware } from '../../../middleware/AuthenticationMiddleware';
import { ApiKey } from '../../../models/ApiKey';
import { ApiKeyRepoImpl } from '../../../repo/ApiKeyRepo';
import { NotFound } from '../../../resolvers/exceptions/NotFound';
import { bluepagesResponse } from '../bluepagesResponse';
import { ErrResponse } from '../ErrResponse';
import { jwtResponse } from '../JWTResponse';

jest.mock('axios');
jest.mock('request-promise');

const JWT_TOKEN: string = `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZ
CI6Im55ZW51bXVsQHVzLmlibS5jb20iLCJjbiI6Ik5hcmFzaW1oYSBSZWRkeSBZZW51bXVsYSIsInVpZCI6IkMtTDNDVjg5NyIsImlzVzNIb21lc`;

const W3ID_TOKEN: string = `Bearer token`;

const API_KEY: string = `apiKey bm90aWZpY2F0aW9uX3Rlc3Q6NlhLY0pmZVpHQ2prczBXRFFwRzNYRHN3R0VySzlhTVRHT0dvZmZKcVhQa1dDZ1RZ`; // tslint:disable: max-line-length
const API_TOKEN_BASE64 = `bm90aWZpY2F0aW9uX3Rlc3Q6NlhLY0pmZVpHQ2prczBXRFFwRzNYRHN3R0VySzlhTVRHT0dvZmZKcVhQa1dDZ1RZ`; // tslint:disable: max-line-length
const API_TOKEN_BASE64_INVALID = `bm90aWZpY2F0aW9uX3Rlc3Q6NkdLY0pmZVpHQ2prczBXRFFwRzNYRHN3R0VySzlhTVRHT0dvZmZKcVhQa1dDZ1RZ`; // tslint:disable: max-line-length


const mockApiKey: ApiKey = {
  appId: 'notification_test',
  key: '6XKcJfeZGCjks0WDQpG3XDswGErK9aMTGOGoffJqXPkWCgTY',
  createdBy: 'unit-test',
  createdDate: new Date(),
  updatedDate: new Date(),
};
/**
 * Below are the test cases for Authentication Middleware
 */
// tslint:disable: typedef
describe('requestHandler', () => {

  afterEach(() => {
    process.env.APP_ENVIRONMENT = 'dev';
    jest.clearAllMocks();
  });

  /**
   * This test case handles the missing authoriztion header scenario.
   */
  it('missing authorization header', async () => {

    const route: object = { path: 'graphql', spec: { authRequired: true } };
    const req = {
      getRoute: jest.fn().mockReturnValue(route) as object,
    } as any;
    req.headers = {};
    const res = {} as any;
    let respObj = {} as any;
    let statusCode: number = 0;
    res.send = ((code: number, obj: any) => {
      statusCode = code;
      respObj = obj;
      return obj;
    });
    const next = jest.fn() as any;
    await AuthenticationMiddleware.checkAuthentication(req, res, next);
    expect(statusCode).toEqual(401);
    expect(respObj.code).toEqual(401);
    expect(respObj.message).toEqual('Missing required authentication header');
  });

  /**
   * This test case checks for authentication is disabled.
   */
  it('authRequired is disabled and should call next middleware', async () => {

    const route: object = { path: 'graphql', spec: { authRequired: true } };
    const req = {
      getRoute: jest.fn().mockReturnValue(route) as any,
    } as any;
    const res: Response = {} as any;
    const next = jest.fn() as any;
    await AuthenticationMiddleware.checkAuthentication(req, res, next);
    expect(next).toBeCalled();
  });

  /**
   * This test case checks for valid test token in the headers present in the
   * incoming request.
   */
  it('authRequired is enabled and should authorize for fake valid token format for test environment', async () => {

    const route: object = { path: 'graphql', spec: { authRequired: true } };
    const req = {
      getRoute: jest.fn().mockReturnValue(route) as any,
    } as any;
    req.headers = { authorization: `Bearer {"email":"xxxxxx@us.ibm.com","id":"AAAABBCCC"}` };
    const res: Response = {} as any;
    const next = jest.fn() as any;
    await AuthenticationMiddleware.checkAuthentication(req, res, next);
    expect(req['isAuthenticated']).toEqual(true);
    expect(req.username).toEqual('AAAABBCCC');
    expect(next).toHaveBeenCalled();
  });

  /**
   * This test case checks for valid test token in the headers present in the
   * incoming request.
   */
  it('authRequired is enabled and should authorize for valid w3Id/JWT token format for test environment', async () => {

    const route: object = { path: 'graphql', spec: { authRequired: true } };
    const req = {
      getRoute: jest.fn().mockReturnValue(route) as any,
    } as any;
    req.headers = { authorization: `Bearer ${W3ID_TOKEN}` };
    const res: Response = {} as any;
    const next = jest.fn() as any;
    const spy = jest.spyOn(AuthenticationMiddleware, 'ensureAuthenticated');
    await AuthenticationMiddleware.checkAuthentication(req, res, next);
    expect(spy).toHaveBeenCalled();
  });

  /**
   * This test case handles the missing token in header scenario.
   */
  it('missing authorization token in header', async () => {

    const route: object = { path: 'graphql', spec: { authRequired: true } };
    const req = {
      getRoute: jest.fn().mockReturnValue(route) as object,
    } as any;
    req.headers = { authorization: 'Bearer' };

    const res: Response = {} as any;
    let respObj: ErrResponse = {} as any;
    let statusCode: number = 0;
    res.send = ((code: number, obj: any) => {
      statusCode = code;
      respObj = obj;
      return obj;
    });
    const next = jest.fn() as any;
    await AuthenticationMiddleware.checkAuthentication(req, res, next);
    expect(statusCode).toEqual(401);
    expect(respObj.code).toEqual(401);
    expect(respObj.message).toEqual('Missing required authentication token');
    expect(next).toHaveBeenCalled();
  });

  /**
   * Test case which covers success behaviour from JWT introspect.
   */
  it('success response case from JWT introspect', async () => {

    const res: Response = {} as any;
    res.send = ((code: number, obj) => {
      return obj;
    });
    const next = jest.fn() as any;
    (requestPromise.get as jest.Mock).mockResolvedValue(jwtResponse);
    const response = await AuthenticationMiddleware.introspectJWT(res, JWT_TOKEN);
    expect(response.id).toEqual(jwtResponse.id);
    expect(response.uid).toEqual(jwtResponse.uid);
    expect(response).not.toBeNull();
  });

  /**
   * Test case which covers behaviour of introspectW3ID.
   */
  it('Bad request error case for W3ID introspect', async () => {

    const res: Response = {} as any;
    let respObj: ErrResponse = {} as any;
    let statusCode: number = 0;
    res.send = ((code: number, obj) => {
      statusCode = code;
      respObj = obj;
      return obj;
    });
    const error = {
      response: {
        status: 400,
      },
    } as any;
    const next = jest.fn() as any;
    (axios.request as jest.Mock).mockRejectedValueOnce(error);
    try {
      await AuthenticationMiddleware.introspectW3ID(res, W3ID_TOKEN);
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestError);
    }
    expect(statusCode).toEqual(400);
    expect(respObj.code).toEqual(400);
    expect(respObj.message).toEqual('Bad Request Error');
  });

  /**
   * Test case which covers behaviour of InternalServerError in introspectW3ID.
   */
  it('InternalServerError case for W3ID introspect', async () => {

    const res: Response = {} as any;
    let respObj: ErrResponse = {} as any;
    let statusCode: number = 0;
    res.send = ((code: number, obj) => {
      statusCode = code;
      respObj = obj;
      return obj;
    });
    const error = {
      response: {
        status: 500,
      },
    } as any;
    const next = jest.fn() as any;
    (axios.request as jest.Mock).mockRejectedValueOnce(error);
    try {
      await AuthenticationMiddleware.introspectW3ID(res, W3ID_TOKEN);
    } catch (e) {
      expect(e).toBeInstanceOf(InternalServerError);
    }
    expect(statusCode).toEqual(500);
    expect(respObj.code).toEqual(500);
    expect(respObj.message).toEqual('Internal Server Error');
  });

  /**
   * Test case which covers behaviour of w3ID access token invalid or expired in introspectW3ID.
   */
  it('W3ID access token invalid or expired for W3ID introspect', async () => {

    const res: Response = {} as any;
    let respObj: ErrResponse = {} as any;
    let statusCode: number = 0;
    res.send = ((code: number, obj) => {
      statusCode = code;
      respObj = obj;
      return obj;
    });
    const postResult: AxiosResponse = {
      data: {
        active: false,
      },
      status: 200,
    } as any;
    (axios.request as jest.Mock).mockResolvedValue(postResult);
    try {
      await AuthenticationMiddleware.introspectW3ID(res, W3ID_TOKEN);
    } catch (e) {
      expect(e).toMatch('w3ID access token is invalid or expired');
    }
    expect(statusCode).toEqual(401);
    expect(respObj.code).toEqual(401);
    expect(respObj.message).toEqual('w3ID access token invalid or expired');
  });

  /**
   * Test case which covers behaviour of w3ID access token valid in introspectW3ID.
   */
  it('success case of W3ID access token validation', async () => {

    const res: Response = {} as any;
    const postResult: AxiosResponse = {
      data: {
        exp: 2,
        iat: 1,
        iss: 'FAKE_ISSUER',
        sub: 'FAKE_SUBJECT',
        active: true,
      },
      status: 200,
    } as any;
    (axios.request as jest.Mock).mockResolvedValue(postResult);
    const returnObj = await AuthenticationMiddleware.introspectW3ID(res, W3ID_TOKEN);
    expect(returnObj).not.toBeNull();
    expect(returnObj.sub).toEqual(postResult.data.sub);
  });

  /**
   * Test case which covers behaviour sub not found in  W3ID response.
   */
  it('when email not found in W3ID response', async () => {

    const req = {} as any;
    req.headers = { authorization: W3ID_TOKEN };
    AuthenticationMiddleware.introspectW3ID = jest.fn().mockReturnValue(jest.autoMockOn());
    const res: Response = {} as any;
    let respObj: ErrResponse = {} as any;
    let statusCode: number = 0;
    res.send = ((code: number, obj) => {
      statusCode = code;
      respObj = obj;
      return obj;
    });
    const next = jest.fn() as any;
    await AuthenticationMiddleware.ensureAuthenticated(req, res, next);
    expect(statusCode).toEqual(401);
    expect(respObj.code).toEqual(401);
    expect(respObj.message).toEqual('Unable to retrieve mailId from w3Id auth response');
    expect(next).toHaveBeenCalled();
  });

  /**
   * Test case which covers behaviour userId not found in bluepages response.
   */
  it('when userID is not found in bluepages response', async () => {

    const req = {} as any;
    req.headers = { authorization: W3ID_TOKEN };
    const data = {
      exp: 2,
      iat: 1,
      iss: 'FAKE_ISSUER',
      sub: 'FAKE_SUBJECT',
      active: true,
    };
    AuthenticationMiddleware.introspectW3ID = jest.fn().mockReturnValue(data);
    (requestPromise.get as jest.Mock).mockResolvedValue(jest.autoMockOn());
    const res: Response = {} as any;
    let respObj: ErrResponse = {} as any;
    let statusCode: number = 0;
    res.send = ((code: number, obj) => {
      statusCode = code;
      respObj = obj;
      return obj;
    });
    const next = jest.fn() as any;
    await AuthenticationMiddleware.ensureAuthenticated(req, res, next);
    expect(statusCode).toEqual(404);
    expect(respObj.code).toEqual(404);
    expect(respObj.message).toContain('Profile Not Found in bluepages for');
    expect(next).toHaveBeenCalled();
  });

  /**
   * Test case which covers error behaviour while fetching from bluepages.
   */
  it('error case when requesting bluepages for user details', async () => {

    const req = {} as any;
    req.headers = { authorization: W3ID_TOKEN };
    const data = {
      exp: 2,
      iat: 1,
      iss: 'FAKE_ISSUER',
      sub: 'FAKE_SUBJECT',
      active: true,
    };
    AuthenticationMiddleware.introspectW3ID = jest.fn().mockReturnValue(data);
    (requestPromise.get as jest.Mock).mockRejectedValue(new Error());
    const res: Response = {} as any;
    let respObj: ErrResponse = {} as any;
    let statusCode: number = 0;
    res.send = ((code: number, obj) => {
      statusCode = code;
      respObj = obj;
      return obj;
    });
    const next = jest.fn() as any;
    await AuthenticationMiddleware.ensureAuthenticated(req, res, next);
    expect(statusCode).toEqual(401);
    expect(respObj.code).toEqual(401);
    expect(respObj.message).toEqual('Unable to retrieve bluepages profile');
    expect(next).toHaveBeenCalled();
  });

  /**
   * Test case which covers error behaviour while validating W3ID token.
   */
  it('error case while validating W3ID token', async () => {

    const req = {} as any;
    req.headers = { authorization: W3ID_TOKEN };
    AuthenticationMiddleware.introspectW3ID = jest.fn().mockRejectedValue(new Error());
    const res: Response = {} as any;
    const next = jest.fn() as any;
    await AuthenticationMiddleware.ensureAuthenticated(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  /**
   * Test case which covers behaviour when exception occurs while validating JWT token.
   */
  it('when exception occurs while validating JWT token', async () => {

    const req = {} as any;
    req.headers = { authorization: JWT_TOKEN };
    AuthenticationMiddleware.introspectJWT = jest.fn().mockRejectedValueOnce(
      new UnauthorizedError('Invalid JWT token'));
    const res: Response = {} as any;
    res.send = ((code: number, obj) => {
      return obj;
    });
    const next = jest.fn() as any;

    await AuthenticationMiddleware.ensureAuthenticated(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  /**
   * Test case which covers behaviour userId not found in  JWT response.
   */
  it('when userId not found in  JWT response', async () => {

    const req = {} as any;
    req.headers = { authorization: JWT_TOKEN };
    AuthenticationMiddleware.introspectJWT = jest.fn().mockReturnValue(jest.autoMockOn());
    const res: Response = {} as any;
    let respObj: ErrResponse = {} as any;
    let statusCode: number = 0;
    res.send = ((code: number, obj) => {
      statusCode = code;
      respObj = obj;
      return obj;
    });
    const next = jest.fn() as any;

    await AuthenticationMiddleware.ensureAuthenticated(req, res, next);
    expect(statusCode).toEqual(401);
    expect(respObj.code).toEqual(401);
    expect(respObj.message).toEqual('Unable to retreive userId from JWT response');
    expect(next).toHaveBeenCalled();
  });

  /**
   * Test case which covers behaviour userId not found in  JWT response.
   */
  it('success case validation of JWT token', async () => {

    const req = {} as any;
    req.headers = { authorization: JWT_TOKEN };
    AuthenticationMiddleware.introspectJWT = jest.fn().mockReturnValue(jwtResponse);
    const res: Response = {} as any;
    res.send = ((code: number, obj) => {
      return obj;
    });
    const next = jest.fn() as any;
    await AuthenticationMiddleware.ensureAuthenticated(req, res, next);
    expect(req.username).toEqual(jwtResponse.uid);
    expect(req['isAuthenticated']).toEqual(true);
    expect(next).toHaveBeenCalled();
  });

  /**
   * Test case which covers success behaviour from JWT introspect.
   */
  it('success response case from JWT introspect', async () => {

    const res: Response = {} as any;
    res.send = ((code: number, obj) => {
      return obj;
    });
    const response = await AuthenticationMiddleware.introspectJWT(res, JWT_TOKEN);
    expect(response).not.toBeNull();
  });

  /**
   * This method checks if user is authorized to perform an action on behalf of someone or not.
   */
  it('check user authorization - failure case', async () => {
    const route = { path: 'graphql' } as any;
    const user = bluepagesResponse.content.user.profile;
    const req = {
      authorization: { user } as any,
      getRoute: jest.fn().mockReturnValue(route) as any,
    } as any;
    const originalUser = 'CCCDDD123';
    req.headers = { authorization: 'token value' };
    const res = {} as any;
    res.send = ((message) => {
      return message;
    });
    const authMiddleware = new AuthenticationMiddleware();
    const flag: boolean = await authMiddleware.isAuthorizedUser(req, originalUser);
    expect(flag).toEqual(false);

  });

  /**
   * This method checks if user is authorized to perform an action on behalf of someone or not.
   */
  it('check user authorization - failure case', async () => {
    const req = {} as any;
    req['isAuthenticated'] = false;
    req.username = bluepagesResponse.content.user.profile.uid;
    const originalUser = 'BBDD225566';
    const authMiddleware: AuthenticationMiddleware = new AuthenticationMiddleware();
    const flag: boolean = await authMiddleware.isAuthorizedUser(req, originalUser);
    expect(flag).toEqual(false);

  });

  /**
   * This method checks if user is authorized to perform an action on behalf of someone or not.
   */
  it('check user authorization - success case', async () => {

    const req = {} as any;
    req['isAuthenticated'] = true;
    req.username = bluepagesResponse.content.user.profile.uid;
    const originalUser = 'AAABBB555';
    const authMiddleware: AuthenticationMiddleware = new AuthenticationMiddleware();
    const flag: boolean = await authMiddleware.isAuthorizedUser(req, originalUser);
    expect(flag).toEqual(true);
  });
});

describe('api key tests', () => {
  /*
  * Below test checks for valid api key
  */
  it('Verify valid ApiKey', async () => {
    const req = {} as any;
    req.username = bluepagesResponse.content.user.profile.uid;
    req['isAuthenticated'] = true;
    ApiKeyRepoImpl.prototype.getApiKey = jest.fn().mockReturnValue(mockApiKey);
    const flag: any = await AuthenticationMiddleware.verifyApiKey(req, API_TOKEN_BASE64);
    expect(flag).toEqual(true);
  });

  /*
  * Below test checks for invalid api key
  */
  it('Verify invalid ApiKey', async () => {
    const req = {} as any;
    req.username = bluepagesResponse.content.user.profile.uid;
    req['isAuthenticated'] = true;
    ApiKeyRepoImpl.prototype.getApiKey = jest.fn().mockReturnValue(mockApiKey);
    const flag: any = await AuthenticationMiddleware.verifyApiKey(req, API_TOKEN_BASE64_INVALID);
    expect(flag).toEqual(false);
  });

  /*
* Below test checks for invalid api key
*/
  it('ApiKey does not exist exception case', async () => {
    const req = {} as any;
    req.username = bluepagesResponse.content.user.profile.uid;
    req['isAuthenticated'] = true;
    ApiKeyRepoImpl.prototype.getApiKey = jest.fn().mockReturnValue(new NotFound(
      `ApiKey for the appID:  notification-test doesn't exist.`,
    ));
    try {
      const flag: any = await AuthenticationMiddleware.verifyApiKey(req, API_TOKEN_BASE64_INVALID);
      expect(false).toBeTruthy();
    } catch (err) {
      expect(true).toBeTruthy();
    }
  });

  /**
   * Below test case checks for the successful api key verification from ensureAuthenticated method
   */
  it('ensureAuthenticated with right API key', async () => {
    const req = {} as any;
    req.headers = { authorization: API_KEY };
    AuthenticationMiddleware.verifyApiKey = jest.fn().mockReturnValue(true);
    const res: Response = {} as any;
    res.send = ((code: number, obj) => {
      return obj;
    });
    const next = jest.fn() as any;
    await AuthenticationMiddleware.ensureAuthenticated(req, res, next);
    expect(req.username).toBeUndefined();
    expect(req['isAuthenticated']).toEqual(true);
    expect(req['auth_policy']).toEqual(AuthenticationMiddleware.AUTH_POLICY_API_KEY);
    expect(next).toHaveBeenCalled();
  });

  /**
   * Below test case checks for the successful invalid api key verification from ensureAuthenticated
   */
  it('ensureAuthenticated with invalid API key', async () => {
    const req = {} as any;
    req.headers = { authorization: API_KEY };
    AuthenticationMiddleware.verifyApiKey = jest.fn().mockReturnValue(false);
    const res: Response = {} as any;
    let errorCode;
    res.send = ((code: number, obj) => {
      errorCode = code;
      return obj;
    });
    const next = jest.fn() as any;
    await AuthenticationMiddleware.ensureAuthenticated(req, res, next);
    expect(req.username).toBeUndefined();
    expect(errorCode).toEqual(401);
    expect(next).toHaveBeenCalled();
  });

  /**
   * Below test case checks for the case of invalid api key from ensureAuthenticated method
   */
  it('failure case validation of API key', async () => {
    const req = {} as any;
    req.headers = { authorization: API_KEY };
    AuthenticationMiddleware.verifyApiKey = jest.fn().mockImplementation(() => {
      throw new Error('Unable to verify API key');
    },
    );
    const res: Response = {} as any;
    res.send = ((code: number, obj) => {
      return obj;
    });
    const next = jest.fn() as any;
    await AuthenticationMiddleware.ensureAuthenticated(req, res, next);
    expect(next).toHaveBeenCalledWith(false);
    jest.clearAllMocks();
  });

  /**
   * Below test case checks for the case of unauthorized User requesting for api key
   */
  it('User not Authorized To Request ApiKey', async () => {
    const req = {} as any;
    req.username = bluepagesResponse.content.user.profile.uid;
    req['isAuthenticated'] = true;
    expect(AuthenticationMiddleware.isAuthorizedToRequestApiKey(req)).toEqual(false);
  });

  /**
   * Below test case checks for the case of unauthorized User requesting for api key
   */
  it('Check for authorized request - apiKey', async () => {
    const req = {} as any;
    req.username = bluepagesResponse.content.user.profile.uid;
    req['isAuthenticated'] = true;
    req['auth_policy'] = AuthenticationMiddleware.AUTH_POLICY_API_KEY;
    const flag: boolean = AuthenticationMiddleware.getInstance().isAuthorizedRequest(req);
    expect(flag).toBeTruthy();
  });

  /**
   * Below test case checks for the case of unauthorized User requesting for bearer token
   */
  it('Check for authorized request - bearer', async () => {
    const req = {} as any;
    req.username = bluepagesResponse.content.user.profile.uid;
    req['isAuthenticated'] = true;
    req['auth_policy'] = AuthenticationMiddleware.AUTH_POLICY_BEARER;
    const flag: boolean = AuthenticationMiddleware.getInstance().isAuthorizedRequest(req);
    expect(flag).toBeTruthy();
  });

  /**
   * Below test case checks for the case of unauthorized User requesting for bearer token
   */
  it('Check for unauthorized request - no auth policy', async () => {
    const req = {} as any;
    req.username = bluepagesResponse.content.user.profile.uid;
    req['isAuthenticated'] = true;
    const flag: boolean = AuthenticationMiddleware.getInstance().isAuthorizedRequest(req);
    expect(flag).toEqual(false);
  });

  /**
   * Below test case checks for checkPreAuthentication
   */
  it('Check for checkPreAuthentication', async () => {
    const req = {
      headers: {
        authorization: 'Bearer { "email": "aferko@sk.ibm.com", "id": "A13356693" }',
      },
      body: {
        query: 'query hello($userId: String) {\n  userSubscriptions(userId: $userId) {\n    appId\n    userId\n    role\n    state\n    artifact {\n      elements {\n        artifactIdElement {\n          id\n        }\n        title\n      }\n    }\n    channelSettings {\n      email {\n        frequency\n      }\n    }\n  }\n}\n',
        variables: { userId: 'A13356693' },
        operationName: 'hello',
      },
      path: () => 'graphql',
    } as any;
    const res: Response = {
      send: jest.fn(),
    } as any;
    const next = jest.fn() as any;
    AuthenticationMiddleware.checkPreAuthentication(req, res, next);
    expect(next).toBeCalled();
    expect(next).not.toBeCalledWith(false);
  });

  /**
   * Below test case checks for checkPreAuthentication without a bearer
   */
  it('Check for checkPreAuthentication without a bearer', async () => {
    const req = {
      headers: {},
      body: {
        query: 'query hello($userId: String) {\n  userSubscriptions(userId: $userId) {\n    appId\n    userId\n    role\n    state\n    artifact {\n      elements {\n        artifactIdElement {\n          id\n        }\n        title\n      }\n    }\n    channelSettings {\n      email {\n        frequency\n      }\n    }\n  }\n}\n',
        variables: { userId: 'A13356693' },
        operationName: 'hello',
      },
      path: () => 'graphql',
    } as any;
    const res: Response = {
      send: jest.fn(),
    } as any;
    const next = jest.fn() as any;
    AuthenticationMiddleware.checkPreAuthentication(req, res, next);
    expect(next).toBeCalledWith(false);
    expect(res.send).toBeCalledWith(401, { code: 401, message: 'w3id/jwt token or API key based authentication strategy must be used for userSubscriptions Query.' });
  });

  /**
   * Below test case checks for checkPostAuthentication
   */
  it('Check for checkPostAuthentication', async () => {
    const req = {
      body: {
        query: 'query hello($appId: String) {\n  getApiKey(appId: appId) {\n    appId\n    }\n}\n',
        variables: { appId: 'test' },
        operationName: 'hello',
      },
      isAuthenticated: true,
      path: () => 'graphql',
    } as any;
    const res: Response = {
      send: jest.fn(),
    } as any;
    const next = jest.fn() as any;
    AuthenticationMiddleware.isAuthorizedToRequestApiKey = jest.fn().mockReturnValue(true);
    AuthenticationMiddleware.checkPostAuthentication(req, res, next);
    expect(next).toBeCalled();
    expect(next).not.toBeCalledWith(false);
  });

  /**
   * Below test case checks for checkPostAuthentication with unauthorized user
   */
  it('Check for checkPostAuthentication with unauthorized user', async () => {
    const req = {
      body: {
        query: 'query hello($appId: String) {\n  getApiKey(appId: appId) {\n    appId\n    }\n}\n',
        variables: { appId: 'test' },
        operationName: 'hello',
      },
      isAuthenticated: true,
      path: () => 'graphql',
    } as any;
    const res: Response = {
      send: jest.fn(),
    } as any;
    const next = jest.fn() as any;
    AuthenticationMiddleware.isAuthorizedToRequestApiKey = jest.fn().mockReturnValue(false);
    AuthenticationMiddleware.checkPostAuthentication(req, res, next);
    expect(next).toBeCalledWith(false);
    expect(res.send).toBeCalledWith(403, { code: 403, message: 'You are not authorized for getApiKey Query.' });
  });

  it('Check for checkPreAuthentication for REST endpoint - invalid credentials', async () => {
    const req = {
      headers: {},
      body: {
        variables: { userId: 'A13356693' },
        operationName: 'subscriptions',
      },
      path: () => '/subscriptions',
    } as any;
    const res: Response = {
      send: jest.fn(),
    } as any;
    const next = jest.fn() as any;
    AuthenticationMiddleware.checkPreAuthentication(req, res, next);
    expect(next).toBeCalledWith(false);
    expect(res.send).toBeCalledWith(401, { code: 401, message: 'w3id/jwt token or API key based authentication strategy must be used for subscriptions Query.' });
  });

  it('Check for checkPreAuthentication for REST endpoint - valid bearer credentials', async () => {
    const req = {
      headers: {
        authorization: 'Bearer { "email": "something@something.com", "id": "A13356693" }',
      },
      body: {
        variables: { userId: 'A13356693' },
        operationName: 'subscriptions',
      },
      path: () => '/subscriptions',
    } as any;
    const res: Response = {
      send: jest.fn(),
    } as any;
    const next = jest.fn() as any;
    AuthenticationMiddleware.checkPreAuthentication(req, res, next);
    expect(next).toBeCalled();
    expect(next).not.toBeCalledWith(false);
  });

  it('Check for checkPreAuthentication for REST endpoint - valid apikey credentials', async () => {
    const req = {
      headers: {
        authorization: 'apiKey dummy_api_key',
      },
      body: {
        variables: { userId: 'A13356693' },
        operationName: 'subscriptions',
      },
      path: () => '/subscriptions',
    } as any;
    const res: Response = {
      send: jest.fn(),
    } as any;
    const next = jest.fn() as any;
    AuthenticationMiddleware.checkPreAuthentication(req, res, next);
    expect(next).toBeCalled();
    expect(next).not.toBeCalledWith(false);
  });
});
