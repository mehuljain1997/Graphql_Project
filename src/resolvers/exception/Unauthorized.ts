import { GqlError } from './GqlError';
export class Unauthorized extends GqlError {
  constructor(message: string, params?: any) {
    super(403, message, params);
  }
}