import { SubscriptionId } from '@w3-notifications/shared-types';
import 'reflect-metadata';
import { bluepagesResponse } from '../../../__tests__/unit/bluepagesResponse';
import { AuthenticationMiddleware } from '../../../middleware/AuthenticationMiddleware';
import { IRequest } from '../../../middleware/IRequest';
import { ChannelFrequencies, Role, State } from '../../../models/enums';
import { Subscription } from '../../../models/Subscription';
import { SubscriptionInput } from '../../../models/SubscriptionInput';
import { SubscriptionUsersInput } from '../../../models/SubscriptionUsersInput';
import { SubscriptionUsersWithSettingsInput } from '../../../models/SubscriptionUsersWithSettingsInput';
import { SubscriptionUserWithSettings } from '../../../models/SubscriptionUserWithSettings';
import { cassandraDBHelpers } from '../../../repo/cassandraDBHelpers';
import { SubscriptionRepo, SubscriptionRepoCassandra } from '../../../repo/SubscriptionRepo';
import { SubscriptionMutationResolver } from '../../../resolvers/SubscriptionMutationResolver';


const APP_ID: string = 'w3notifications-test';
const USER_ID: string = 'A24876693';
const USER_ID_FOR_SUBSCRIBER: string = 'C-576421';
const ARTIFACT_DATE = '2019-07-03T16:17:22.790Z';
const INVALID_ARTIFACT_DATE = '07-03-2019T16:17:22.790Z';
const validSubscriptionInput: SubscriptionInput = {
  appId: APP_ID,
  channelSettings: {
    email: {
      frequency: ChannelFrequencies.WEEKLY,
    },
  },
  artifact: {
    elements: [
      {
        artifactIdElement: { id: 'lucys-test-site' },
        title: 'lucys-test-site',
        artifactDate: ARTIFACT_DATE,
      },
      {
        artifactIdElement: { id: 'blog' },
        title: 'Blog',
        artifactDate: ARTIFACT_DATE,
      },
    ],
  },
  role: Role.AUTHOR,
  userId: USER_ID,
  subscriptionType: 'subscriptionType',
};


const invalidSubscriptionInput: SubscriptionInput = {
  appId: APP_ID,
  channelSettings: {
    email: {
      frequency: ChannelFrequencies.WEEKLY,
    },
  },
  artifact: {
    elements: [
      {
        artifactIdElement: { id: 'lucys-test-site' },
        title: 'lucys-test-site',
        artifactDate: INVALID_ARTIFACT_DATE,
      },
      {
        artifactIdElement: { id: 'blog' },
        title: 'Blog',
        artifactDate: INVALID_ARTIFACT_DATE,
      },
    ],
  },
  role: Role.AUTHOR,
  userId: USER_ID,
  subscriptionType: 'blog',
};

const validSubscriptionInputRoleSubscriber: SubscriptionInput = {
  appId: 'w3notifications-test',
  channelSettings: {
    email: {
      frequency: ChannelFrequencies.WEEKLY,
    },
  },
  artifact: {
    elements: [
      {
        artifactIdElement: { id: 'lucys-test-site' },
        title: 'lucys-test-site',
        artifactDate: ARTIFACT_DATE,
      },
      {
        artifactIdElement: { id: 'blog' },
        title: 'Blog',
        artifactDate: ARTIFACT_DATE,
      },
    ],
  },
  role: Role.SUBSCRIBER,
  userId: USER_ID,
  subscriptionType: 'blog',
};

const subscriptionUsersInput: SubscriptionUsersInput = {
  appId: validSubscriptionInput.appId,
  channelSettings: validSubscriptionInput.channelSettings,
  artifact: validSubscriptionInput.artifact,
  role: validSubscriptionInput.role,
  subscriptionType: validSubscriptionInput.subscriptionType,
  userIds: ['USER1', 'USER2', 'USER3'],
};

