import * as cassandra from 'cassandra-driver';
import { isEmpty, toLower, toUpper } from '../resolvers/node_modules/lodash';
import { logger } from '../logger';
import { ArtifactId } from '../models/ArtifactId';
import { Role, State } from '../models/enums';
import { QueryResults } from '../models/QueryResults';
import { Subscription } from '../models/Subscription';
import { SubscriptionId } from '../models/SubscriptionId';
import { SubscriptionInput } from '../models/SubscriptionInput';
import { SubscriptionUsersInput } from '../models/SubscriptionUsersInput';
import { SubscriptionUsersWithSettingsInput } from '../models/SubscriptionUsersWithSettingsInput';
import { validateAppId } from '../resolvers/commons';
import { BadRequest } from '../resolvers/exceptions/BadRequest';
import { NotFound } from '../resolvers/exceptions/NotFound';
import { cassandraDBHelpers } from './cassandraDBHelpers';
import * as srq from './SubscriptionRepoQueries';
// import { query } from 'winston';

export interface SubscriptionRepo {

  subscribe(
    subscriptionInput: SubscriptionInput,
    userId: string,
  ): Promise<Subscription>;

  subscribeUsers(
    subscriptionUsersInput: SubscriptionUsersInput,
  ): Promise<Subscription[]>;

  subscribeUsersWithSettings(
    subscriptionUsersWithSettingsInput: SubscriptionUsersWithSettingsInput,
  ): Promise<Subscription[]>;

  unsubscribe(
    subscriptionId: SubscriptionId,
  ): Promise<SubscriptionId>;

  updateSubscription(
    subscriptionInput: SubscriptionInput[],
  ): Promise<Subscription[]>;

  delete(
    appId: string, artifactIds: ArtifactId, states: State[],
  ): Promise<string>;

  deleteCascade(
    appId: string, artifactIds: [], userId: [], states: State[],
  ): any;

  getSubscriptionByIds(
    appId: string,
    states: State[],
    artifactIds: ArtifactId[],
    userId?: string,
  ): Promise<Subscription[]>;

  getPaginationResults(
    appId: string,
    states: State[],
    artifactIds: ArtifactId[],
    userId?: string,
    pageState?: string,
    fetchSize?: number,
  ): Promise<QueryResults>;

  getAllArtifactIdCount(
    appId: string,
    artifactIds: ArtifactId[],
    userId?: string,
  ): Promise<any>;

  getAllArtifactId(
    appId: string,
    artifactIds: ArtifactId[],
    userId?: string,
  ): Promise<any>;


  userSubscriptions(
    userId: string,
    states: State[],
    role?: string,
    appId?: string,
    artifactIds?: ArtifactId,
  ): Promise<Subscription[]>;

}

export class SubscriptionRepoCassandra implements SubscriptionRepo {

  public async delete(
    appId: string, artifactIds: ArtifactId, states: State[]): Promise<string> {

    const batchQueries = new Array();
    const subList: Subscription[] = await this.getSubscriptionByIds(
      toLower(appId), states, [artifactIds]);
    logger.debug(`List size of subscribers :: ${subList.length}`);
    if (isEmpty(subList)) {
      return `No subscribers for the artifact`;
    }
    logger.info(`Retrieved subscriptions for the artifact (Delete) : ${JSON.stringify(artifactIds)}`);
    for (const sub of subList) {
      const artifactElement = srq.artifactToArtifactIdElement(sub.artifact);
      const subscriptionIdent: SubscriptionId = srq.subscriptionIdDbParams(sub.appId,
        artifactElement, sub.userId, sub.state);
      batchQueries.push({
        query: srq.deleteSubscriptionQuery,
        params: srq.subscriptionIdPKeyValues(subscriptionIdent),
      },
        {
          query: srq.deleteUserSubscriptionQuery,
          params: srq.subscriptionIdPKeyValues(subscriptionIdent),
        });
    }
    return cassandraDBHelpers.batch(batchQueries, { prepare: true }).then(() => {
      logger.info(`Batch delete Successfully completed.`);
      return 'Successfully deleted';
    }).catch((error) => {
      logger.error(`Error in delete subscriptions:: ${JSON.stringify(error)}`);
      throw Error(`Error while deleting subscriptions for artifact`);
    });
  }


