import { ArgumentValidationError } from 'type-graphql/errors';
import { logger } from '../logger';

// tslint:disable-next-line:typedef
export function customerror(error): Promise<Error> {

  const errormessage = error.message;
  const firstword = errormessage.split(' ', 1);
  const text = firstword[0];

  if (error.originalError instanceof ArgumentValidationError) {
    error.validationErrors = error.originalError.validationErrors;
  }

  switch (text) {
    case 'Access':
    case 'Forbidden:':
      error.status = 403;
      error.type = 'Forbidden Request';
      return error;
    case 'Argument':
    case 'Cannot':
    case 'Field':
    case 'Unknown':
    case 'Variable':
      error.status = 400;
      error.type = 'Bad Request';
      return error;
    case 'Subscription':
      error.status = 404;
      error.type = 'Not Found';
      return error;
    case 'Syntax':
      error.status = 422;
      error.type = 'Syntax Error';
      return error;
    case 'Missing':
    case 'Invalid':
      error.status = 401;
      error.type = 'UnAuthorized Request';
      return error;
    case 'Unable':
      error.status = 404;
      error.type = 'Not Found';
      return error;
    default:
      error.status = 500;
      error.type = 'Internal Server Error';
      return error;
  }
}