const subscriptionUsersWithSettingsInput: SubscriptionUsersWithSettingsInput = {
  appId: validSubscriptionInput.appId,
  artifact: validSubscriptionInput.artifact,
  usersWithSettings: [
    {
      userId: 'USER1',
      channelSettings: {
        email: {
          frequency: ChannelFrequencies.INSTANTLY,
        },
      },
      role: Role.AUTHOR,
      subscriptionType: 'subscriptionType',
    },
    {
      userId: 'USER2',
      channelSettings: {
        email: {
          frequency: ChannelFrequencies.DAILY,
        },
      },
      role: Role.SUBSCRIBER,
      subscriptionType: 'subscriptionType',
    },
    {
      userId: 'USER3',
      channelSettings: {
        email: {
          frequency: ChannelFrequencies.WEEKLY,
        },
      },
      role: Role.AUTHOR,
      subscriptionType: 'subscriptionType',
    },
  ],
};

const queriedSubscriptionRecordFromDB: any = {
  app_id: APP_ID,
  artifact_id: [{ id: 'blog' }],
  user_id: USER_ID,
  state: State.ACTIVE,
  artifact: [{ artifactIdElement: { id: 'blog' }, title: 'title' }],
  channelSettings: { email: { frequency: ChannelFrequencies.DAILY }, webBell: { frequency: ChannelFrequencies.NA } },
  role: Role.AUTHOR,
  createdDate: new Date(),
  updatedDate: new Date(),
};

const queriedSubscriptionForSubscriberRecordFromDB: any = {
  app_id: APP_ID,
  artifact_id: [{ id: 'blog' }],
  user_id: USER_ID,
  state: State.ACTIVE,
  artifact: [{ artifactIdElement: { id: 'blog' }, title: 'title' }],
  channelSettings: { email: { frequency: ChannelFrequencies.DAILY }, webBell: { frequency: ChannelFrequencies.NA } },
  role: Role.SUBSCRIBER,
  createdDate: new Date(),
  updatedDate: new Date(),
};

const queriedSubscriptionForArtifact: any = {
  app_id: APP_ID,
  artifact_id: [{ id: 'lucys-test-site' }, { id: 'blog' }],
  user_id: USER_ID,
  state: State.ACTIVE,
  artifact: [{ artifactIdElement: { id: 'cio' }, title: 'title' }],
  channelSettings: { email: { frequency: ChannelFrequencies.DAILY }, webBell: { frequency: ChannelFrequencies.NA } },
  role: Role.AUTHOR,
  createdDate: new Date(),
  updatedDate: new Date(),
};


const queriedSubscriptionForCascadedelete: any = {
  app_id: APP_ID,
  artifact_id: [{ id: 'lucys-test-site' }],
  user_id: USER_ID,
  state: State.ACTIVE,
  artifact: [{ artifactIdElement: { id: 'blog' }, title: 'title' }],
  channelSettings: { email: { frequency: ChannelFrequencies.DAILY }, webBell: { frequency: ChannelFrequencies.NA } },
  role: Role.AUTHOR,
  createdDate: new Date(),
  updatedDate: new Date(),
};


const queriedExistedSubscriptionRecordFromDB: any = {
  app_id: APP_ID,
  artifact_id: [{ id: 'lucys-test-site' }, { id: 'blog' }],
  user_id: USER_ID,
  state: State.ACTIVE,
  artifact: [{ artifactIdElement: { id: 'lucys-test-site' }, title: 'lucys-test-site', artifactdate: ARTIFACT_DATE },
  { artifactIdElement: { id: 'blog' }, title: 'Blog', artifactdate: ARTIFACT_DATE }],
  channelSettings: { email: { frequency: ChannelFrequencies.DAILY }, webBell: { frequency: ChannelFrequencies.NA } },
  role: Role.AUTHOR,
  createdDate: new Date(),
  updatedDate: new Date(),
};

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
  createdDate: new Date(),
  updatedDate: new Date(),
  subscriptionType: 'subscriptionType',
};

const subscriptionIdJson: SubscriptionId = {
  appId: APP_ID,
  artifactId: {
    elements: [
      {
        id: 'lucys-test-site',
      },
      {
        id: 'blog',
      },
    ],
  },
  userId: USER_ID,
  state: State.ACTIVE,
};

const artifactIds = {
  elements: [
    {
      id: 'cio',
    },
    {
      id: 'blog',
    }],
};