  public async deleteCascade(
    appId: string, artifactIds: [], userId: [], states: State[]): Promise<any> {
    let partitionByNum: number = userId.length;
    if (userId.length > 100) {
      partitionByNum = 100;
    }
    let first: number = 0;
    let last: number = partitionByNum;
    let artiSection: any;
    let userSection: any;
    while (first < userId.length) {
      artiSection = artifactIds.slice(first, last);
      userSection = userId.slice(first, last);
      first = first + partitionByNum;
      last = last + partitionByNum;
      if (last > userId.length) {
        last = userId.length;
      }

      const queryForSubscriptions = srq.cascadeDeleteSubscriptionsTable;
      const params = [artiSection, toLower(appId), states, userSection];
      const queryForUserSubscriptions = srq.cascadeDeleteUserSubscriptionsTable;
      await this.deleteSubscriptionOverhead(queryForSubscriptions, params)
        .then(() => {
          logger.info(`deleteCascade Successfully completed in Subscriptions`);
          return 'Successfully deleted';
        }).catch((error) => {
          logger.error(`Error in delete subscriptions:: ${JSON.stringify(error)}`);
          throw Error(`Error while deleting subscriptions for artifact`);
        });
      await this.deleteSubscriptionOverhead(queryForUserSubscriptions, params)
        .then(() => {
          logger.info(`deleteCascade Successfully completed in UserSubscription.`);
          return 'Successfully deleted';
        }).catch((error) => {
          logger.error(`Error in delete usersubscriptions:: ${JSON.stringify(error)}`);
          throw Error(`Error while deleting subscriptions for artifact`);
        });
    }
    return 'Sucessfully Deleted Records';
  }

  public deleteSubscriptionOverhead(queryfordeletion: string, param: string[]): any {
    return cassandraDBHelpers.execute(queryfordeletion, param, { prepare: true })
      .then(() => {
        logger.info(`Delete Successfully completed`);
        return 'Successfully deleted';
      }).catch((error) => {
        logger.error(`Error in delete subscriptions:: ${JSON.stringify(error)}`);
        throw Error(`Error while deleting subscriptions for artifact`);
      });
  }

  public async updateSubscription(
    subscriptionInput: SubscriptionInput[],
  ): Promise<Subscription[]> {
    const batchQueries = new Array();
    const response = new Array();
    for (const sub of subscriptionInput) {
      console.log('inside for loop')
      let result: cassandra.types.ResultSet;
      
      try {
        result = await cassandraDBHelpers.execute(srq.selectSubscriptionQuery,
          srq.subscriptionInputPKeyValues(sub));
          console.log('result',result)
          console.log('srq', srq.selectSubscriptionQuery)
      } catch (err) {
        logger.error(`Error while retrieving subscriptions from database for ${JSON.stringify(sub)}`);
        throw new Error(
          `Error while retrieving Subscription from database ${JSON.stringify(sub)}`,
        );
      }
      const row = result.first();
      if (row === null) {
        logger.error('Error in updateSubscription. Empty result set');
        throw new NotFound(
          `Subscription ${JSON.stringify(sub)} not found`,
        );
      }
      const subscription = srq.rowToSubscription(row);
      const updatedSubscription: Subscription = {
        ...subscription,
        artifact: sub.artifact,
        channelSettings: sub.channelSettings,
        role: sub.role,
        subscriptionType: sub.subscriptionType,
        updatedDate: new Date(),
      };
      batchQueries.push({
        query: srq.updateArtifactQuery,
        params: srq.updateSubscriptionToDbParams(updatedSubscription),
      });
      response.push(updatedSubscription);
    }
    logger.info(`Performing Batch update for subscriptions :: ${JSON.stringify(response)}`);
    return cassandraDBHelpers.batch(batchQueries).then((_: cassandra.types.ResultSet) => {
      logger.info(`Bulk subscriptions updated successfully`);
      return response;
    }).catch((error) => {
      logger.error(`Error while bulk subscriptions update:: ${JSON.stringify(error)}`);
      throw Error(`Error while bulk subscriptions update`);
    });
  }

