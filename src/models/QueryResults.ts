import { QueryResultParams as SharedQueryResultParams, QueryResults as SharedQueryResults } from '@w3-notifications/shared-types';
import { Subscription } from './Subscription';

export interface QueryResultParams extends SharedQueryResultParams {
  pageState?: string;
  subscriptions?: Subscription[];
  userSubscriptions?: Subscription[];
}

export class QueryResults implements SharedQueryResults {
  public pageState?: string;
  public subscriptions?: Subscription[];
  public userSubscriptions?: Subscription[];

  constructor(queryResultParams: QueryResultParams) {
    this.pageState = queryResultParams.pageState;
    this.subscriptions = queryResultParams.subscriptions;
    this.userSubscriptions = queryResultParams.userSubscriptions;
  }
} 