const artifactId = {
  elements: [
    {
      id: 'lucys-test-site',
    },
  ],
};

const userSubscription: any = {
  user_id: USER_ID,
  state: 1,
  app_id: APP_ID,
  artifact_id: [
    {
      id: 'lucys-test-site',
    },
    {
      id: 'blog',
    },
  ],
};

/**
 * The below test cases are for subscribe user mutation
 */
describe('subscribe user', () => {
  let mutationResolver: SubscriptionMutationResolver;
  let repo: any;
  beforeAll(() => {
    repo = new SubscriptionRepoCassandra();
    mutationResolver = new SubscriptionMutationResolver(repo);
  });

  it('Subscribe user with valid subscription input - AUTHOR', async () => {
    const user = bluepagesResponse.content.user.profile;
    const req = { // tslint:disable-next-line
      authorization: { user } as any,
    } as IRequest;

    repo.subscribe = jest.fn().mockImplementationOnce(async () => {
      return validSubscriptionInput;
    });
    const mockResultSetWithUserSubscriptions: any = {
      rows: [],
    };
    repo.getSubscriptionByIds = jest.fn().mockReturnValue(new Promise((resolve): any => {
      resolve([]);
    }));
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve): any => {
      resolve(mockResultSetWithUserSubscriptions);
    }));
    cassandraDBHelpers.batch = jest.fn().mockReturnValue(new Promise((resolve): any => {
      resolve('success');
    }));

    AuthenticationMiddleware.prototype.isAuthorizedUser = jest.fn().mockImplementationOnce(() => {
      return true;
    });
    const response: Subscription = await mutationResolver.subscribe(req, validSubscriptionInput);
    expect(response.appId).toBe(APP_ID);
    expect(response.userId).toBe(USER_ID);
    expect(response.role).toBe(Role.AUTHOR);
    expect(response.subscriptionType).toBe(validSubscriptionInput.subscriptionType);
    expect(response.artifact.elements[0].artifactIdElement.id).toBe(validSubscriptionInput.artifact.elements[0].artifactIdElement.id);
    expect(response.artifact.elements[1].artifactIdElement.id).toBe(validSubscriptionInput.artifact.elements[1].artifactIdElement.id);
    expect(response.artifact.elements[0].title).toBe(validSubscriptionInput.artifact.elements[0].title);
    expect(response.artifact.elements[1].title).toBe(validSubscriptionInput.artifact.elements[1].title);
    expect(response.artifact.elements[0].artifactDate).toBe(ARTIFACT_DATE);
    expect(response.artifact.elements[1].artifactDate).toBe(ARTIFACT_DATE);
  });

  it('Subscribe user with valid subscription input - SUBSCRIBER', async () => {
    const user = bluepagesResponse.content.user.profile;
    const req = { // tslint:disable-next-line
      authorization: { user } as any,
    } as IRequest;

    repo.subscribe = jest.fn().mockImplementationOnce(async () => {
      return validSubscriptionInputRoleSubscriber;
    });
    const mockResultSetWithUserSubscriptions: any = {
      rows: [],
    };
    repo.getSubscriptionByIds = jest.fn().mockReturnValue(new Promise((resolve): any => {
      resolve([]);
    }));
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve): any => {
      resolve(mockResultSetWithUserSubscriptions);
    }));
    cassandraDBHelpers.batch = jest.fn().mockReturnValue(new Promise((resolve): any => {
      resolve('success');
    }));

    AuthenticationMiddleware.prototype.isAuthorizedUser = jest.fn().mockImplementationOnce(() => {
      return true;
    });
    const response: Subscription = await mutationResolver.subscribe(req, validSubscriptionInputRoleSubscriber);
    expect(response.appId).toBe(APP_ID);
    expect(response.userId).toBe(USER_ID);
    expect(response.subscriptionType).toBe(validSubscriptionInput.subscriptionType);
    expect(response.role).toBe(Role.SUBSCRIBER);
    expect(response.artifact.elements[0].artifactIdElement.id).toBe(validSubscriptionInput.artifact.elements[0].artifactIdElement.id);
    expect(response.artifact.elements[1].artifactIdElement.id).toBe(validSubscriptionInput.artifact.elements[1].artifactIdElement.id);
    expect(response.artifact.elements[0].title).toBe(validSubscriptionInput.artifact.elements[0].title);
    expect(response.artifact.elements[1].title).toBe(validSubscriptionInput.artifact.elements[1].title);
    expect(response.artifact.elements[0].artifactDate).toBe(ARTIFACT_DATE);
    expect(response.artifact.elements[1].artifactDate).toBe(ARTIFACT_DATE);
  });

  it('Subscribe user with valid subscription input - User unauthorized', async () => {
    const user = bluepagesResponse.content.user.profile;
    const req = { // tslint:disable-next-line
      authorization: { user } as any,
    } as IRequest;

    AuthenticationMiddleware.prototype.isAuthorizedUser = jest.fn().mockImplementationOnce(() => {
      return false;
    });

    try {
      await mutationResolver.subscribe(req, validSubscriptionInput);
      expect(true).toBe(false);
    } catch (err) {
      expect(err.message).toBe('Forbidden: You are not allowed to submit a subscription request for others');
    }
  });

  it('Subscribe user with valid subscription input - User already subscribed', async () => {
    const user = bluepagesResponse.content.user.profile;
    const req = { // tslint:disable-next-line
      authorization: { user } as any,
    } as IRequest;

    repo.subscribe = jest.fn().mockImplementationOnce(async () => {
      return validSubscriptionInput;
    });

    AuthenticationMiddleware.prototype.isAuthorizedUser = jest.fn().mockImplementationOnce(() => {
      return true;
    });

    const mockResultSetWithSubscriptions: any = {
      rows: [queriedExistedSubscriptionRecordFromDB],
    };

    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve): any => {
      resolve(mockResultSetWithSubscriptions);
    }));
    const response: Subscription = await mutationResolver.subscribe(req, validSubscriptionInput);
    expect(response.appId).toBe(APP_ID);
    expect(response.userId).toBe(USER_ID);
    // expect(response.subscriptionType).toBe(validSubscriptionInput.subscriptionType);
    expect(response.role).toBe(Role.AUTHOR);
    expect(response.artifact.elements[0].artifactIdElement.id).toBe(validSubscriptionInput.artifact.elements[0].artifactIdElement.id);
    expect(response.artifact.elements[1].artifactIdElement.id).toBe(validSubscriptionInput.artifact.elements[1].artifactIdElement.id);
    expect(response.artifact.elements[0].title).toBe(validSubscriptionInput.artifact.elements[0].title);
    expect(response.artifact.elements[1].title).toBe(validSubscriptionInput.artifact.elements[1].title);
    expect(response.artifact.elements[0].artifactDate).toBe(ARTIFACT_DATE);
    expect(response.artifact.elements[1].artifactDate).toBe(ARTIFACT_DATE);
  });

  it('Subscribe user with valid subscription input - Invalid artifact Date', async () => {
    const user = bluepagesResponse.content.user.profile;
    const req = { // tslint:disable-next-line
      authorization: { user } as any,
    } as IRequest;

    AuthenticationMiddleware.prototype.isAuthorizedUser = jest.fn().mockImplementationOnce(() => {
      return true;
    });
    try {
      await mutationResolver.subscribe(req, invalidSubscriptionInput);
      expect(true).toBe(false);
    } catch (err) {
      expect(err.message).toBe(`Invalid ISO artifactDate format : ${INVALID_ARTIFACT_DATE}`);
    }

  });
});

