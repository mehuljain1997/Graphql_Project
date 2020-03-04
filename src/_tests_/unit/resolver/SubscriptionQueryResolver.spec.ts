import { SubscriptionId } from '@w3-notifications/shared-types';
import { AuthenticationMiddleware } from '../../../middleware/AuthenticationMiddleware';
import { IRequest } from '../../../middleware/IRequest';
import { ChannelFrequencies, Role, State } from '../../../models/enums';
import { Subscription } from '../../../models/Subscription';
import { cassandraDBHelpers } from '../../../repo/cassandraDBHelpers';
import { SubscriptionRepoCassandra } from '../../../repo/SubscriptionRepo';
import { SubscriptionResolver } from '../../../resolvers/SubscriptionQueryResolver';
import { bluepagesResponse } from '../bluepagesResponse';

const INVALID_PP_ID: string = `SOME STRING WHOSE LENGTH IS GREATER THAN 50.
SUBSCRIPTION SERVICE SHOULD RETURN INVALID APPLICATION ID ERROR MESSAGE`;
const USER_ID: string = 'AAABBB555';
const USER_ID1: string = 'AAABBB556';
const validSubscriptionInput: SubscriptionId = {
  appId: INVALID_PP_ID,
  artifactId: {
    elements: [
      {
        id: 'simhas-test-site',
      },
      {
        id: 'blog',
      },
    ],
  },
  userId: USER_ID,
  state: State.ACTIVE,
};

const artifactIds = [
  {
    elements:[{
      id:'blog',
    }],
  },
  {
    elements:[{
      id:'blog1',
    }],
  },

];

const artifactIdsForSubscription = {
  elements:[{
    id:'blog',
  }],
};

const artifactIdsForUserSubscription = {
  elements: [
    {
      id: 'blog',
    },
  ],
};


const now = new Date();
const APP_ID = 'w3notifications-test';
const ARTIFACT_DATE = '2019-07-03T16:17:22.790Z';
const sampleSubscription: Subscription = {
  appId: APP_ID,
  artifact: {
    elements: [{
      artifactIdElement: { id: 'blog' },
      title: 'title',
      artifactDate: ARTIFACT_DATE,
    }],
  },
  channelSettings: {
    email: { frequency: ChannelFrequencies.DAILY },
    webBell: { frequency: ChannelFrequencies.NA },
  },
  role: Role.AUTHOR,
  userId: USER_ID,
  state: State.ACTIVE,
  createdDate: now,
  updatedDate: now,
  subscriptionType: 'subscriptionType',
};

const sampleSubscriptionWithAnotherArtifactId: Subscription = {
  appId: APP_ID,
  artifact: {
    elements: [{
      artifactIdElement: { id: 'blog1' },
      title: 'title',
      artifactDate: ARTIFACT_DATE,
    }],
  },
  channelSettings: {
    email: { frequency: ChannelFrequencies.DAILY },
    webBell: { frequency: ChannelFrequencies.NA },
  },
  role: Role.AUTHOR,
  userId: USER_ID,
  state: State.ACTIVE,
  createdDate: now,
  updatedDate: now,
  subscriptionType: 'subscriptionType',
};

const sampleSubscription1: Subscription = {
  appId: APP_ID,
  artifact: {
    elements: [{
      artifactIdElement: { id: 'blog' },
      title: 'title',
      artifactDate: ARTIFACT_DATE,
    }],
  },
  channelSettings: {
    email: { frequency: ChannelFrequencies.DAILY },
    webBell: { frequency: ChannelFrequencies.NA },
  },
  role: Role.AUTHOR,
  userId: USER_ID1,
  state: State.ACTIVE,
  createdDate: now,
  updatedDate: now,
  subscriptionType: 'subscriptionType',
};

