import * as _ from 'lodash';
import { IRequest } from 'middleware/IRequest';
import { Arg, Ctx, Query, Resolver } from 'type-graphql';
import { logger } from '../logger';
import { ApiKey } from '../models/ApiKey';
import { ApiKeyRepo, ApiKeyRepoImpl } from '../repo/ApiKeyRepo';

@Resolver(of => String)
export class ApiKeyQueryResolver {

  private apiKeyRepo: ApiKeyRepo;

  constructor(apiKeyRepo: ApiKeyRepo) {
    // NOTE: dependency injection function does not work, for now
    // dependecy is hardcoded, we might need to employ custom DI with type-graphql
    this.apiKeyRepo = new ApiKeyRepoImpl();
  }

  @Query(returns => ApiKey!, {
    description: 'Read API key to access Subscription service',
    nullable: false,
  })
  public async getApiKey(
    @Ctx('req')
    req: IRequest,
    @Arg('appId', type => String)
    appId: string,
  ): Promise<ApiKey> {
    return this.apiKeyRepo.getApiKey(appId);
  }
}