/**
 * The below test cases are for subscribeUsers mutation
 */
describe('subscribe users', () => {
  let mutationResolver: SubscriptionMutationResolver;
  let repo: any;
  beforeAll(() => {
    repo = new SubscriptionRepoCassandra();
    mutationResolver = new SubscriptionMutationResolver(repo);
  });

  it('Subscribe users', async () => {
    const req = {} as any;
    jest.spyOn(cassandraDBHelpers, 'batch');
    // mock resultSet for execute in getSubscriptionsByUserIds
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve): any => {
      resolve({ rows: [] });
    }));
    cassandraDBHelpers.batch = jest.fn().mockReturnValue(new Promise((resolve): any => {
      resolve('success');
    }));
    const response: Subscription[] = await mutationResolver.subscribeUsers(req, subscriptionUsersInput);
    expect(cassandraDBHelpers.batch).toHaveBeenCalled();
    expect(response.length).toBe(subscriptionUsersInput.userIds.length);
    for (let index = 0; index < response.length; index = index + 1) {
      const sub: Subscription = response[index];
      expect(sub.appId).toBe(APP_ID);
      expect(sub.userId).toBe(subscriptionUsersInput.userIds[index]);
      expect(sub.role).toBe(subscriptionUsersInput.role);
      expect(sub.channelSettings).toEqual(subscriptionUsersInput.channelSettings);
      expect(sub.artifact.elements.length).toEqual(2);
      [0, 1].map((idx: number) => {
        expect(sub.artifact.elements[idx].artifactIdElement.id).toBe(subscriptionUsersInput.artifact.elements[idx].artifactIdElement.id);
        expect(sub.artifact.elements[idx].title).toBe(subscriptionUsersInput.artifact.elements[idx].title);
        expect(sub.artifact.elements[idx].artifactDate).toBe(ARTIFACT_DATE);
      });
    }
  });
});

