import * as cassandra from 'cassandra-driver';
import { toLower, toUpper } from '../resolvers/node_modules/lodash';
import { logger } from '../logger';
import { Artifact } from '../models/Artifact';
import { ArtifactElement } from '../models/ArtifactElement';
import { ArtifactId } from '../models/ArtifactId';
import { ArtifactIdElement } from '../models/ArtifactIdElement';
import { State } from '../models/enums';
import { Subscription } from '../models/Subscription';
import { SubscriptionId } from '../models/SubscriptionId';
import { SubscriptionInput } from '../models/SubscriptionInput';
import { SubscriptionUsersInput } from '../models/SubscriptionUsersInput';
import { SubscriptionUsersWithSettingsInput } from '../models/SubscriptionUsersWithSettingsInput';
import { SubscriptionUserWithSettings } from '../models/SubscriptionUserWithSettings';

export const idFields = ['app_id', 'artifact_id', 'user_id', 'state'];

export const subscriptionFields = idFields.concat(['artifact', 'channelsettings', 'role',
  'created_date', 'updated_date', 'subscriptiontype']);
export const subscriptionInsertFields = subscriptionFields.join(',');
export const subscriptionInsertParams = subscriptionFields.map(_ => '?').join(',');

export const userSubscriptionsFields = idFields;
export const userSubscriptionsInsertFields = userSubscriptionsFields.join(',');
export const userSubscriptionsInsertParams = userSubscriptionsFields
  .map(_ => '?').join(',');
export const pKeyCond = idFields.map(f => `${f} = ?`).join(' AND ');

export const selectSubscriptionJsonQuery: string = `select JSON *
  from subscriptions where ${pKeyCond}`;

export const selectSubscriptionQuery: string = `select  *
  from subscriptions where ${pKeyCond}`;

export const selectUserSubscriptionJsonQuery: string = `select JSON *
  from user_subscriptions where ${pKeyCond}`;

export const deleteSubscriptionQuery: string
  = `delete from ${subscriptionsTableName()} where ${pKeyCond} `;


export const cascadeDeleteSubscriptionsTable: string = `delete from ${subscriptionsTableName()} where
 artifact_id in ? and app_id = ? and state in ? and user_id in ?`;

export const cascadeDeleteUserSubscriptionsTable: string = `delete from ${userSubscriptionsTableName()}
where artifact_id in ? and app_id = ? and state in ? and user_id in ?`;

export const deleteUserSubscriptionQuery: string
  = `delete from ${userSubscriptionsTableName()} where ${pKeyCond} `;

export function userSubscriptionsTableName(): string {
  return 'user_subscriptions';
}
export const subscriptionsPKeyWhere = idFields.map(f => `${f} = ?`).join(' ');

export const insertSubscriptionQuery = `insert into ${subscriptionsTableName()}
  (${subscriptionInsertFields}) values
  (${subscriptionInsertParams})`;

export const insertUserSubscriptionQuery = `insert into ${userSubscriptionsTableName()}
  (${userSubscriptionsFields}) values
  (${userSubscriptionsInsertParams})`;

export const subscriptionIdCond = `app_id = ?
  and state in ?
  and artifact_id in ?`;

export const selectSubscriptionsByIdsQuery = `select * from ${subscriptionsTableName()}
where ${subscriptionIdCond}`;

export const selectArtifactid = `select artifact_id from subscriptions`;

export const selectSubscriptionsForArtifactId = `select * from
  ${subscriptionsTableName()} where app_id = ? `;

export const subString = `allow filtering`;

export const queryForRole = ` and role = ? `;

export const selectSubscriptionsForArtifactIdcount = `select count(*) from
  ${subscriptionsTableName()} where app_id = ? `;


export const subscriptionById = `select * from ${subscriptionsTableName()}
where ${pKeyCond}`;

export const selectUserSubscriptionsByUserIdQuery = `select * from
  ${userSubscriptionsTableName()} where user_id = ? and state in ?`;

