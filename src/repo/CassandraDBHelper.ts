import { QueryResults } from '@w3-notifications/shared-types';
import cassandraClient from '@w3-rre/cassandra-client';
import * as cassandra from 'cassandra-driver';
import * as dotenv from 'dotenv';
import * as _ from 'lodash';
import { Observable } from 'rxjs';
import * as rx from 'rxjs-stream';
import { map } from 'rxjs/operators';
import { Subscription } from '../models/Subscription';
import * as srq from '../repo/SubscriptionRepoQueries';

dotenv.config();
cassandraClient.initialize();

export async function single(
  query: string,
  whereValues?: any[],
  options?: cassandra.QueryOptions,
): Promise<cassandra.types.Row> {
  return new Promise((resolve: (row: cassandra.types.Row) => void, reject: (err: Error) => void): void => {
    const queryOptions = _.merge({
      prepare: true,
      consistency: cassandra.types.consistencies.localQuorum,
    }, options);

    cassandraClient.client.execute(query, whereValues, queryOptions,
      (err: Error, result: cassandra.types.ResultSet) => {
        if (err) {
          reject(err);
        } else {
          const row: cassandra.types.Row | null = result.first();
          if (row === undefined || row === null) {
            resolve(row as any as cassandra.types.Row);
          } else if (row !== null) {
            resolve(row);
          }
        }
      });
  });
}

export function stream(query: string, whereValues?: any[]): Observable<cassandra.types.Row> {
  const queryOptions = {
    prepare: true,
    consistency: cassandra.types.consistencies.localQuorum,
  };

  const cassandraStream = cassandraClient.client.stream(query, whereValues, queryOptions);
  const obs = rx.streamToRx(cassandraStream);
  return obs.pipe(map((row) => {
    return row as any as cassandra.types.Row;
  }));
}

export async function batch(queries: any[], options?: cassandra.QueryOptions): Promise<cassandra.types.ResultSet> {
  const queryOptions = _.merge({
    prepare: true,
    consistency: cassandra.types.consistencies.localQuorum,
  }, options);

  return cassandraClient.client.batch(queries, queryOptions);
}

export async function shutdown(): Promise<void> {
  return cassandraClient.client.shutdown();
}

export async function execute(
  query: string,
  params?: any[],
  options?: cassandra.QueryOptions,
): Promise<cassandra.types.ResultSet> {
  const queryOptions = _.merge({
    prepare: true,
    consistency: cassandra.types.consistencies.localQuorum,
  }, options);
  return cassandraClient.client.execute(query, params, queryOptions);
}

export async function paginate(
  query: string,
  params?: any[],
  options?: cassandra.QueryOptions,
  pageState?: string,
  fetchSize?: number,
): Promise<QueryResults> {
  const queryOptions = _.merge({
    prepare: true,
    consistency: cassandra.types.consistencies.localQuorum,
  }, options);
  // tslint:disable
  if (pageState) {
    queryOptions.pageState = pageState;
  } else {
    delete queryOptions.pageState;
  }
  queryOptions.fetchSize = fetchSize;
  let queryResults: QueryResults = {};
  let subscriptionArray: Subscription[] = [];
  return new Promise<any>(async (resolve, reject): Promise<any> => {
    await cassandraClient.client.eachRow(query, params, queryOptions, (n, result) => {
      const value: Subscription = srq.rowToSubscription(result);
      subscriptionArray.push(value);
    }, (err, result) => {
      if (err) {
        reject(err);
      } else {
        queryResults.subscriptions = subscriptionArray;
        queryResults.pageState = result.pageState;
        resolve(queryResults);
      }
    });
  })
}

export const cassandraDBHelpers = {
  batch,
  execute,
  single,
  stream,
  shutdown,
  paginate,
};