/**
 * The below test cases are for subscribeUsersWithSettings mutation
 */
describe('subscribe users with data', () => {
  let mutationResolver: SubscriptionMutationResolver;
  let repo: any;
  beforeAll(() => {
    repo = new SubscriptionRepoCassandra();
    mutationResolver = new SubscriptionMutationResolver(repo);
  });

  it('Subscribe users with data', async () => {
    const req = {} as any;
    jest.spyOn(cassandraDBHelpers, 'batch');
    // mock resultSet for execute in getSubscriptionsByUserIds
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve): any => {
      resolve({ rows: [] });
    }));
    cassandraDBHelpers.batch = jest.fn().mockReturnValue(new Promise((resolve): any => {
      resolve('success');
    }));
    const response: Subscription[] = await mutationResolver.subscribeUsersWithSettings(req,
      subscriptionUsersWithSettingsInput);
    expect(cassandraDBHelpers.batch).toHaveBeenCalled();
    expect(response.length).toBe(subscriptionUsersWithSettingsInput.usersWithSettings.length);
    for (let index = 0; index < response.length; index = index + 1) {
      const sub: Subscription = response[index];
      expect(sub.appId).toBe(APP_ID);
      const subscriptionUserWithSettings: SubscriptionUserWithSettings =
        subscriptionUsersWithSettingsInput.usersWithSettings[index];
      expect(sub.userId).toBe(subscriptionUserWithSettings.userId);
      expect(sub.role).toBe(subscriptionUserWithSettings.role);
      expect(sub.channelSettings).toEqual(subscriptionUserWithSettings.channelSettings);
      expect(sub.artifact.elements.length).toEqual(2);
      [0, 1].map((idx: number) => {
        expect(sub.artifact.elements[idx].artifactIdElement.id).toBe(subscriptionUsersWithSettingsInput.artifact.elements[idx].artifactIdElement.id);
        expect(sub.artifact.elements[idx].title).toBe(subscriptionUsersWithSettingsInput.artifact.elements[idx].title);
        expect(sub.artifact.elements[idx].artifactDate).toBe(ARTIFACT_DATE);
      });
    }
  });
});

/**
 * The below test cases are for update subscription mutation
 */

