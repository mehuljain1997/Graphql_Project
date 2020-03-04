import * as cassandra from 'cassandra-driver';
import { logger } from '../../../logger';
import { ArtifactId } from '../../../models/ArtifactId';
import { ChannelFrequencies, Role, State } from '../../../models/enums';
import { QueryResults } from '../../../models/QueryResults';
import { Subscription } from '../../../models/Subscription';
import { SubscriptionId } from '../../../models/SubscriptionId';
import { SubscriptionInput } from '../../../models/SubscriptionInput';
import { cassandraDBHelpers } from '../../../repo/cassandraDBHelpers';
import { SubscriptionRepoCassandra } from '../../../repo/SubscriptionRepo';
import {
  deleteSubscriptionQuery,
  deleteUserSubscriptionQuery,
  subscriptionIdPKeyValues,
} from '../../../repo/SubscriptionRepoQueries';
import { TestSettings } from '../../testrunner/TestSettings';

const now = new Date();
const USER_ID = 'A24876693';
const USER_ID_TEST = 'USER_ID_TEST';
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

const sampleSubscriptionTestUser: Subscription = {
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
  userId: USER_ID_TEST,
  state: State.ACTIVE,
  createdDate: now,
  updatedDate: now,
  subscriptionType: 'subscriptionType',
};

const sampleSubscriptionIdActive: SubscriptionId = getSubscriptionIdFromSubscription(sampleSubscription);
const sampleSubscriptionIdTestUser: SubscriptionId = getSubscriptionIdFromSubscription(sampleSubscriptionTestUser);
const sampleSubscriptionIdInactive: SubscriptionId = {
  ...sampleSubscriptionIdActive,
  state: State.INACTIVE,
};

const subscriptionRepo = new SubscriptionRepoCassandra();

logger.debug(`delayShort: ${TestSettings.getDelayShort()}`);
logger.debug(`delayLong: ${TestSettings.getDelayLong()}`);

describe('subscription mutation features of repo', () => {

  beforeAll(async () => {
    logger.debug('subscription mutation features of repo - beforeAll');
    await cleanUpSubscription(sampleSubscriptionIdActive);
    await cleanUpSubscription(sampleSubscriptionIdInactive);
    logger.debug('subscription mutation features of repo - beforeAll - stop');
  });

  it('should subscribe user', async () => {
    logger.debug('subscription mutation features of repo - should subscribe user');
    await subscriptionRepo.subscribe(sampleSubscription, USER_ID);
    try {
      await cassandraDBHelpers.execute(
        `select JSON * from subscriptions where app_id = '${APP_ID}'`)
        .then((result: cassandra.types.ResultSet) => {
          expect(result.rows.length).toEqual(1);
          const json = JSON.parse(result.rows[0]['[json]']);
          expect(json['user_id']).toEqual(sampleSubscription.userId);
          expect(json['app_id']).toEqual(sampleSubscription.appId);
          expect(json['artifact'][0]['title'])
            .toEqual(sampleSubscription.artifact.elements[0].title);
          expect(json['channelsettings'])
            .toEqual(sampleSubscription.channelSettings);
          expect(json['role'])
            .toEqual(sampleSubscription.role);
        });
      await cassandraDBHelpers.execute(`select JSON * from subscriptions where app_id = '${APP_ID}'`)
        .then((result: cassandra.types.ResultSet) => {
          expect(result.rows.length).toEqual(1);
          const json = JSON.parse(result.rows[0]['[json]']);
          expect(json['user_id']).toEqual(sampleSubscription.userId);
          expect(json['app_id']).toEqual(sampleSubscription.appId);
        });
    } finally {
      await cleanUpSubscription(sampleSubscriptionIdActive);
      logger.debug('subscription mutation features of repo - should subscribe user - stop');
    }
  });

  it('should unsubscribe user', async () => {
    logger.debug('subscription mutation features of repo - should unsubscribe user');
    try {
      await subscriptionRepo.subscribe(sampleSubscription, USER_ID);
      await subscriptionRepo.unsubscribe(sampleSubscriptionIdActive);
      await cassandraDBHelpers.execute(`select JSON * from subscriptions where app_id = '${APP_ID}'`)
        .then((result: cassandra.types.ResultSet) => {
          expect(result.rows.length).toEqual(1);
          const json = JSON.parse(result.rows[0]['[json]']);
          expect(json['state']).toEqual(State.INACTIVE);
        });
      await cassandraDBHelpers.execute(`select JSON * from subscriptions where app_id = '${APP_ID}'`)
        .then((result: cassandra.types.ResultSet) => {
          expect(result.rows.length).toEqual(1);
          const json = JSON.parse(result.rows[0]['[json]']);
          expect(json['state']).toEqual(State.INACTIVE);
        });
    } finally {
      await cleanUpSubscription(sampleSubscriptionIdActive);
      await cleanUpSubscription(sampleSubscriptionIdInactive);
      logger.debug('subscription mutation features of repo - should unsubscribe user - stop');
    }
  });
});