  public async subscribe(subscriptionInput: SubscriptionInput, userId: string): Promise<Subscription> {
    const batchQueries = new Array();
    let subscription: Subscription;
    try {
      subscription = srq.getSubscriptionInstance(subscriptionInput, userId);
      console.log('subscription',subscription)
      const artifactIdElement = srq.artifactToArtifactIdElement(subscription.artifact);
      const artifactId: ArtifactId = {
        elements: artifactIdElement,
      };
      const subList: Subscription[] = await this.getSubscriptionByIds(subscription.appId,
        [State.ACTIVE, State.INACTIVE], [artifactId], userId);
      if (subList.length > 0) {
        logger.debug(`Record found for user :: ${userId} :: for artifact ${JSON.stringify(artifactIdElement)} ::
        and size :: ${subList.length}`);
        for (const sub of subList) {
          if (sub.state === State.ACTIVE) {
            logger.debug(`User is an existing subscriber to the artifact`);
            return sub;
          }
          const artifactElement = srq.artifactToArtifactIdElement(sub.artifact);
          const subscriptionIdent: SubscriptionId = srq.subscriptionIdDbParams(sub.appId,
            artifactElement, sub.userId, sub.state);
          batchQueries.push({
            query: srq.deleteSubscriptionQuery,
            params: srq.subscriptionIdPKeyValues(subscriptionIdent),
          },
            {
              query: srq.deleteUserSubscriptionQuery,
              params: srq.subscriptionIdPKeyValues(subscriptionIdent),
              
            });
            
        }
      }
      batchQueries.push({
        query: srq.insertUserSubscriptionQuery,
        params: srq.userSubscriptionToDbParams(subscription, artifactIdElement),
        
      },
        {
          query: srq.insertSubscriptionQuery,
          params: srq.subscriptionToDbParams(subscription, artifactIdElement),
          
          
        });
        console.log('query', srq.insertSubscriptionQuery)

        console.log('++++++++++++++++++++++++++++++++');
        console.log('query', srq.insertUserSubscriptionQuery)

    } catch (error) {
      logger.error(`Error while forming subscription: ${JSON.stringify(error)}`);
      throw Error(`Error during formation of subscription`);
    }
    logger.debug(`Batch Queries are :: ${JSON.stringify(batchQueries)}`);
    return cassandraDBHelpers.batch(batchQueries).then((_: cassandra.types.ResultSet) => {
      logger.info(`User successfully subscribed for artifact`);
      return subscription;
    }).catch((error) => {
      logger.error(`Error while subscribing:: ${JSON.stringify(error)}`);
      throw Error(`Error while subscribing for artifact`);
    });
  }

  public async subscribeUsers(input: SubscriptionUsersInput): Promise<Subscription[]> {
    validateAppId(input.appId);
    if (input.userIds.length === 0) {
      return [];
    }
    const artifactIdElement = srq.artifactToArtifactIdElement(input.artifact);
    const artifactId: ArtifactId = {
      elements: artifactIdElement,
    };
    const subsByUser: { [userId: string]: Subscription[] } = await this.getSubscriptionsByUserIds(
      input.appId, [State.ACTIVE, State.INACTIVE], [artifactId], input.userIds);
    const batchQueries = new Array();
    const subscriptions: Subscription[] = new Array();
    for_userId: for (const userId of input.userIds) {
      try {
        const subList: Subscription[] = subsByUser[userId];
        if (subList && subList.length > 0) {
          logger.debug(`Subscriptions for user ${userId} and artifact ${JSON.stringify(artifactIdElement)} exist (count: ${subList.length}).`);
          for (const sub of subList) {
            if (sub.state === State.ACTIVE) {
              logger.debug(`User is an active subscriber to the artifact.`);
              subscriptions.push(sub);
              continue for_userId;
            }
            const artifactElement = srq.artifactToArtifactIdElement(sub.artifact);
            const subscriptionIdent: SubscriptionId = srq.subscriptionIdDbParams(sub.appId,
              artifactElement, sub.userId, sub.state);
            batchQueries.push({
              query: srq.deleteSubscriptionQuery,
              params: srq.subscriptionIdPKeyValues(subscriptionIdent),
            },
              {
                query: srq.deleteUserSubscriptionQuery,
                params: srq.subscriptionIdPKeyValues(subscriptionIdent),
              });
          }
        }
        const newSubscription: Subscription = srq.getSubscriptionFromSubscriptionUsersInput(
          input, userId);
        const newArtifactIdElement = srq.artifactToArtifactIdElement(newSubscription.artifact);
        batchQueries.push({
          query: srq.insertUserSubscriptionQuery,
          params: srq.userSubscriptionToDbParams(newSubscription, newArtifactIdElement),
        },
          {
            query: srq.insertSubscriptionQuery,
            params: srq.subscriptionToDbParams(newSubscription, newArtifactIdElement),
          });
        subscriptions.push(newSubscription);
      } catch (error) {
        logger.error(`Error while forming subscription: ${error}`);
        throw Error(`Error while forming subscription.`);
      }
    }
    logger.debug(`Batch Queries are ${JSON.stringify(batchQueries)}`);
    if (batchQueries.length === 0) {
      return subscriptions;
    }
    return cassandraDBHelpers.batch(batchQueries).then((_: cassandra.types.ResultSet) => {
      logger.info(`Users successfully subscribed for artifact.`);
      return subscriptions;
    }).catch((error) => {
      logger.error(`Error while subscribing users :: ${JSON.stringify(error)}`);
      throw Error(`Error while subscribing users for artifact.`);
    });
  }

