import { GqlError } from './GqlError';
export class NotFound extends GqlError {
  constructor(message: string, params?: any) {
    super(404, message, params);
  }
}