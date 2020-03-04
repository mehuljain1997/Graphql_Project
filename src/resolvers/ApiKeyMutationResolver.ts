import * as _ from 'lodash';
import { IRequest } from 'middleware/IRequest';
import { Arg, Ctx, Mutation, Resolver } from 'type-graphql';
import { AuthenticationMiddleware } from '../middleware/AuthenticationMiddleware';
import { ApiKeyRepo, ApiKeyRepoImpl } from '../repo/ApiKeyRepo';

@Resolver(of => String)
export class ApiKeyMutationResolver {

  private apiKeyRepo: ApiKeyRepo;

  constructor(apiKeyRepo: ApiKeyRepo) {
    // NOTE: dependency injection function does not work, for now
    // dependecy is hardcoded, we might need to employ custom DI with type-graphql
    this.apiKeyRepo = new ApiKeyRepoImpl();
  }

  @Mutation(returns => String!, {
    description: 'API key to access Subscription service (Read only access)',
    nullable: false,
  })
  public async apiKey(
    @Ctx('req')
    req: IRequest,
    @Arg('appId', type => String)
    appId: string,
  ): Promise<string> {
    const appKey = this.apiKeyRepo.createApiKey(appId, _.toUpper(req.username));
    return appKey;
  }

  @Mutation(returns => String!, {
    description: 'Update API key to access Subscription service (Read only access)',
    nullable: false,
  })
  public async updateApiKey(
    @Ctx('req')
    req: IRequest,
    @Arg('appId', type => String)
    appId: string,
  ): Promise<string> {
    const appKey = this.apiKeyRepo.updateApiKey(appId, _.toUpper(req.username));
    return appKey;
  }

  @Mutation(returns => String!, {
    description: 'Validates the Authorization header with the base64 encoded API key value',
    nullable: true,
  })
  public async validateApiKey(
    @Ctx('req')
    req: IRequest,
  ): Promise<string> {
    return AuthenticationMiddleware.isValidApiKey(req);
  }
}