describe('Subscription Query resolver', () => {
  let subscriptionResolver: SubscriptionResolver;
  let subscriptionRepoCassandra: any;
  beforeAll(() => {
    subscriptionRepoCassandra = new SubscriptionRepoCassandra();
    subscriptionResolver = new SubscriptionResolver(subscriptionRepoCassandra);
  });

  /*
  * This test case check if we are able to invoke read subscription with api key
  */
  it('Able to read User subscription with API key', async () => {
    const userId: string = bluepagesResponse.content.user.profile.uid;
    const req = {} as any;
    req['isAuthenticated'] = true;
    req['auth_policy'] = AuthenticationMiddleware.AUTH_POLICY_API_KEY;
    jest.spyOn(cassandraDBHelpers, 'execute');
    try {
      await subscriptionResolver.userSubscriptions(req, userId);
      expect(cassandraDBHelpers.execute).toHaveBeenCalled();
    } catch (err) {
      expect(cassandraDBHelpers.execute).toHaveBeenCalled();
    }
  });

  /*
  * This test case check if we are able to READ subscription with api key
  */
  it('Read User subscription with API key & w/o user id throws bad request error', async () => {
    const userId: string = '';
    const req = {} as any;
    req['isAuthenticated'] = true;
    req['auth_policy'] = AuthenticationMiddleware.AUTH_POLICY_API_KEY;
    jest.fn(subscriptionRepoCassandra.userSubscriptions).mockReturnValue([]);
    try {
      await subscriptionResolver.userSubscriptions(req, userId);
      expect(false).toBeTruthy();
    } catch (err) {
      expect(true).toBeTruthy();
    }
  });

  it('Read subscription throws error with appId length greater than 50', async () => {
    const userId: string = '';
    const req = {} as any;
    req['isAuthenticated'] = true;
    req['auth_policy'] = AuthenticationMiddleware.AUTH_POLICY_API_KEY;
    try {
      await subscriptionResolver.subscriptions(INVALID_PP_ID, validSubscriptionInput.artifactId, [State.ACTIVE], req);
      expect(false).toBeTruthy();
    } catch (err) {
      expect(err.message).toBe('Invalid application Id');
    }
  });

  it('Read subscription throws error with appId length greater than 50', async () => {
    const userId: string = '';
    const req = {} as any;
    req['isAuthenticated'] = true;
    req['auth_policy'] = AuthenticationMiddleware.AUTH_POLICY_API_KEY;
    try {
      await subscriptionResolver.subscriptionsWithListOfArtifacts(INVALID_PP_ID,
        [validSubscriptionInput.artifactId], [State.ACTIVE], req);
      expect(false).toBeTruthy();
    } catch (err) {
      expect(err.message).toBe('Invalid application Id');
    }
  });
});

