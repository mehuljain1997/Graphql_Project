import { isEmpty } from 'lodash';
import 'reflect-metadata';
import { Arg, Ctx, Query, Resolver } from 'type-graphql';
import { logger } from '../logger';
import { AuthenticationMiddleware } from '../middleware/AuthenticationMiddleware';
import { IRequest } from '../middleware/IRequest';
import { ArtifactId } from '../models/ArtifactId';
import { Role, State } from '../models/enums';
import { Subscription } from '../models/Subscription';
import { SubscriptionRepo, SubscriptionRepoCassandra } from '../repo/SubscriptionRepo';
import { authenticatedUserId, checkSubscriptionOwner, getAuthenticationPolicy } from './commons';

@Resolver(of => Subscription)
export class SubscriptionResolver {

  private subscriptionRepo: SubscriptionRepo;

  constructor(subscriptionRepo: SubscriptionRepo) {
    // NOTE: dependency injection function does not work, for now
    // dependecy is hardcoded, we might need to employ custom DI with type-graphql
    this.subscriptionRepo = new SubscriptionRepoCassandra();
  }

  @Query(returns => [Subscription!], {
    description: 'get all subscriptions for a given user ordered by date descending',
    nullable: false,
  })
  public async userSubscriptions(
    @Ctx('req')
    req: IRequest,
    @Arg('userId', type => String, {
      nullable: true})
    userId?: string,
  @Arg('role', type => Role, {
    nullable: true})
    role?: string,
    @Arg('appId', type => String, {
      nullable: true})
    appId?: string,
    @Arg('artifactIds', type => ArtifactId, {
      nullable: true})
    artifactIds?: ArtifactId,
  ): Promise<Subscription[]> {
    const authenticatedUser: string = this.findAuthenticatedUserId(req, userId);
    return this.subscriptionRepo.userSubscriptions(
      userId || authenticatedUser,
      [State.ACTIVE], role, appId, artifactIds,
    );
  }


  @Query(returns => [Subscription!], {
    description: 'get all subscriptions for a given artifact',
    nullable: false,
  })
  public async subscriptions(
    @Arg('appId', type => String)
    appId: string,
    @Arg('artifactIds', type => ArtifactId)
    artifactIds: ArtifactId,
    @Arg('states', type => State, {
      nullable: true,
      description: 'If no states are privded active subscriptions will be listed',
    })
    states: State[] = [State.ACTIVE],
    @Ctx('req')
    req: IRequest,
    @Arg('userId', type => String, {
      nullable: true})
    userId?: string,
  ): Promise<Subscription[]> {
    const authenticatedUser: string = this.findAuthenticatedUserId(req, userId);
    return this.subscriptionRepo.getSubscriptionByIds(
      appId, states, [artifactIds], userId || authenticatedUser);
  }

  @Query(returns => [Subscription!], {
    description: 'get all subscriptions for a given list of artifacts',
    nullable: false,
  })
public async subscriptionsWithListOfArtifacts(   
  @Arg('appId', type => String)
  appId: string,
  @Arg('artifactIds', type => [ArtifactId])
  artifactIds: ArtifactId[],
  @Arg('states', type => State, {
    nullable: true,
    description: 'If no states are provided active subscriptions will be listed',
  })
  states: State[] = [State.ACTIVE],
  @Ctx('req')
  req: IRequest,
  @Arg('userId', type => String, {
    nullable: true})
  userId?: string,
): Promise<Subscription[]> {

    const authenticatedUser: string = await this.findAuthenticatedUserId(req, userId);
    let subscriptionRecords: Subscription[] = [];
    if (isEmpty(authenticatedUser)) {

      subscriptionRecords = await this.subscriptionRepo.getSubscriptionByIds(
        appId, states, artifactIds);
      return subscriptionRecords;
    }
    subscriptionRecords  = await this.subscriptionRepo.getSubscriptionByIds(
      appId, states, artifactIds, userId || authenticatedUser);

    return subscriptionRecords;
  }

  /**
   * This method returns the authenticated user Id. If authenticated by API key it return empty
   *
   * @param req
   * @param userId
   */
  private findAuthenticatedUserId(req: IRequest, userId?: string): string {
    const authPolicy: string = getAuthenticationPolicy(req);
    let authenticatedUser: string = '';
    if (authPolicy === AuthenticationMiddleware.AUTH_POLICY_BEARER) {
      authenticatedUser = authenticatedUserId(req);
      if (userId) {
        logger.info(`Checking if user is authorized to query subscriptions...`);
        checkSubscriptionOwner(req, userId);
      }
    }
    return authenticatedUser;
  }

}
 