describe('update user subscription', () => {
  let mutationResolver: SubscriptionMutationResolver;
  let repo: any;
  beforeAll(() => {
    repo = new SubscriptionRepoCassandra();
    mutationResolver = new SubscriptionMutationResolver(repo);
  });

  it('Update user subscription', async () => {
    const user = bluepagesResponse.content.user.profile;
    const req = { // tslint:disable-next-line
      authorization: { user } as any,
    } as IRequest;
    repo.subscribe = jest.fn().mockImplementationOnce(async () => {
      return validSubscriptionInput;
    });

    AuthenticationMiddleware.prototype.isAuthorizedUser = jest.fn().mockImplementationOnce(() => {
      return true;
    });
    const results = {
      first: jest.fn().mockReturnValue(queriedSubscriptionRecordFromDB),
    } as any;
    // tslint:disable
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(results);
    }));
    cassandraDBHelpers.batch = jest.fn().mockReturnValue(new Promise((resolve): any => {
      resolve('success');
    }));

    const subscriptions: Subscription[] = await mutationResolver.updateSubscription(req, [validSubscriptionInput]);
    expect(subscriptions.length).toBe(1);
    expect(subscriptions[0].appId).toBe(APP_ID);
    expect(subscriptions[0].userId).toBe(USER_ID);
   // expect(subscriptions[0].subscriptionType).toBe(validSubscriptionInput.subscriptionType);
    expect(subscriptions[0].artifact.elements[0].artifactIdElement.id).toBe(validSubscriptionInput.artifact.elements[0].artifactIdElement.id);
    expect(subscriptions[0].artifact.elements[1].artifactIdElement.id).toBe(validSubscriptionInput.artifact.elements[1].artifactIdElement.id);
    expect(subscriptions[0].artifact.elements[0].title).toBe(validSubscriptionInput.artifact.elements[0].title);
    expect(subscriptions[0].artifact.elements[1].title).toBe(validSubscriptionInput.artifact.elements[1].title);
    expect(subscriptions[0].artifact.elements[0].artifactDate).toBe(ARTIFACT_DATE);
    expect(subscriptions[0].artifact.elements[1].artifactDate).toBe(ARTIFACT_DATE);
  });

  it('Update user subscription - User unauthorized', async () => {
    const user = bluepagesResponse.content.user.profile;
    const req = { // tslint:disable-next-line
      authorization: { user } as any,
    } as IRequest;

    AuthenticationMiddleware.prototype.isAuthorizedUser = jest.fn().mockImplementationOnce(() => {
      return false;
    });

    try {
      await mutationResolver.updateSubscription(req, [validSubscriptionInput]);
      expect(true).toBe(false);
    } catch (err) {
      expect(err.message).toBe('Forbidden: You are not allowed to submit a subscription request for others');
    }
  });

  it('Update user subscription - Artifact not found', async () => {
    const user = bluepagesResponse.content.user.profile;
    const req = { // tslint:disable-next-line
      authorization: { user } as any,
    } as IRequest;

    AuthenticationMiddleware.prototype.isAuthorizedUser = jest.fn().mockImplementationOnce(() => {
      return true;
    });
    const results = {
      first: jest.fn().mockReturnValue(null),
    } as any;
    // tslint:disable
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(results);
    }));

    try {
      await mutationResolver.updateSubscription(req, [validSubscriptionInput]);
      expect(true).toBe(false);
    } catch (err) {
      expect(err.message).toContain('not found');
    }
  });
});

/**
 * The below test cases are for delete subscription mutation
 */

