import { RequestAuthorization } from 'restify';

export interface IRequestAuthorization extends RequestAuthorization {
  token?: string;
} 