  public async subscribeUsersWithSettings(
    input: SubscriptionUsersWithSettingsInput): Promise<Subscription[]> {
    validateAppId(input.appId);
    if (input.usersWithSettings.length === 0) {
      return [];
    }
    const artifactIdElement = srq.artifactToArtifactIdElement(input.artifact);
    const artifactId: ArtifactId = {
      elements: artifactIdElement,
    };
    const userIds: string[] = input.usersWithSettings.map(userData => userData.userId);
    const subsByUser: { [userId: string]: Subscription[] } = await this.getSubscriptionsByUserIds(
      input.appId, [State.ACTIVE, State.INACTIVE], [artifactId], userIds);
    const batchQueries = new Array();
    const subscriptions: Subscription[] = new Array();
    for_userSetting: for (const userData of input.usersWithSettings) {
      try {
        const subList: Subscription[] = subsByUser[userData.userId];
        if (subList && subList.length > 0) {
          logger.debug(`Subscriptions for user ${userData.userId} and artifact ${JSON.stringify(artifactIdElement)} exist (count: ${subList.length}).`);
          for (const sub of subList) {
            if (sub.state === State.ACTIVE) {
              logger.debug(`User is an active subscriber to the artifact.`);
              subscriptions.push(sub);
              continue for_userSetting;
            }
            const artifactElement = srq.artifactToArtifactIdElement(sub.artifact);
            const subscriptionIdent: SubscriptionId = srq.subscriptionIdDbParams(sub.appId,
              artifactElement, sub.userId, sub.state);
            batchQueries.push({
              query: srq.deleteSubscriptionQuery,
              params: srq.subscriptionIdPKeyValues(subscriptionIdent),
            },
              {
                query: srq.deleteUserSubscriptionQuery,
                params: srq.subscriptionIdPKeyValues(subscriptionIdent),
              });
          }
        }
        const newSubscription: Subscription = srq.getSubscriptionFromSubscriptionUsersWithSettingsInput(
          input, userData);
        const newArtifactIdElement = srq.artifactToArtifactIdElement(newSubscription.artifact);
        batchQueries.push({
          query: srq.insertUserSubscriptionQuery,
          params: srq.userSubscriptionToDbParams(newSubscription, newArtifactIdElement),
        },
          {
            query: srq.insertSubscriptionQuery,
            params: srq.subscriptionToDbParams(newSubscription, newArtifactIdElement),
          });
        subscriptions.push(newSubscription);
      } catch (error) {
        logger.error(`Error while forming subscription: ${error}`);
        throw Error(`Error while forming subscription.`);
      }
    }
    logger.debug(`Batch Queries are ${JSON.stringify(batchQueries)}`);
    if (batchQueries.length === 0) {
      return subscriptions;
    }
    return cassandraDBHelpers.batch(batchQueries).then((_: cassandra.types.ResultSet) => {
      logger.info(`Users successfully subscribed for artifact.`);
      return subscriptions;
    }).catch((error) => {
      logger.error(`Error while subscribing users :: ${JSON.stringify(error)}`);
      throw Error(`Error while subscribing users for artifact.`);
    });
  }