describe('delete user subscription', () => {
  let mutationResolver: SubscriptionMutationResolver;
  let repo: SubscriptionRepo;
  beforeAll(() => {
    repo = new SubscriptionRepoCassandra();
    mutationResolver = new SubscriptionMutationResolver(repo);
  });

  it('Delete user subscription', async () => {
    const user = bluepagesResponse.content.user.profile;
    const req = { // tslint:disable-next-line
      authorization: { user } as any,
      username: USER_ID,
    } as IRequest;
    AuthenticationMiddleware.prototype.isAuthorizedUser = jest.fn().mockImplementation(() => {
      return true;
    });
    const mockResultSetWithSubscriptions: any = {
      rows: [queriedSubscriptionRecordFromDB],
    };

    const mockResultSetWithSubscriptions1: any = {

    }
    cassandraDBHelpers.batch = jest.fn().mockReturnValue(new Promise((resolve): any => {
      resolve('Successfully deleted');
    }));
    // tslint:disable
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(mockResultSetWithSubscriptions);
    }));
    const status: string = await mutationResolver.delete(req, APP_ID, artifactIds, USER_ID);
    expect(status).toBe('Successfully deleted');
  });

  it('Delete user subscription - Role Subscriber', async () => {
    const user = bluepagesResponse.content.user.profile;
    const req = { // tslint:disable-next-line
      authorization: { user } as any,
      username: USER_ID,
    } as IRequest;
    AuthenticationMiddleware.prototype.isAuthorizedUser = jest.fn().mockImplementation(() => {
      return true;
    });
    const mockResultSetWithSubscriptions: any = {
      rows: [queriedSubscriptionForSubscriberRecordFromDB],
    };
    cassandraDBHelpers.batch = jest.fn().mockReturnValue(new Promise((resolve): any => {
      resolve('Successfully deleted');
    }));
    // tslint:disable
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(mockResultSetWithSubscriptions);
    }));
    const status: string = await mutationResolver.delete(req, APP_ID, artifactIds, USER_ID);
    var err = new Error(status);
    expect((err.message)).toBe('Error: Forbidden: You are not allowed to perform this action');
  });

  it('Delete user subscription - User unauthorized', async () => {
    const user = bluepagesResponse.content.user.profile;
    const req = { // tslint:disable-next-line
      authorization: { user } as any,
      username: USER_ID,
    } as IRequest;
    AuthenticationMiddleware.prototype.isAuthorizedUser = jest.fn().mockImplementation(() => {
      return false;
    });

    try {
      await mutationResolver.delete(req, APP_ID, artifactIds, USER_ID);
      expect(true).toBe(false);
    } catch (err) {
      expect(err.message).toBe('Forbidden: You are not allowed to submit a subscription request for others');
    }
  });

  it('Delete user subscription - Artifact not found', async () => {
    const user = bluepagesResponse.content.user.profile;
    const req = { // tslint:disable-next-line
      authorization: { user } as any,
      username: USER_ID,
    } as IRequest;
    AuthenticationMiddleware.prototype.isAuthorizedUser = jest.fn().mockImplementation(() => {
      return true;
    });
    const mockResultSetWithSubscriptions: any = {
      rows: [],
    };
    cassandraDBHelpers.batch = jest.fn().mockReturnValue(new Promise((resolve): any => {
      resolve('done');
    }));
    // tslint:disable
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(mockResultSetWithSubscriptions);
    }));

    try {
      await mutationResolver.delete(req, APP_ID, artifactIds, USER_ID);
      expect(true).toBe(false);
    } catch (err) {
      expect(err.message).toContain('Subscription record Not Found for artifact');
    }
  });
});

/*
 * The below test cases are for deletecascade mutation
 */

describe('CascadeDelete user subscription', () => {
  let mutationResolver: SubscriptionMutationResolver;
  let repo: SubscriptionRepo;
  beforeAll(() => {
    repo = new SubscriptionRepoCassandra();
    mutationResolver = new SubscriptionMutationResolver(repo);
  });

  it('CascadeDelete user subscription', async () => {
    const user = bluepagesResponse.content.user.profile;
    const req = { // tslint:disable-next-line
      authorization: { user } as any,
      username: USER_ID,
    } as IRequest;
    AuthenticationMiddleware.prototype.isAuthorizedUser = jest.fn().mockImplementation(() => {
      return true;
    });
    const mockResultSetWithSubscriptions: any = {
      rows: [queriedSubscriptionForCascadedelete],
    };
    cassandraDBHelpers.batch = jest.fn().mockReturnValue(new Promise((resolve): any => {
      resolve('Successfully deleted');
    }));
    // tslint:disable
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(mockResultSetWithSubscriptions);
    }));
    const status: string = await mutationResolver.deleteCascade(req, APP_ID, artifactId, USER_ID);
    expect(status).toBe('Successfully deleted');
  });

  it('CascadeDelete user subscription - for Subscriber', async () => {
    const user = bluepagesResponse.content.user.profile;
    const req = { // tslint:disable-next-line
      authorization: { user } as any,
      username: USER_ID,
    } as IRequest;
    AuthenticationMiddleware.prototype.isAuthorizedUser = jest.fn().mockImplementation(() => {
      return true;
    });
    const mockResultSetWithSubscriptions: any = {
      rows: [queriedSubscriptionForCascadedelete],
    };
    cassandraDBHelpers.batch = jest.fn().mockReturnValue(new Promise((resolve): any => {
      resolve('Successfully deleted');
    }));
    // tslint:disable
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(mockResultSetWithSubscriptions);
    }));
    const status: string = await mutationResolver.deleteCascade(req, APP_ID, artifactId, USER_ID_FOR_SUBSCRIBER);
    let err = new Error(status);
    expect((err.message)).toBe('Error: Forbidden: You are not allowed to perform this action');
  });

});


