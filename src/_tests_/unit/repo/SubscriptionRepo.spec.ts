import { ChannelFrequencies, Role, State } from '../../../models/enums';
import { Subscription } from '../../../models/Subscription';
import { SubscriptionInput } from '../../../models/SubscriptionInput';
import { cassandraDBHelpers } from '../../../repo/cassandraDBHelpers';
import { SubscriptionRepo, SubscriptionRepoCassandra } from '../../../repo/SubscriptionRepo';
import * as srq from '../../../repo/SubscriptionRepoQueries';

const now = new Date();
const USER_ID = 'AAABBBCCC';
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

const sampleSubscriptionWithOptionalWebBell: Subscription = {
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
  },
  role: Role.AUTHOR,
  userId: USER_ID,
  state: State.ACTIVE,
  createdDate: now,
  updatedDate: now,
  subscriptionType: 'subscriptionType',
};

const sampleSubscriptionInputWithOptionalWebBell: SubscriptionInput = {
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
  },
  role: Role.AUTHOR,
  userId: USER_ID,
  subscriptionType: 'subscriptionType',
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

const queriedUserSubscriptionRecordFromDB: any = {
  app_id: APP_ID,
  artifact_id: [{ id: 'blog' }],
  user_id: USER_ID,
  state: State.ACTIVE,
};

const queriedSubscriptionRecordFromDB: any = {
  app_id: APP_ID,
  artifact_id: [{ id: 'blog' }],
  user_id: USER_ID,
  state: State.ACTIVE,
  artifact: [{ artifactIdElement: { id: 'blog' }, title: 'title' }],
  channelSettings: { email: { frequency: ChannelFrequencies.DAILY }, webBell: { frequency: ChannelFrequencies.NA } },
  role: Role.AUTHOR,
  createdDate: now,
  updatedDate: now,
};

const sampleInactiveSubscription: Subscription = {
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
  state: State.INACTIVE,
  createdDate: now,
  updatedDate: now,
  subscriptionType: 'subscriptionType',
};

const sampleSubscriptionWithRoleAsUser: Subscription = {
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
  role: Role.SUBSCRIBER,
  userId: USER_ID,
  state: State.ACTIVE,
  createdDate: now,
  updatedDate: now,
  subscriptionType: 'subscriptionType',
};

const subscrition: Subscription[] = new Array<Subscription>(0);
subscrition.push(sampleSubscription);
describe('get user subscriptions using userId', () => {
  it('should list active user subscriptions', async () => {
    const subscriptionRepo: SubscriptionRepo = new SubscriptionRepoCassandra();
    subscriptionRepo.userSubscriptions = jest.fn().mockReturnValue(subscrition);
    const userId = 'AAABBBCCC';
    const userSubscriptions = await subscriptionRepo.userSubscriptions(userId, [1]);
    expect(userSubscriptions.length).toEqual(1);
    expect(userSubscriptions[0].userId).toEqual('AAABBBCCC');
  });

  it('return active user subscriptions', async () => {
    const userId = 'A24876693';
    const userSubs: Subscription[] = [sampleSubscription];
    const userSubsriptions: any[] = [queriedUserSubscriptionRecordFromDB];
    const mockResultSet: any = userSubs;
    const mockResultSetWithUserSubscriptions: any = {
      rows: userSubsriptions,
    };
    const subscriptionRepo: SubscriptionRepo = new SubscriptionRepoCassandra();
     // tslint:disable
    subscriptionRepo.getSubscriptionByIds = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(mockResultSet);
    }));
    // tslint:disable
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(mockResultSetWithUserSubscriptions);
    }));
    const userSubscriptions = await subscriptionRepo.userSubscriptions(userId, [1]);
    expect(userSubscriptions.length).toEqual(1);
    expect(userSubscriptions[0].state).toEqual(State.ACTIVE);
  });

  it('do not return inactive user subscriptions', async () => {
    const userId = 'A24876693';
    const mockResultSet: any = [];
    const mockResultSetWithUserSubscriptions: any = {
      rows: [],
    };
    const subscriptionRepo: SubscriptionRepo = new SubscriptionRepoCassandra();
     // tslint:disable
    subscriptionRepo.getSubscriptionByIds = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(mockResultSet);
    }));
    // tslint:disable
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(mockResultSetWithUserSubscriptions);
    }));
    const userSubscriptions = await subscriptionRepo.userSubscriptions(userId, [1]);
    expect(userSubscriptions.length).toEqual(0);
  });

  it('return user subscriptions with role as USER', async () => {
    const userId = 'A24876693';
    const userSubs: Subscription[] = [sampleSubscriptionWithRoleAsUser];
    const userSubsriptions: any[] = [queriedUserSubscriptionRecordFromDB];
    const mockResultSet: any = userSubs;
  
    const mockResultSetWithUserSubscriptions: any = {
      rows: userSubsriptions,
    };
    const subscriptionRepo: SubscriptionRepo = new SubscriptionRepoCassandra();
     // tslint:disable
    subscriptionRepo.getSubscriptionByIds = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(mockResultSet);
    }));
    // tslint:disable
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(mockResultSetWithUserSubscriptions);
    }));
    const userSubscriptions = await subscriptionRepo.userSubscriptions(userId, [1], 'SUBSCRIBER');
    expect(userSubscriptions.length).toEqual(1);
    expect(userSubscriptions[0].role).toEqual('SUBSCRIBER');
  });

  it('return user subscriptions with role as AUTHOR', async () => {
    const userId = 'A24876693';
    const userSubs: Subscription[] = [sampleSubscription];
    const userSubsriptions: any[] = [queriedUserSubscriptionRecordFromDB];
    const mockResultSet: any = userSubs;
  
    const mockResultSetWithUserSubscriptions: any = {
      rows: userSubsriptions,
    };
    const subscriptionRepo: SubscriptionRepo = new SubscriptionRepoCassandra();
     // tslint:disable
    subscriptionRepo.getSubscriptionByIds = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(mockResultSet);
    }));
    // tslint:disable
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(mockResultSetWithUserSubscriptions);
    }));
    const userSubscriptions = await subscriptionRepo.userSubscriptions(userId, [1], 'AUTHOR');
    expect(userSubscriptions.length).toEqual(1);
    expect(userSubscriptions[0].role).toEqual('AUTHOR');
  });
});

