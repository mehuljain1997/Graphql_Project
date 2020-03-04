import { GqlError } from './GqlError';
export class BadRequest extends GqlError {
  constructor(message: string, params?: any) {
    super(400, message, params);
  }
}