/**
 * The below test cases are for unsubsribe mutation
 */

describe('unsubscribe user', () => {
  let mutationResolver: SubscriptionMutationResolver;
  const repo: SubscriptionRepo = new SubscriptionRepoCassandra();
  beforeAll(() => {
    mutationResolver = new SubscriptionMutationResolver(repo);
  });
  it('UnSubscribe user with valid subscription input - Check error condition', async () => {
    const user = bluepagesResponse.content.user.profile;
    const req = { // tslint:disable-next-line
      authorization: { user } as any,
    } as IRequest;
    AuthenticationMiddleware.prototype.isAuthorizedUser = jest.fn().mockImplementationOnce(() => {
      return true;
    });
    const results = {
      first: jest.fn().mockReturnValue(null),
    } as any;
    // tslint:disable
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(results);
    }));
    try {
      await mutationResolver.unsubscribe(req, subscriptionIdJson);
      expect(true).toBe(false);
    } catch (err) {
      expect(err.message).toContain(`Unable to unsubscribe`);
    }
  });

  it('UnSubscribe user with valid subscription input - Check success condition', async () => {
    const user = bluepagesResponse.content.user.profile;
    const req = { // tslint:disable-next-line
      authorization: { user } as any,
    } as IRequest;
    AuthenticationMiddleware.prototype.isAuthorizedUser = jest.fn().mockImplementationOnce(() => {
      return true;
    });
    const results1 = {
      first: jest.fn().mockReturnValue({ "[json]": JSON.stringify(queriedSubscriptionRecordFromDB) }),
    } as any;
    const results2 = {
      first: jest.fn().mockReturnValue({ "[json]": JSON.stringify(userSubscription) }),
    } as any;
    // tslint:disable
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(subscriptionIdJson);
    }));
    Promise.all = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve([results1, results2]);
    }));
    const subscriptionId: SubscriptionId = await mutationResolver.unsubscribe(req, subscriptionIdJson);
    expect(subscriptionId).toBeDefined()
    expect(subscriptionId.state).toBe(2);
  });

  it('UnSubscribe user with valid subscription input - Check user unauthenticated condition', async () => {
    const user = bluepagesResponse.content.user.profile;
    const req = { // tslint:disable-next-line
      authorization: { user } as any,
    } as IRequest;
    AuthenticationMiddleware.prototype.isAuthorizedUser = jest.fn().mockImplementationOnce(() => {
      return false;
    });
    try {
      await mutationResolver.unsubscribe(req, subscriptionIdJson);
      expect(true).toBe(false);
    } catch (err) {
      expect(err.message).toBe('Forbidden: You are not allowed to submit a subscription request for others')
    }
  });

  it('UnSubscribe user with valid subscription input - Artifact not found', async () => {
    const user = bluepagesResponse.content.user.profile;
    const req = { // tslint:disable-next-line
      authorization: { user } as any,
    } as IRequest;
    AuthenticationMiddleware.prototype.isAuthorizedUser = jest.fn().mockImplementationOnce(() => {
      return true;
    });
    const results1 = {
      first: jest.fn().mockReturnValue(null),
    } as any;
    const results2 = {
      first: jest.fn().mockReturnValue(null),
    } as any;
    // tslint:disable
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(subscriptionIdJson);
    }));
    Promise.all = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve([results1, results2]);
    }));
    try {
      await mutationResolver.unsubscribe(req, subscriptionIdJson);
      expect(true).toBe(false);
    } catch (err) {
      expect(err.message).toContain(`not found`)
    }
  });
});