  public async unsubscribe(
    subscriptionIdentifier: SubscriptionId,
  ): Promise<SubscriptionId> {

    return Promise.all([
      cassandraDBHelpers.execute(srq.selectSubscriptionJsonQuery,
        srq.subscriptionIdPKeyValues(subscriptionIdentifier)),
      cassandraDBHelpers.execute(srq.selectUserSubscriptionJsonQuery,
        srq.subscriptionIdPKeyValues(subscriptionIdentifier)),
    ]).then(async (results: cassandra.types.ResultSet[]) => {

      const subscriptionsJson = results[0].first();
      const userSubscriptionsJson = results[1].first();

      if (subscriptionsJson === null || userSubscriptionsJson === null) {
        logger.error('Unable to unsubscribe. Subscription does not exist.');
        throw new NotFound(`Unable to unsubscribe,
          subscription with identifier:
          ${JSON.stringify(subscriptionIdentifier)} not found `);
      }

      const subscriptions = JSON.parse(subscriptionsJson['[json]']);
      subscriptions['state'] = State.INACTIVE;
      const userSubscriptions = JSON.parse(userSubscriptionsJson['[json]']);
      userSubscriptions['state'] = State.INACTIVE;
      logger.debug(`Unsubscription record :: ${JSON.stringify(subscriptions)}`);
      return cassandraDBHelpers.batch([
        {
          query: srq.deleteSubscriptionQuery,
          params: srq.subscriptionIdPKeyValues(subscriptionIdentifier),
        },
        {
          query: srq.deleteUserSubscriptionQuery,
          params: srq.subscriptionIdPKeyValues(subscriptionIdentifier),
        },
        {
          query: `insert into subscriptions JSON ?`,
          params: [JSON.stringify(subscriptions)],
        },
        {
          query: `insert into user_subscriptions JSON ?`,
          params: [JSON.stringify(userSubscriptions)],
        },
      ], { prepare: true }).then((_: cassandra.types.ResultSet) => {
        logger.info(`User unsubscribed successfully`);
        return srq.subscriptionIdDbParams(userSubscriptions.app_id, userSubscriptions.artifact_id,
          userSubscriptions.user_id, userSubscriptions.state);
      });
    });
  }

  public async getSubscriptionByIds(
    appId: string,
    states: State[],
    artifactIds: ArtifactId[],
    userId?: string,
  ): Promise<Subscription[]> {
    validateAppId(appId);
    logger.info('Querying subscriptions by Artifact Ids');
    const params = srq.getSubscriptionKeyValues(toLower(appId), states, artifactIds);
    let query = srq.selectSubscriptionsByIdsQuery;
    if (userId) {
      params.push(toUpper(userId));
      query += ` and user_id = ?`;
    }
    logger.debug(`Reading Subscriptions by Artifact Ids with Query as: ${query}`);
    return cassandraDBHelpers.execute(query,
      params, { prepare: true }).then((result: cassandra.types.ResultSet) => {
        logger.info(`Queried subscriptions for the Artifact:: { ${toLower(appId)}:
          ${states} : ${JSON.stringify(artifactIds)} }`);
        return result.rows.map(row => srq.rowToSubscription(row));
      }).catch((err) => {
        logger.error(`Error while querying subscriptions from getSubscriptionByIds method ${err}`);
        throw Error('Error while reading subscrptions');
      });
  }

  public async getPaginationResults(
    appId: string,
    states: State[],
    artifactIds: ArtifactId[],
    userId?: string,
    pageState?: string,
    fetchSize?: number,
  ): Promise<QueryResults> {
    validateAppId(appId);
    logger.info('Querying subscriptions by pagination');
    const params = srq.getSubscriptionKeyValues(toLower(appId), states, artifactIds);
    let query = srq.selectSubscriptionsByIdsQuery;
    if (userId) {
      params.push(toUpper(userId));
      query += ` and user_id = ?`;
    }
    logger.debug(`Reading Subscriptions by Artifact Ids with Query as: ${query}`);
    return cassandraDBHelpers.paginate(query,
      params, { prepare: true }, pageState, fetchSize).then((result: QueryResults) => {
        logger.info(`success`);
        return result;
      }).catch((err) => {
        logger.error(`${JSON.stringify(err)}`);
        logger.error(`Error while querying subscriptions from getPaginationResults method ${err}`);
        throw Error('Error while reading subscrptions');
      });
  }