describe('get subscriptions using artifact id', () => {
  it('should list active subscriptions', async () => {
    const userSubsriptions: any[] = [queriedSubscriptionRecordFromDB];
    const mockResultSetWithUserSubscriptions: any = {
      rows: userSubsriptions,
    };
    const subscriptionRepo: SubscriptionRepo = new SubscriptionRepoCassandra();
    subscriptionRepo.userSubscriptions = jest.fn().mockReturnValue(subscrition);
    const appId = APP_ID;
    const states: State[] = [State.ACTIVE];
    const artifactElement = srq.artifactToArtifactIdElement(sampleSubscription.artifact);
    const artifacts: any = {
      artifactId: { elements: artifactElement },
    };
    artifacts.map = jest.fn().mockReturnValue(['blog']);
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(mockResultSetWithUserSubscriptions);
    }));
    const userSubscriptions = await subscriptionRepo.getSubscriptionByIds(appId, states, artifacts,'AAABBBCCC');
    expect(userSubscriptions.length).toEqual(1);
    expect(userSubscriptions[0].userId).toEqual('AAABBBCCC');
    expect(userSubscriptions[0].appId).toEqual(APP_ID);
    expect(userSubscriptions[0].role).toEqual('AUTHOR');
    expect(userSubscriptions[0].state).toEqual(1);
    expect(userSubscriptions[0].artifact.elements[0].artifactIdElement.id).toEqual('blog');
  });

  it('should list inactive subscriptions', async () => {
    const userSubsriptions: any[] = [queriedSubscriptionRecordFromDB];
    const subscrption:any = userSubsriptions[0];
    subscrption['state'] = 2;
    const mockResultSetWithUserSubscriptions: any = {
      rows: userSubsriptions,
    };
    const subscriptionRepo: SubscriptionRepo = new SubscriptionRepoCassandra();
    subscriptionRepo.userSubscriptions = jest.fn().mockReturnValue(subscrition);
    const appId = APP_ID;
    const states: State[] = [State.INACTIVE];
    const artifactElement = srq.artifactToArtifactIdElement(sampleSubscription.artifact);
    const artifacts: any = {
      artifactId: { elements: artifactElement },
    };
    artifacts.map = jest.fn().mockReturnValue(['blog']);
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(mockResultSetWithUserSubscriptions);
    }));
    const userSubscriptions = await subscriptionRepo.getSubscriptionByIds(appId, states, artifacts,'AAABBBCCC');
    expect(userSubscriptions.length).toEqual(1);
    expect(userSubscriptions[0].userId).toEqual('AAABBBCCC');
    expect(userSubscriptions[0].appId).toEqual(APP_ID);
    expect(userSubscriptions[0].role).toEqual('AUTHOR');
    expect(userSubscriptions[0].state).toEqual(2);
    expect(userSubscriptions[0].artifact.elements[0].artifactIdElement.id).toEqual('blog');
  });

  it('should list no subscriptions with state as ACTIVE', async () => {
    const userSubsriptions: any[] = [];
    const mockResultSetWithUserSubscriptions: any = {
      rows: userSubsriptions,
    };
    const subscriptionRepo: SubscriptionRepo = new SubscriptionRepoCassandra();
    subscriptionRepo.userSubscriptions = jest.fn().mockReturnValue(subscrition);
    const appId = APP_ID;
    const states: State[] = [State.ACTIVE];
    const artifactElement = srq.artifactToArtifactIdElement(sampleSubscription.artifact);
    const artifacts: any = {
      artifactId: { elements: artifactElement },
    };
    artifacts.map = jest.fn().mockReturnValue(['blog']);
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(mockResultSetWithUserSubscriptions);
    }));
    const userSubscriptions = await subscriptionRepo.getSubscriptionByIds(appId, states, artifacts,'AAABBBCCC');
    expect(userSubscriptions.length).toEqual(0);
  });

  it('should list no subscriptions with state as INACTIVE', async () => {
    const userSubsriptions: any[] = [];
    const mockResultSetWithUserSubscriptions: any = {
      rows: userSubsriptions,
    };
    const subscriptionRepo: SubscriptionRepo = new SubscriptionRepoCassandra();
    subscriptionRepo.userSubscriptions = jest.fn().mockReturnValue(subscrition);
    const appId = APP_ID;
    const states: State[] = [State.INACTIVE];
    const artifactElement = srq.artifactToArtifactIdElement(sampleSubscription.artifact);
    const artifacts: any = {
      artifactId: { elements: artifactElement },
    };
    artifacts.map = jest.fn().mockReturnValue(['blog']);
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(mockResultSetWithUserSubscriptions);
    }));
    const userSubscriptions = await subscriptionRepo.getSubscriptionByIds(appId, states, artifacts,'AAABBBCCC');
    expect(userSubscriptions.length).toEqual(0);
  });
});

