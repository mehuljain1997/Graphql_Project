import { GqlError } from './GqlError';
export class Unauthenticated extends GqlError {
  constructor(message: string, params?: any) {
    super(401, message, params);
  }
}
