import { isEmpty, toUpper } from 'lodash';
import { IRequest } from 'middleware/IRequest';
import 'reflect-metadata';
import { Arg, Ctx, Mutation, Resolver } from 'type-graphql';
import { logger } from '../logger';
import { ArtifactId } from '../models/ArtifactId';
import { State } from '../models/enums';
import { Subscription } from '../models/Subscription';
import { SubscriptionId } from '../models/SubscriptionId';
import { SubscriptionInput } from '../models/SubscriptionInput';
import { SubscriptionUsersInput } from '../models/SubscriptionUsersInput';
import { SubscriptionUsersWithSettingsInput } from '../models/SubscriptionUsersWithSettingsInput';
import { SubscriptionRepo, SubscriptionRepoCassandra } from '../repo/SubscriptionRepo';
import { authenticatedUserId, checkSubscriptionOwner, validateArtifact } from './commons';
import { customerror } from './constant';
import { NotFound } from './exceptions/NotFound';


@Resolver(of => Subscription)
export class SubscriptionMutationResolver {

  private subscriptionRepo: SubscriptionRepo;

  constructor(subscriptionRepo: SubscriptionRepo) {
    // NOTE: dependency injection function does not work, for now
    // dependecy is hardcoded, we might need to employ custom DI with type-graphql
    this.subscriptionRepo = new SubscriptionRepoCassandra();
  }

  @Mutation(returns => SubscriptionId!, {
    description: 'mark a subscription as inactive to supress notification delivery',
    nullable: false,
  })
  public async unsubscribe(
    @Ctx('req')
    req: IRequest,

    @Arg('subscriptionId', type => SubscriptionId)
    subscriptionId: SubscriptionId,
  ): Promise<SubscriptionId> {
    checkSubscriptionOwner(req, subscriptionId.userId);
    return this.subscriptionRepo.unsubscribe(subscriptionId);
  }

  @Mutation(returns => String!, {
    description: 'allows the owner to delete all subscriptions of the given artifact',
    nullable: false,
  })
  public async delete(
    @Ctx('req')
    req: IRequest,
    @Arg('appId', type => String)
    appId: string,
    @Arg('artifactIds', type => ArtifactId)
    artifactIds: ArtifactId,
    @Arg('userId', type => String, { nullable: true })
    userId?: string,
  ): Promise<any> {
    try {
      logger.debug(`appId:: ${appId}, userId:: ${userId}, artifactIds:: ${JSON.stringify(artifactIds)}`);
      logger.info(`Delete request for appId:: ${appId}, artifactIds:: ${JSON.stringify(artifactIds)}`);
      const authenticatedUser: string = authenticatedUserId(req);
      if (userId) {
        checkSubscriptionOwner(req, userId);
      }
      const subscription: Subscription[] = await this.subscriptionRepo.getSubscriptionByIds(appId,
        [State.ACTIVE], [artifactIds], userId || toUpper(authenticatedUser));
      if (isEmpty(subscription)) {
        logger.debug(`Subscription record Not Found for user ::${userId} :: artifact ::${JSON.stringify(artifactIds)}`);
        throw new NotFound(`Subscription record Not Found for artifact:
        ${JSON.stringify(artifactIds)}`, { code: 404, message: `Record Not Found` });
      }
      for (const sub of subscription) {
        if (sub.role === 'AUTHOR') {
          return this.subscriptionRepo.delete(appId, artifactIds, [State.ACTIVE, State.INACTIVE]);
          // tslint:disable-next-line:no-else-after-return
        } else {
          const err = new Error('Forbidden: You are not allowed to perform this action');
          return customerror(err);
        }
      }
    } catch (error) {
      logger.error(`Error: ${error}`);
      throw error;
    }
  }