  public async getAllArtifactIdCount(
    appId: string,
    artifactIds: ArtifactId[],
    userId?: string,
  ): Promise<any> {
    validateAppId(appId);
    const artifactlength: number = artifactIds[0].elements.length;
    let countOfRows: any;
    let userIdmatch: boolean = false;
    let query: string = srq.selectSubscriptionsForArtifactId;
    const queryForString: string = srq.subString;
    let queryForCount: string = srq.selectSubscriptionsForArtifactIdcount;
    const queryOFRoleFiltering: string = srq.queryForRole;
    let finalqueryForCount: string;
    let rolequery: string;
    let finalQueryForRole: string;

    for (let i = 0; i < artifactlength; i = i + 1) {
      const artiId: string = artifactIds[0].elements[i].id;
      const queryIntermediate: string = `and artifact_id CONTAINS {id: '${artiId}'} `;
      query = query.concat(queryIntermediate);
      queryForCount = queryForCount.concat(queryIntermediate);
    }
    rolequery = query.concat(queryOFRoleFiltering);
    finalQueryForRole = rolequery.concat(queryForString);
    finalqueryForCount = queryForCount.concat(queryForString);

    await cassandraDBHelpers.execute(finalqueryForCount,
      [toLower(appId)]).then((result: cassandra.types.ResultSet) => {
        countOfRows = result.rows[0].count.low;
      }).catch(() => {
        logger.info('Error In Count Fetch');
      });

    await cassandraDBHelpers.execute(finalQueryForRole,
      [toLower(appId), Role.AUTHOR]).then((result: cassandra.types.ResultSet) => {
        const lengthOfRow = result.rows.length;
        for (let i = 0; i < lengthOfRow; i += 1) {
          const resultartifactlength = result.rows[i].artifact_id.length;
          if (resultartifactlength === artifactlength) {
            userIdmatch = (result.rows[i].user_id === toUpper(userId)) ? true : false;
          }
        }

      }).catch((err) => {
        logger.info('Error In Role Fetch');
      });


    return { userIdmatch, countOfRows };
  }

  public async getAllArtifactId(
    appId: string,
    artifactIds: ArtifactId[],
    userId?: string,
  ): Promise<any> {
    validateAppId(appId);
    const artifactlength: number = artifactIds[0].elements.length;
    const arrForArtifactId: string[] = [];
    const arrForUserId: string[] = [];
    let query: string = srq.selectSubscriptionsForArtifactId;
    const queryForString: string = srq.subString;
    let finalquery: string;

    for (let i = 0; i < artifactlength; i = i + 1) {
      const artiId: string = artifactIds[0].elements[i].id;
      const queryIntermediate: string = `and artifact_id CONTAINS {id: '${artiId}'} `;
      query = query.concat(queryIntermediate);
    }
    finalquery = query.concat(queryForString);
    return cassandraDBHelpers.execute(finalquery,
      [toLower(appId)]).then(async (result: cassandra.types.ResultSet) => {
        const length = result.rows.length;
        for (let i = 0; i < length; i += 1) {

          arrForArtifactId.push(result.rows[i].artifact_id);
          arrForUserId.push(result.rows[i].user_id);
        }
        return { arrForArtifactId, arrForUserId };
      });
  }


