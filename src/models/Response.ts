import { Response as SharedResponse, ResponseParams as SharedResponseParams } from '@w3-notifications/shared-types';
import { QueryResults } from './QueryResults';

export interface ResponseParams extends SharedResponseParams {
  status: string; // success | error
  data: QueryResults;
  message?: string;
}

export class Response implements SharedResponse {
  public status: string;
  public data: QueryResults;
  public message?: string;

  constructor(responseParams: ResponseParams) {
    this.status = responseParams.status;
    this.data = responseParams.data;
    this.message = responseParams.message;
  }
} 