describe('delete artifact and remove artifact subscriptions', () => {
  it('should return No subscribers for the artifact subscriptions', async () => {
    const subscriptionRepo: SubscriptionRepo = new SubscriptionRepoCassandra();
    subscriptionRepo.getSubscriptionByIds = jest.fn().mockReturnValue([]);
    const response = await subscriptionRepo.delete(APP_ID, artifactIds, [State.ACTIVE, State.INACTIVE]);
    expect(response).toBeDefined();
    expect(response).toEqual(`No subscribers for the artifact`);
  });
  it('should successfully delete the subscribers', async () => {
    const subscriptionRepo: SubscriptionRepo = new SubscriptionRepoCassandra();
    subscriptionRepo.getSubscriptionByIds = jest.fn().mockReturnValue(subscrition);
    cassandraDBHelpers.batch = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(jest.doMock);
    }));
    const response = await subscriptionRepo.delete(APP_ID, artifactIds, [State.ACTIVE, State.INACTIVE]);
    expect(response).toBeDefined();
    expect(response).toEqual(`Successfully deleted`);
  });
  it('should throw error when there is a database connection failure', async () => {
    const subscriptionRepo: SubscriptionRepo = new SubscriptionRepoCassandra();
    subscriptionRepo.getSubscriptionByIds = jest.fn().mockReturnValue(subscrition);
    cassandraDBHelpers.batch = jest.fn().mockReturnValue(new Promise((reject) => {
      reject('connection error');
    }));
    try {
    await subscriptionRepo.delete(APP_ID, artifactIds, [State.ACTIVE, State.INACTIVE]);
    }catch(error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.error).toEqual(`Error while deleting subscriptions for artifact`);
    }
  });
});

