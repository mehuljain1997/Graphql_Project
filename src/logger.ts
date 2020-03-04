import appRootPath from 'app-root-path';
import * as winston from 'winston';
// import { settings } from './config/config';

export const logger: winston.Logger = winston.createLogger({
  level: settings.logLevel,
  exitOnError: false,
  transports: [
    new winston.transports.Console({
      format: winston.format.json(),
      silent: process.argv.indexOf('--silent') >= 0,
    }),
    new winston.transports.File({ filename: `${appRootPath}/subscription-service.log` }),
  ],
});