  /**
   * This method returns the User subscriptions based on User Id & State. It accepts
   * an optional field 'role' , 'appId' and 'artifactIds' to allow filtering subscriptions
   * based on role, appId and artifactIds.
   * @param userId
   * @param states
   * @param role
   * @param appId
   * @param artifactIds
   */
  public async userSubscriptions(
    userId: string,
    states: State[],
    role?: string,
    appId?: string,
    artifactIds?: ArtifactId,
  ): Promise<any> {
    if (!userId) {
      throw new BadRequest('Badrequest. UserId is not provided.');
    }
    if (!artifactIds) {

      return cassandraDBHelpers.execute(srq.selectUserSubscriptionsByUserIdQuery,
        [toUpper(userId), states]).then(async (result: cassandra.types.ResultSet) => {
          const grouppedByAppId: Map<string, ArtifactId[]>
            = this.groupSubscriptionsByAppId(result);
          const qf = Array.from(grouppedByAppId.keys())
            .map((key: string) => {
              return this.getSubscriptionByIds(key, states,
                grouppedByAppId.get(key) as ArtifactId[], toUpper(userId));
            });
          return Promise.all(qf).then((results: Subscription[][]) => {
            let filteredResults: Subscription[][] = results;
            if (role) {
              logger.debug(`Filtering user subscriptions based on role for the user: ${toUpper(userId)}`);

              filteredResults = [];

              for (const subscriptionList of results) {
                const resulsFiltered: Subscription[] = subscriptionList.filter((subscription) => {
                  logger.debug(`Filtering subscriptions by Role: ${role}`);
                  if (subscription.role === role) {
                    logger.debug(`Found role match for the user: ${toUpper(userId)} with role: ${role}`);
                    return true;
                  }
                  return false;
                }, []);
                filteredResults.push(resulsFiltered);
              }
            }
            logger.debug(`Queried subscriptions for the user: ${toUpper(userId)}`);
            return filteredResults
              .reduce((acc, curr) => {
                return acc.concat(curr);
              }, []);
          });
        }).catch((err) => {
          logger.error(`Error wile reading userSubscriptions: ${err}`);
          throw Error('Error wile reading User subscriptions');
        });
    } if (artifactIds) {

      const artifact = artifactIds.elements;
      return cassandraDBHelpers.execute(srq.selectSubscriptionsForArtifactIdQuery,
        [toUpper(userId), states, appId, artifact], { prepare: true }).then((resultOfSubscriptionTable:
          cassandra.types.ResultSet) => {
          let res: any = resultOfSubscriptionTable.rows.map(row => srq.rowToSubscription(row));
          const resForRoleFilter = [res];
          if (role) {
            logger.debug(`Filtering user subscriptions based on role for the user: ${toUpper(userId)}`);
            res = [];
            for (const subscriptionList of resForRoleFilter) {
              const resulsFiltered: Subscription[] = subscriptionList.filter((subscription) => {
                logger.debug(`Filtering subscriptions by Role: ${role}`);
                if (subscription.role === role) {
                  logger.debug(`Found role match for the user: ${toUpper(userId)} with role: ${role}`);
                  return true;
                }
                return false;
              }, []);
              res.push(resulsFiltered);
            }
            return res[0];
          }
          return res;
        }).catch((err) => {
          logger.error(`Error while querying subscriptions from getSubscriptionByIds method ${err}`);
          throw Error('Error while reading subscrptions');
        });
    }
  }

  private groupSubscriptionsByAppId(
    result: cassandra.types.ResultSet,
  ): Map<string, ArtifactId[]> {
    return result.rows.reduce((acc, curr) => {
      let rows = acc.get(curr['app_id']);
      if (rows === undefined) {
        rows = [];
      }
      rows.push({ elements: curr['artifact_id'] });
      acc.set(curr['app_id'], rows);
      return acc;
    }, new Map<string, ArtifactId[]>());
  }

  private async getSubscriptionsByUserIds(
    appId: string,
    states: State[],
    artifactIds: ArtifactId[],
    userIds: string[],
  ): Promise<{ [userId: string]: Subscription[] }> {
    logger.info('Querying subscriptions by Artifact Ids for users');
    const params = srq.getSubscriptionKeyValues(toLower(appId), states, artifactIds);
    let query = srq.selectSubscriptionsByIdsQuery;
    const uIds: string[] = userIds.map(uId => toUpper(uId));
    params.push(uIds);
    query += ` and user_id in ?`;
    logger.debug(`Reading Subscriptions by Artifact Ids for users with Query as: ${query}`);
    return cassandraDBHelpers.execute(query,
      params, { prepare: true }).then((result: cassandra.types.ResultSet) => {
        logger.info(`Queried subscriptions for the Artifact and users:: { ${toLower(appId)} :
          ${states} : ${JSON.stringify(artifactIds)} : ${uIds}}`);
        const subscriptions: Subscription[] = result.rows.map(row => srq.rowToSubscription(row));
        const subscriptionsByUserIds: { [userId: string]: Subscription[] } = subscriptions.reduce((acc, s) => {
          acc[s.userId] = [...acc[s.userId] || [], s];
          return acc;
        }, {});
        return subscriptionsByUserIds;
      }).catch((err) => {
        logger.error(`Error while querying subscriptions from getSubscriptionsByUserIds method ${err}`);
        throw Error('Error while reading subscriptions');
      });
  }
}
 