describe('subscription retrieval features of repo', () => {

  const USER_ID2: string = 'B24876693';
  const artifactIds: ArtifactId[] = [];
  const samples: SubscriptionInput[] = [];
  const subResults: Subscription[] = [];

  beforeAll(async () => {
    logger.debug('subscription retrieval features of repo - beforeAll');
    await cleanUpSubscription(sampleSubscriptionIdActive);
    await subscriptionRepo.subscribe(sampleSubscription, sampleSubscription.userId);
    await recreateSubs({ ...sampleSubscription, userId: USER_ID }, false);
    await recreateSubs({ ...sampleSubscription, userId: USER_ID2 }, false);
    logger.debug('subscription retrieval features of repo - beforeAll - stop');
  });

  afterAll(async () => {
    logger.debug('subscription retrieval features of repo - afterAll');
    await cleanUpSubscription(sampleSubscriptionIdActive);
    await recreateSubs({ ...sampleSubscription, userId: USER_ID }, true);
    await recreateSubs({ ...sampleSubscription, userId: USER_ID2 }, true);
    logger.debug('subscription retrieval features of repo - afterAll - stop');
  });

  async function recreateSubs(subscription: Subscription, cleanOnly: boolean): Promise<void> {
    for (let i: number = 0; i < 10; i += 1) {
      const artifactId = { id: `blog ${i}` };
      const sample: SubscriptionInput = {
        ...subscription,
        channelSettings: subscription.channelSettings,
        artifact: {
          elements: [
            {
              artifactIdElement: artifactId,
              title: subscription.artifact.elements[0].title,
              artifactDate: ARTIFACT_DATE,
            },
          ],
        },
      };
      await cleanUpSubscription(getSubscriptionIdFromSubscriptionInput(sample, subscription.state));
      if (!cleanOnly) {
        artifactIds.push({ elements: [artifactId] });
        samples.push(sample);
        const subsResult = await subscriptionRepo.subscribe(sample, sample.userId);
        subResults.push(subsResult);
      }
    }
  }

  it('should return all subscriptions by id', async () => {
    logger.debug('subscription retrieval features of repo - should return all subscriptions by id');
    const subs = await subscriptionRepo.getSubscriptionByIds(
      sampleSubscription.appId,
      [State.ACTIVE, State.INACTIVE],
      artifactIds);
    expect(subs.length).toBeGreaterThan(0);
    expect(subs.length).toEqual(artifactIds.length);
    logger.debug('subscription retrieval features of repo - should return all subscriptions by id - stop');
  });

  it('should return subset of subscriptions', async () => {
    logger.debug('subscription retrieval features of repo - should return subset of subscriptions');
    const subsetSize = 5;
    const subs5 = await subscriptionRepo.getSubscriptionByIds(
      sampleSubscription.appId, [State.ACTIVE, State.INACTIVE],
      artifactIds.slice(0, subsetSize), USER_ID);
    expect(subs5.length).toBeGreaterThan(0);
    expect(subs5.length).toEqual(artifactIds.slice(0, subsetSize).length);
    logger.debug('subscription retrieval features of repo - should return subset of subscriptions - stop');
  });

  it('should return empty list if subscription does not exists', async () => {
    logger.debug('subscription retrieval features of repo - should return empty list if subscription does not exists');
    const empty = await subscriptionRepo.getSubscriptionByIds(
      sampleSubscription.appId, [State.ACTIVE, State.INACTIVE],
      [{ elements: [{ id: 'non existent' }] }]);
    expect(empty.length).toEqual(0);
    // tslint:disable-next-line:max-line-length
    logger.debug('subscription retrieval features of repo - should return empty list if subscription does not exists - stop');
  });

  it('should match subscription stored via subscribe', async () => {
    logger.debug('subscription retrieval features of repo - should match subscription stored via subscribe');
    const single = await subscriptionRepo.getSubscriptionByIds(
      sampleSubscription.appId, [State.ACTIVE, State.INACTIVE],
      [{ elements: samples[0].artifact.elements.map(e => e.artifactIdElement) }],
      USER_ID);
    expect(single.length).toEqual(1);
    const normalized: Subscription = {
      ...single[0],
      createdDate: subResults[0].createdDate,
      updatedDate: subResults[0].updatedDate,
    };
    expect(normalized).toMatchObject(subResults[0]);
    logger.debug('subscription retrieval features of repo - should match subscription stored via subscribe - stop');
  });

  it('should list user subscriptions', async () => {
    logger.debug('subscription retrieval features of repo - should list user subscriptions');
    const userId = USER_ID;
    const userSubs = await subscriptionRepo.userSubscriptions(userId, [State.ACTIVE]);
    expect(userSubs.length).toBeGreaterThan(0);
    logger.debug('subscription retrieval features of repo - should list user subscriptions - stop');
  });

  it('Fetch Subscriptions by pagination', async () => {
    const query: string = `select * from subscriptions where app_id = '${APP_ID}'`;
    await subscriptionRepo.subscribe(sampleSubscription, USER_ID);
    await subscriptionRepo.subscribe(sampleSubscription, USER_ID_TEST);
    try {
      let pageState: string | undefined = '';
      await cassandraDBHelpers.paginate(
        query, [], {}, '', 1)
        .then((result: QueryResults) => {
          expect(result.subscriptions).toBeDefined();
          if (result.subscriptions) {
            expect(result.subscriptions.length).toEqual(1);
            expect(result.subscriptions[0].userId).toBe(USER_ID);
          }
          expect(result.pageState).toBeDefined();
          pageState = result.pageState;
        });
      await cassandraDBHelpers.paginate(
        query, [], {}, pageState, 1)
          .then((result: QueryResults) => {
            expect(result.subscriptions).toBeDefined();
            if (result.subscriptions) {
              expect(result.subscriptions.length).toEqual(1);
              expect(result.subscriptions[0].userId).toBe(USER_ID_TEST);
            }
          });
    } finally {
      await cleanUpSubscription(sampleSubscriptionIdActive);
      await cleanUpSubscription(sampleSubscriptionIdTestUser);
      logger.debug('subscription mutation features of repo - should subscribe user - stop');
    }
  });
});

