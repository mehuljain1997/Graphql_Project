import { Request } from 'restify';

import { IRequestAuthorization } from './IRequestAuthorization';

export interface IRequest extends Request {
  authorization: IRequestAuthorization;
}
