import { RouteOptions } from 'restify';

export interface IRouteOptions extends RouteOptions {
  authRequired?: boolean;
}
 