export const selectSubscriptionsForArtifactIdQuery = `select * from ${subscriptionsTableName()}
where user_id = ? and state in ? and app_id = ? and artifact_id = ? `;


export const updateArtifactQuery = `update ${subscriptionsTableName()}
  set artifact = ?, channelsettings = ?, role = ? where ${pKeyCond}`;

export function getSubscriptionInstance(
  subscriptionInput: SubscriptionInput,
  userId: string,
 // subscriptionType: string,
): Subscription {
  const now: Date = new Date();
  const subscription: Subscription = {
    ...subscriptionInput,
    userId,
    subscriptionType: subscriptionInput.subscriptionType,
    // subscriptionType: 'subscriptionType',(not working)
    createdDate: now,
    updatedDate: now,
    state: State.ACTIVE,

    
  };
  return subscription;
}

export function getSubscriptionFromSubscriptionUsersInput(
  input: SubscriptionUsersInput,
  userId: string,
  // subscriptionType: string,
): Subscription {
  const now: Date = new Date();
  const subscription: Subscription = {
    userId,
    // subscriptionType,
    appId: input.appId,
    artifact: input.artifact,
    channelSettings: input.channelSettings,
    role: input.role,
   // subscriptionType: 'subscriptiontype',
    subscriptionType: input.subscriptionType,
    createdDate: now,
    updatedDate: now,
    state: State.ACTIVE,
   
  };
  return subscription;
}

export function getSubscriptionFromSubscriptionUsersWithSettingsInput(
  input: SubscriptionUsersWithSettingsInput,
  userWithSettings: SubscriptionUserWithSettings,
): Subscription {
  const now: Date = new Date();
  const subscription: Subscription = {
    appId: input.appId,
    artifact: input.artifact,
    userId: userWithSettings.userId,
    channelSettings: userWithSettings.channelSettings,
    role: userWithSettings.role,
    createdDate: now,
    updatedDate: now,
    state: State.ACTIVE,
    // subscriptionType: 'subscriptiontype',
    subscriptionType: userWithSettings.subscriptionType,
  };
  return subscription;
}

export function updateSubscriptionToDbParams(
  subscription: Subscription,
): any[] {
  const ret: any[] = [
    artifactToDbParams(subscription.artifact),
    subscription.channelSettings,
    subscription.role,
     // subscription.subscriptionType,
  ];
  subscriptionPKeyValues(subscription).forEach((e: any) => {
    ret.push(e);
  });
  logger.silly('updateSubscription params: ', ret);
  return ret;
}

export function userSubscriptionToDbParams(
  subscription: Subscription,
  artifactIds: ArtifactIdElement[],
): any[] {
  return [
    toLower(subscription.appId),
    artifactIds,
    toUpper(subscription.userId),
    subscription.state,
    // subscription.subscriptionType,
  ];
}

export function subscriptionToDbParams(
  subscription: Subscription,
  artifactIds: ArtifactIdElement[]): any[] {
  // If webBell value is not provided, remove it from the Channel Settings array. Else,
  // a null value will be included in the DB param values.
  if (!subscription.channelSettings.webBell) {
    logger.info('Removed the webBell paramter with null value');
    delete subscription.channelSettings['webBell'];
  }
  const ret = [
    toLower(subscription.appId),
    artifactIds,
    toUpper(subscription.userId),
    subscription.state,
    artifactToDbParams(subscription.artifact),
    subscription.channelSettings,
    subscription.role,
    // subscription.subscriptionType,
    subscription.createdDate,
    subscription.updatedDate,
    subscription.subscriptionType,
  ];
  logger.debug('subscriptionToDbParams: ', ret);
  return ret;
}

export function subToDbParams(
  subscription: Subscription,
  artifactIds: ArtifactIdElement[]): any {
  const now = new Date();
  const ret = {
    app_id: subscription.appId,
    artifact_id: artifactIds,
    user_id: subscription.userId,
    state: subscription.state,
    artifact: artifactToDbParams(subscription.artifact),
    channelsettings: subscription.channelSettings,
    role: subscription.role,
    created_date: subscription.createdDate,
    updated_date: now,
   //  subscriptionType: subscription.subscriptionType,
  };
  logger.debug('subToDbParams: ', ret);
  return ret;
}