  @Mutation(returns => String!, {
    description: 'allow the owner to cascade delete all subscriptions under the given artifact',
    nullable: false,
  })
  public async deleteCascade(
    @Ctx('req')
    req: IRequest,
    @Arg('appId', type => String)
    appId: string,
    @Arg('artifactIds', type => ArtifactId)
    artifactIds: ArtifactId,
    @Arg('userId', type => String, { nullable: true })
    userId?: string,
  ): Promise<any> {
    try {
      // tslint:disable-next-line: max-line-length
      logger.debug(`DeleteCascade request submitted for appId:: ${appId}, userId:: ${userId},artifactId:: ${JSON.stringify(artifactIds)}`);
      logger.info(`DeleteCascade request for appId:: ${appId} :: artifactId:: ${JSON.stringify(artifactIds)}`);
      const authenticatedUser: string = authenticatedUserId(req);
      if (userId) {
        checkSubscriptionOwner(req, userId);
      }
      const record: any = await this.subscriptionRepo.getAllArtifactIdCount(appId,
        [artifactIds], userId || toUpper(authenticatedUser));
      if (record.countOfRows === 0) {
        logger.info(`Subscription record Not Found for appId ::${appId} :: artifact ::${JSON.stringify(artifactIds)}`);
        const err = new Error(`Subscription record Not Found For artifact::${JSON.stringify(artifactIds)}`);
        return customerror(err);
      }
      if (record.userIdmatch === false) {
        const err = new Error('Forbidden: You are not allowed to perform this action');
        return customerror(err);
      }


      const count: number = record.countOfRows;
      let counter: number = 1;
      if (count > 5000) {
        counter = count / 5000;
        const countmod: number = count % 5000;
        if (countmod > 0) {
          counter = counter + 1;
        }
      }
      let finalCount: number = Math.ceil(counter);
      while (finalCount > 0) {
        const artifactRecord: any = await this.subscriptionRepo.getAllArtifactId(appId,
          [artifactIds], userId || toUpper(authenticatedUser));
        await this.subscriptionRepo.deleteCascade(appId, artifactRecord.arrForArtifactId,
          artifactRecord.arrForUserId, [State.ACTIVE, State.INACTIVE])
          .then(() => {
            logger.info(`CascadeDelete Successfully Completed.`);
            return 'Successfully deleted';
          }).catch(() => {
            throw Error(`Error while deleting subscriptions for artifact`);
          });
        finalCount -= 1;
      }
      return 'Successfully deleted';
    } catch (error) {
      logger.error(`Error: ${error}`);
      throw error;
    }
  }

  @Mutation(returns => Subscription!, {
    description: 'create a subscription for the given user and artifact',
    nullable: false,
  })
  public async subscribe(
    @Ctx('req')
    req: IRequest,
    @Arg('subscriptionInput', type => SubscriptionInput)
    subscriptionInput: SubscriptionInput,
  ): Promise<Subscription> {
    checkSubscriptionOwner(req, subscriptionInput.userId);
    validateArtifact(subscriptionInput);
    return this.subscriptionRepo.subscribe(subscriptionInput,
      subscriptionInput.userId);
  }

  @Mutation(returns => [Subscription], {
    description: 'update subscription',
    nullable: false,
  })
  public async updateSubscription(
    @Ctx('req')
    req: IRequest,
    @Arg('subscriptionInput', type => [SubscriptionInput])
    subscriptionInput: SubscriptionInput[],
  ): Promise<Subscription[]> {
    // tslint:disable-next-line: ter-arrow-parens
    subscriptionInput.forEach(sub => {
      checkSubscriptionOwner(req, sub.userId);
      validateArtifact(sub);
    });
    return this.subscriptionRepo.updateSubscription(
      subscriptionInput,
    );
  }

  @Mutation(returns => [Subscription]!, {
    description: 'Creates one subscription per each user from the given list (subscriptionUsersInput.userIds). All users have the same settings (role, channelSettings). Subscriptions are just created (like with subscribe method), not updated (like with updateSubscriptions method). Limit for number of users is 50.',
    nullable: false,
  })
  public async subscribeUsers(
    @Ctx('req')
    req: IRequest,
    @Arg('subscriptionUsersInput', type => SubscriptionUsersInput)
    subscriptionUsersInput: SubscriptionUsersInput,
  ): Promise<Subscription[]> {
    return this.subscriptionRepo.subscribeUsers(subscriptionUsersInput);
  }

  @Mutation(returns => [Subscription]!, {
    description: 'Creates one subscription per each user from the given list (subscribeUsersWithSettings.usersWithSettings). The method differs from subscribeUsers - different users can have different settings (role, channelSettings). Subscriptions are just created (like with subscribe method), not updated (like with updateSubscriptions method). Limit for number of users is 50.',
    nullable: false,
  })
  public async subscribeUsersWithSettings(
    @Ctx('req')
    req: IRequest,
    @Arg('subscriptionUsersWithSettingsInput', type => SubscriptionUsersWithSettingsInput)
    subscriptionUsersWithSettingsInput: SubscriptionUsersWithSettingsInput,
  ): Promise<Subscription[]> {
    return this.subscriptionRepo.subscribeUsersWithSettings(subscriptionUsersWithSettingsInput);
  }
}