afterAll(async () => {
  logger.debug('afterAll');
  const start: number = Date.now();
  await cassandraDBHelpers.shutdown();
  const duration: number = Date.now() - start;
  logger.debug(`afterAll - stop ${duration}`);
});

async function cleanUpSubscription(id: SubscriptionId): Promise<void> {
  await cassandraDBHelpers.execute(
    deleteSubscriptionQuery,
    subscriptionIdPKeyValues(id),
  ).catch((err) => {
    logger.error('Error when cleaning up subscription.');
    logger.error(err);
    throw err;
  });
  await cassandraDBHelpers.execute(
    deleteUserSubscriptionQuery,
    subscriptionIdPKeyValues(id),
  ).catch((err) => {
    logger.error('Error when cleaning up user subscription.');
    logger.error(err);
    throw err;
  });
}

function getSubscriptionIdFromSubscription(subscription: Subscription): SubscriptionId {
  return {
    appId: subscription.appId,
    artifactId: {
      elements: subscription.artifact.elements
        .map(e => e.artifactIdElement),
    },
    userId: subscription.userId,
    state: subscription.state,
  };
}

function getSubscriptionIdFromSubscriptionInput(subscriptionInput: SubscriptionInput, state: State): SubscriptionId {
  return {
    state,
    appId: subscriptionInput.appId,
    artifactId: {
      elements: subscriptionInput.artifact.elements
        .map(e => e.artifactIdElement),
    },
    userId: subscriptionInput.userId,
  };
}