describe('subscribe()', () => {
  it('create subscription response should contain optional webBell', async () => {
    const userId = 'AAABBBCCC';
    const subscriptionRepo: SubscriptionRepo = new SubscriptionRepoCassandra();
    subscriptionRepo.getSubscriptionByIds = jest.fn().mockReturnValueOnce([]);
    cassandraDBHelpers.batch = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(sampleSubscriptionWithOptionalWebBell);
    }));
    const userSubscription = await subscriptionRepo.subscribe(sampleSubscription, userId);
    expect(userSubscription.userId).toEqual('AAABBBCCC');
    expect(userSubscription.appId).toEqual(APP_ID);
    expect(userSubscription.state).toEqual(State.ACTIVE);
    expect(userSubscription.role).toEqual(Role.AUTHOR);
    expect(userSubscription.appId).toEqual(APP_ID);
    expect(userSubscription.artifact.elements[0].artifactIdElement.id).toEqual('blog');
    expect(userSubscription.channelSettings.email.frequency).toEqual('DAILY');
    if (userSubscription.channelSettings.webBell) {
    expect(userSubscription.channelSettings.webBell.frequency).toEqual('NA');
    } else {
      expect(false).toBeTruthy();
    }
  });

  it('create subscription response should not contain optional webBell', async () => {
    const userId = 'AAABBBCCC';
    const subscriptionRepo: SubscriptionRepo = new SubscriptionRepoCassandra();
    subscriptionRepo.getSubscriptionByIds = jest.fn().mockReturnValueOnce([]);
    cassandraDBHelpers.batch = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(sampleSubscriptionWithOptionalWebBell);
    }));
    const userSubscription = await subscriptionRepo.subscribe(sampleSubscriptionInputWithOptionalWebBell, userId);
    expect(userSubscription.userId).toEqual('AAABBBCCC');
    expect(userSubscription.appId).toEqual(APP_ID);
    expect(userSubscription.state).toEqual(State.ACTIVE);
    expect(userSubscription.role).toEqual(Role.AUTHOR);
    expect(userSubscription.artifact.elements[0].artifactIdElement.id).toEqual('blog');
    expect(userSubscription.channelSettings.email.frequency).toEqual('DAILY');
    expect(userSubscription.channelSettings.webBell).toBeUndefined();
  });

  it('can subscribe a user to an artifact from which they had previously unsubscribed', async () => {
    const userId = 'AAABBBCCC';
    const subscriptionRepo: SubscriptionRepo = new SubscriptionRepoCassandra();
    subscriptionRepo.getSubscriptionByIds = jest.fn().mockReturnValueOnce([sampleInactiveSubscription]);
    cassandraDBHelpers.batch = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(sampleSubscriptionWithOptionalWebBell);
    }));
    const userSubscription = await subscriptionRepo.subscribe(sampleSubscriptionInputWithOptionalWebBell, userId);
     expect(cassandraDBHelpers.batch).toBeCalled();
    expect(userSubscription.userId).toEqual('AAABBBCCC');
    expect(userSubscription.appId).toEqual(APP_ID);
    expect(userSubscription.state).toEqual(State.ACTIVE);
    expect(userSubscription.role).toEqual(Role.AUTHOR);
    expect(userSubscription.artifact.elements[0].artifactIdElement.id).toEqual('blog');
    expect(userSubscription.channelSettings.email.frequency).toEqual('DAILY');
    expect(userSubscription.channelSettings.webBell).toBeUndefined();
  });

  it('can subscribe a user to the same artifact to which they had previously subscribed', async () => {
    const userId = 'AAABBBCCC';
    const subscriptionRepo: SubscriptionRepo = new SubscriptionRepoCassandra();
    subscriptionRepo.getSubscriptionByIds = jest.fn().mockReturnValueOnce([sampleSubscription]);
    const userSubscription = await subscriptionRepo.subscribe(sampleSubscription, userId);
    expect(userSubscription.userId).toEqual('AAABBBCCC');
    expect(userSubscription.appId).toEqual(APP_ID);
    expect(userSubscription.state).toEqual(State.ACTIVE);
    expect(userSubscription.role).toEqual(Role.AUTHOR);
    expect(userSubscription.artifact.elements[0].artifactIdElement.id).toEqual('blog');
    expect(userSubscription.channelSettings.email.frequency).toEqual('DAILY');
    expect(userSubscription.channelSettings.webBell).toBeDefined();
    if (userSubscription.channelSettings.webBell) {
      expect(userSubscription.channelSettings.webBell.frequency).toEqual('NA');
      }
  });

  describe('when an error occurs during processing of subscription', () => {
    it('Error during formation of subscription', async () => {
      const userId = 'AAABBBCCC';
      const subscriptionRepo: SubscriptionRepo = new SubscriptionRepoCassandra();
      subscriptionRepo.getSubscriptionByIds = jest.fn().mockReturnValueOnce([{}]);
      try {
        await subscriptionRepo.subscribe(sampleSubscriptionInputWithOptionalWebBell, userId);
      } catch(error) {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toEqual(`Error during formation of subscription`);
      }
    });
  });

  describe('when an error occurs during batch update of the subscription queries', () => {
    it('catches and throws an error message', async () => {
      const userId = 'AAABBBCCC';
      const subscriptionRepo: SubscriptionRepo = new SubscriptionRepoCassandra();
      subscriptionRepo.getSubscriptionByIds = jest.fn().mockReturnValueOnce([]);
      cassandraDBHelpers.batch = jest.fn().mockRejectedValue(new Promise((reject) => {
        reject(`connection failure`);
      }));
      try {
        await subscriptionRepo.subscribe(sampleSubscriptionInputWithOptionalWebBell, userId);
      } catch(error) {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toEqual(`Error while subscribing for artifact`);
      }
    });
  });
});

  describe('updateSubscription()', () => {

    it('should return Subscription not found for invalid artifact', async () => {
      const subscriptionRepo: SubscriptionRepo = new SubscriptionRepoCassandra();
      const results = {
        first: jest.fn().mockReturnValue(null),
      } as any;
      // tslint:disable
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(results);
    }));
    try {
      await subscriptionRepo.updateSubscription([sampleSubscription]);
    } catch(error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain(`not found`);
      expect(error.code).toBe(404);
    }
    });

    it('should return Error while retrieving subscriptions from database', async () => {
      const subscriptionRepo: SubscriptionRepo = new SubscriptionRepoCassandra();
      // tslint:disable
    cassandraDBHelpers.execute = jest.fn().mockRejectedValue(new Promise((reject) => {
      reject('connection error');
    }));
    try {
      await subscriptionRepo.updateSubscription([sampleSubscription]);
    } catch(error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain(`Error while retrieving Subscription from database`);
    }
    });

    it('should return updated subscription response', async () => {
      const subscriptionRepo: SubscriptionRepo = new SubscriptionRepoCassandra();
      const results = {
        first: jest.fn().mockReturnValue(queriedSubscriptionRecordFromDB),
      } as any;
      // tslint:disable
    cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(results);
    }));
    cassandraDBHelpers.batch = jest.fn().mockReturnValue(new Promise((resolve) => {
      resolve(jest.doMock);
    }));
    const response = await subscriptionRepo.updateSubscription([sampleSubscription]);
    expect(response).toBeDefined();
    expect(response[0].appId).toBe(queriedSubscriptionRecordFromDB.app_id);
    expect(JSON.stringify(response[0].artifact.elements[0].artifactIdElement)).toBe(JSON.stringify(queriedSubscriptionRecordFromDB.artifact[0].artifactIdElement));
    expect(JSON.stringify(response[0].artifact.elements[0].title)).toBe(JSON.stringify(queriedSubscriptionRecordFromDB.artifact[0].title));
    expect(response[0].artifact.elements[0].artifactDate).toBe(ARTIFACT_DATE);
    expect(JSON.stringify(response[0].channelSettings)).toBe(JSON.stringify(queriedSubscriptionRecordFromDB.channelSettings));
    expect(response[0].role).toBe(queriedSubscriptionRecordFromDB.role);
    expect(response[0].userId).toBe(queriedSubscriptionRecordFromDB.user_id);
    expect(response[0].state).toBe(queriedSubscriptionRecordFromDB.state);
    expect(response[0].updatedDate).toBeDefined();
  });

  it('should return Error while bulk subscriptions update', async () => {
    const subscriptionRepo: SubscriptionRepo = new SubscriptionRepoCassandra();
    const results = {
      first: jest.fn().mockReturnValue(queriedSubscriptionRecordFromDB),
    } as any;
    // tslint:disable
  cassandraDBHelpers.execute = jest.fn().mockReturnValue(new Promise((resolve) => {
    resolve(results);
  }));
  cassandraDBHelpers.batch = jest.fn().mockRejectedValue(new Promise((reject) => {
    reject(jest.doMock);
  }));
  try {
  await subscriptionRepo.updateSubscription([sampleSubscription]);
} catch(error) {
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toBe(`Error while bulk subscriptions update`);
}
});
});
