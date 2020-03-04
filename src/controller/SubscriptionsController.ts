import { Response as SubscriptionResponse } from '@w3-notifications/shared-types';
import * as _ from 'lodash';
import { Next, Response } from 'restify';
import { logger } from '../logger';
import { IRequest } from '../middleware/IRequest';
import { ArtifactId } from '../models/ArtifactId';
import { State } from '../models/enums';
import { SubscriptionRepoCassandra } from '../repo/SubscriptionRepo';

const MAX_FETCH_SIZE: number = process.env.MAX_PAGINATED_RESULTS ?
Number.parseInt(process.env.MAX_PAGINATED_RESULTS, 10) : 20000;
const DEFAULT_FETCH_SIZE: number = 5000;
/**
 * This is the controller method to read subscriptons by Cassandra pagination.
 *
 * @param request
 * @param response
 * @param next
 */
export async function fetchSubscriptions(request: IRequest, response: Response, next: Next): Promise<Response> {
  try {
    const status: string = validateRequestParams(request, response);
    if (status === undefined) {
      const time: any = Date.now();
      const pageState: string = request.query['pageState'];
      const appId: string = request.query['appId'];
      const userId: string = request.query['userId'];
      const artifactId: string = request.query['artifactIds'];

      // Limit fetchsize when provied a higher value than the allowed limit
      let fetchSize: number = request.query['fetchSize'] ? request.query['fetchSize'] : DEFAULT_FETCH_SIZE;
      if (fetchSize > MAX_FETCH_SIZE) {
        fetchSize = MAX_FETCH_SIZE;
      }
      logger.debug(`Fetch size: ${fetchSize}`);
      const subscriptionRepo = new SubscriptionRepoCassandra();
      const elementArray: ArtifactId[] = [JSON.parse(artifactId)];
      const authenticatedUser: string | undefined = request.username ? _.toUpper(request.username) : request.username;

      // Return error if authenticated user is trying to read other person details.
      if (authenticatedUser && userId && authenticatedUser !== _.toUpper(userId)) {
        logger.warn(`Authenticated user is trying to read other person details.`);
        return response.send(403, { code: 403,
          message: `Forbidden: You are not allowed to read subscription details of others.` });
      }
      return subscriptionRepo.getPaginationResults(
            appId, [State.ACTIVE], elementArray, authenticatedUser || userId, pageState, fetchSize).then((result) => {
              const endTime: any = Date.now();
              const subsriptionResponse: SubscriptionResponse = { status: 'success', data: result };
              logger.info(`Total time to fetch subscriptions: ${endTime - time} ms`);
              return response.send(200, subsriptionResponse);
            }).catch((err) => {
              logger.error(`Error while fetching subscriptions(REST): ${JSON.stringify(err)}`);
              return response.send(500, { code: 500, message: 'Unable to fetch subscriptions' });
            });
    }
    return response.send(400, { code: 400, message: status });
  } catch (err) {
    return response.send(500, { code: 500, message: 'Unable to fetch subscriptions' });
  }
}

  /**
   * This method validates required mandatory parameters.
   *
   * @param req
   * @param res
   * @param next
   */
function validateRequestParams(request: IRequest, res: Response): any {
  const appId: string = request.query['appId'];
  const artifactId: string = request.query['artifactIds'];
  if (!appId || !artifactId) {
    return 'Missing required query params.';
  }
  try {
    const elementArray: ArtifactId[] = [JSON.parse(artifactId)];
    if (elementArray && elementArray.length > 0 && elementArray[0].elements.length === 0) {
      return 'Invalid artifactId value';
    }
  } catch (err) {
    return 'Invalid artifactId value';
  }
  return undefined;
}