export function userDbParams(
  subscription: Subscription,
  artifactIds: ArtifactIdElement[]): any {
  const ret = {
    app_id: subscription.appId,
    artifact_id: artifactIds,
    user_id: subscription.userId,
    state: subscription.state,
  };
  logger.debug('userDbParams: ', ret);
  return ret;
}

export function subscriptionIdDbParams(
  appId: string,
  artifactElement: ArtifactIdElement[],
  userId: string,
  state: number,
): any {
  const ret = {
    state,
    appId,
    userId,
    artifactId: { elements: artifactElement },
  };
  logger.debug('userDbParams: ', ret);
  return ret;
}


export function rowToSubscription(row: cassandra.types.Row): Subscription {
  const subscription: Subscription = {
    appId: row['app_id'],
    artifact: {
      elements: row['artifact'].map((artifact: any, idx: number) => {
        return {
          artifactIdElement: row['artifact_id'][idx],
          title: artifact['title'],
          artifactDate: artifact['artifactdate'],
        };
      }),
    },
    channelSettings: row['channelsettings'],
    role: row['role'],
    userId: row['user_id'],
    state: row['state'],
    createdDate: row['created_date'],
    updatedDate: row['updated_date'],
    subscriptionType: row['subscriptiontype'],
  };
  logger.debug('Returning subscription: ', subscription, ' Row: ', row);
  return subscription;
}

export function artifactToDbParams(artifact: Artifact): any[] {
  const ret: any[] = artifact.elements.map((e: ArtifactElement) => {
    return {
      title: e.title,
      artifactdate: e.artifactDate,
    };
  });
  logger.debug('artifactToDbParams: ', ret);
  return ret;
}

export function artifactToArtifactIdElement(
  artifact: Artifact,
): ArtifactIdElement[] {
  return artifact.elements.map((e: ArtifactElement) => (new ArtifactIdElement(toLower(e.artifactIdElement.id))));
}

export function usersSubscriptionsTableName(): string {
  return 'users_subscriptions';
}

export function subscriptionPKeyValues(subscription: Subscription): any[] {
  const ret = [
    toLower(subscription.appId),
    artifactToArtifactIdElement(subscription.artifact),
    toUpper(subscription.userId),
    subscription.state,
   //  subscription.subscriptionType,
   // subscriptionType: 'subscriptiontype',
  ];
  logger.debug('Primary key params from Subscription: ', ret);
  return ret;
}

export function getSubscriptionKeyValues(appId: string,
  states: State[],
  artifactIds: ArtifactId[]): any[] {
  const ret = [
    toLower(appId), states, artifactIds.map(id =>
      (id.elements.map(e => (new ArtifactIdElement(toLower(e.id))))))];
  logger.debug('Primary key params from Subscription: ', ret);
  return ret;
}

export function subscriptionInputPKeyValues(
  subscriptionInput: SubscriptionInput,
): any[] {
  const ret = [
    toLower(subscriptionInput.appId),
    subscriptionInput.artifact.elements
      .map((e: ArtifactElement) => (new ArtifactIdElement(toLower(e.artifactIdElement.id)))),
    toUpper(subscriptionInput.userId),
    State.ACTIVE,
     subscriptionInput.subscriptionType,
  ];
  logger.debug('subscriptionINputPKeyValues: ', ret);
  return ret;
}

export function subscriptionIdPKeyValues(
  subscription: SubscriptionId,
): any[] {
  const ret = [
    toLower(subscription.appId),
    subscription.artifactId.elements
      .map((e: ArtifactIdElement) => (new ArtifactIdElement(toLower(e.id)))),
    toUpper(subscription.userId),
    subscription.state,
  ];
  logger.debug('Primary key params from SubscriptionId: ', ret);
  return ret;
}

export function subscriptionsTableName(): string {
  return 'subscriptions';
}