describe('Subscriptions Query Resolver', () => {

  let subscriptionResolver: SubscriptionResolver;
  let subscriptionRepoCassandra: SubscriptionRepoCassandra;
  beforeAll(() => {
    subscriptionRepoCassandra = new SubscriptionRepoCassandra();
    subscriptionResolver = new SubscriptionResolver(subscriptionRepoCassandra);
  });

  it('Should return empty list of subscriptions', async () => {
    jest.spyOn(SubscriptionRepoCassandra.prototype, 'getSubscriptionByIds').mockResolvedValue([]);
    const req = { // tslint:disable-next-line
      username: USER_ID,
    } as IRequest;
    req['isAuthenticated'] = true;
    req['auth_policy'] = AuthenticationMiddleware.AUTH_POLICY_BEARER;
    const subs = await subscriptionResolver.subscriptions(APP_ID, artifactIdsForSubscription, [State.ACTIVE], req);
    expect(subs.length).toBe(0);
  });

  it('Should return subscriptions', async () => {
    jest.spyOn(SubscriptionRepoCassandra.prototype, 'getSubscriptionByIds').mockResolvedValue([sampleSubscription]);
    const req = { // tslint:disable-next-line
      username: USER_ID,
    } as IRequest;
    req['isAuthenticated'] = true;
    req['auth_policy'] = AuthenticationMiddleware.AUTH_POLICY_BEARER;
    const subs = await subscriptionResolver.subscriptions(APP_ID, artifactIdsForSubscription, [State.ACTIVE], req);
    expect(subs.length).toBe(1);
    expect(subs[0].appId).toBe(APP_ID);
    expect(subs[0].state).toBe(State.ACTIVE);
    expect(subs[0].artifact.elements[0].artifactIdElement.id).toBe(artifactIdsForSubscription.elements[0].id);
  });

  it('Should return multiple authors for an artifact', async () => {
    // tslint:disable-next-line: max-line-length
    jest.spyOn(SubscriptionRepoCassandra.prototype, 'getSubscriptionByIds').mockResolvedValue([sampleSubscription, sampleSubscription1]);
    const req = { // tslint:disable-next-line
      username: USER_ID1,
    } as IRequest;
    req['isAuthenticated'] = true;
    req['auth_policy'] = AuthenticationMiddleware.AUTH_POLICY_API_KEY;
    const subs = await subscriptionResolver.subscriptions(APP_ID, artifactIdsForSubscription, [State.ACTIVE], req);
    expect(subs.length).toBe(2);
    // tslint:disable-next-line: ter-arrow-parens
    subs.forEach(s => {
      expect(s.role).toBe(Role.AUTHOR);
    });
    expect(subs[0].appId).toBe(APP_ID);
    expect(subs[1].appId).toBe(APP_ID);
    expect(subs[0].state).toBe(State.ACTIVE);
    expect(subs[0].artifact.elements[0].artifactIdElement.id).toBe(artifactIdsForSubscription.elements[0].id);
    expect(subs[1].artifact.elements[0].artifactIdElement.id).toBe(artifactIdsForSubscription.elements[0].id);
  });


});

describe('SubscriptionsWithListOfArtifactId Query Resolver', () => {

  let subscriptionResolver: SubscriptionResolver;
  let subscriptionRepoCassandra: SubscriptionRepoCassandra;
  beforeAll(() => {
    subscriptionRepoCassandra = new SubscriptionRepoCassandra();
    subscriptionResolver = new SubscriptionResolver(subscriptionRepoCassandra);
  });

  it('Should return empty list of subscriptions for no subscribers artifacts', async () => {
    jest.spyOn(SubscriptionRepoCassandra.prototype, 'getSubscriptionByIds').mockResolvedValue([]);
    const req = { // tslint:disable-next-line
      username: USER_ID,
    } as IRequest;
    req['isAuthenticated'] = true;
    req['auth_policy'] = AuthenticationMiddleware.AUTH_POLICY_BEARER;
    const subs = await subscriptionResolver.subscriptionsWithListOfArtifacts(APP_ID, artifactIds, [
      State.ACTIVE], req);
    expect(subs.length).toBe(0);
  });
// Test case to show multiple authors can present to an artifact
  it('Should return multiple authors for an artifact for API KEY authentication method', async () => {
    // tslint:disable-next-line: max-line-length
    jest.spyOn(SubscriptionRepoCassandra.prototype, 'getSubscriptionByIds').mockResolvedValue([sampleSubscription, sampleSubscription1]);
    const req = { // tslint:disable-next-line
      username: USER_ID1,
    } as IRequest;
    req['isAuthenticated'] = true;
    req['auth_policy'] = AuthenticationMiddleware.AUTH_POLICY_API_KEY;
    const subs = await subscriptionResolver.subscriptionsWithListOfArtifacts(APP_ID, artifactIds,
      [State.ACTIVE], req);
    expect(subs.length).toBe(2);
    // tslint:disable-next-line: ter-arrow-parens
    subs.forEach(s => {
      expect(s.role).toBe(Role.AUTHOR);
    });
    expect(subs[0].appId).toBe(APP_ID);
    expect(subs[1].appId).toBe(APP_ID);
    expect(subs[0].state).toBe(State.ACTIVE);
    expect(subs[0].artifact.elements[0].artifactIdElement.id).toBe(artifactIds[0].elements[0].id);
    expect(subs[1].artifact.elements[0].artifactIdElement.id).toBe(artifactIds[0].elements[0].id);
  });


  it('Should return list of subscriptions', async () => {
    jest.spyOn(SubscriptionRepoCassandra.prototype, 'getSubscriptionByIds').mockResolvedValue([sampleSubscription,
      sampleSubscriptionWithAnotherArtifactId]);
    const req = { // tslint:disable-next-line
      username: USER_ID,
    } as IRequest;
    req['isAuthenticated'] = true;
    req['auth_policy'] = AuthenticationMiddleware.AUTH_POLICY_BEARER;
    const subs: Subscription[] = await subscriptionResolver.subscriptionsWithListOfArtifacts(APP_ID, artifactIds,
      [State.ACTIVE], req);
    expect(subs.length).toBe(2);
    expect(subs[0].appId).toBe(APP_ID);
    expect(subs[0].state).toBe(State.ACTIVE);
    expect(subs[0].artifact.elements[0].artifactIdElement.id).toBe(artifactIds[0].elements[0].id);
    expect(subs[1].appId).toBe(APP_ID);
    expect(subs[1].state).toBe(State.ACTIVE);
    expect(subs[1].artifact.elements[0].artifactIdElement.id).toBe(artifactIds[1].elements[0].id);
  });
});

describe('UserSubscriptions Query Resolver', () => {
  let subscriptionResolver: SubscriptionResolver;
  let subscriptionRepoCassandra: SubscriptionRepoCassandra;
  beforeAll(() => {
    subscriptionRepoCassandra = new SubscriptionRepoCassandra();
    subscriptionResolver = new SubscriptionResolver(subscriptionRepoCassandra);
  });

  it('Should able to read empty User subscription based on bearer token', async () => {
    jest.spyOn(SubscriptionRepoCassandra.prototype, 'userSubscriptions').mockResolvedValue([sampleSubscription]);
    const req = { // tslint:disable-next-line
      username: USER_ID,
    } as IRequest;
    req['isAuthenticated'] = true;
    req['auth_policy'] = AuthenticationMiddleware.AUTH_POLICY_BEARER;
    const subs = await subscriptionResolver.userSubscriptions(req);
    expect(subs.length).toBe(1);
    expect(subs[0]).toBe(sampleSubscription);
  });

  it('Should able to read User subscription based on artifactIds', async () => {
    jest.spyOn(SubscriptionRepoCassandra.prototype, 'userSubscriptions').mockResolvedValue([sampleSubscription]);
    const req = { // tslint:disable-next-line
      username: USER_ID,
    } as IRequest;
    req['isAuthenticated'] = true;
    req['auth_policy'] = AuthenticationMiddleware.AUTH_POLICY_BEARER;
    const subs = await subscriptionResolver.userSubscriptions(req, '', '', APP_ID, artifactIdsForUserSubscription);
    expect(subs.length).toBe(1);
    expect(subs[0].artifact.elements[0].artifactIdElement).toEqual(artifactIdsForUserSubscription.elements[0]);

  });

  it('Should able to read User subscription based on bearer token', async () => {
    SubscriptionRepoCassandra.prototype.userSubscriptions = jest.fn().mockResolvedValue([]);
    const req = { // tslint:disable-next-line
      username: USER_ID,
    } as IRequest;
    req['isAuthenticated'] = true;
    req['auth_policy'] = AuthenticationMiddleware.AUTH_POLICY_BEARER;
    const subs = await subscriptionResolver.userSubscriptions(req);
    expect(subs.length).toBe(0);
  });


  it('Should not able to read other User subscription', async () => {
    const req = { // tslint:disable-next-line
      username: USER_ID,
    } as IRequest;
    req['isAuthenticated'] = true;
    req['auth_policy'] = AuthenticationMiddleware.AUTH_POLICY_BEARER;
    try {
      await subscriptionResolver.userSubscriptions(req, 'AAAAABBBBCC');
      expect(true).toBe(false);
    } catch (err) {
      expect(err.code).toBe(403);
      expect(err.message).toBe('Forbidden: You are not allowed to submit a subscription request for others');
    }
  });
});