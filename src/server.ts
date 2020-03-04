// tslint:disable:ordered-imports
import './tracer';
import { IRequest } from './middleware/IRequest';
import { graphiqlRestify, graphqlRestify } from 'apollo-server-restify';
import { GraphQLSchema } from 'graphql';
import 'reflect-metadata';
import { createServer, Next, plugins, Request, Response } from 'restify';
import { buildSchema } from 'type-graphql';
import { settings } from './config/config';
import { logger } from './logger';
import { customerror } from './resolvers/constant';
import { AuthenticationMiddleware } from './middleware/AuthenticationMiddleware';
import { defaultSubscriptionMutationResolverFactory, defaultSubscriptionResolverFactory, apiKeyResolverFactory, apiKeyQueryResolverFactory } from './resolvers/commons';
import { fetchSubscriptions } from './controller/SubscriptionsController';

const corsMiddleware = require('restify-cors-middleware'); // tslint:disable-line

const cors = corsMiddleware({
  preflightMaxAge: 5,
  credentials: true,
  origins: [/^https?:\/\/localhost(:[\d]+)?$/,
    /^https?:\/\/.+\.ibm\.com$/, /^https?:\/\/.+\.ibm\.com(:[\d]+)$/],
  allowHeaders: ['X-Requested-With', 'Accept-Language',
    'Content-Language', 'Last-Event-ID',
    'X-HTTP-Method-Override', 'access-control-allow-origin',
    'withcredentials', 'Origin', 'Authorization',
    'Content-Type', 'Accept', 'Accept-Encoding',
    'Access-Control-Allow-Credentials',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers', 'X-Up-Token'],
  exposeHeaders: ['API-Token-Expiry', 'Access-Control-Allow-Credentials'],
});


export async function startServer(): Promise<void> {
  const server = createServer({
    name: 'Apollo Server',
  });

  try {
    logger.info('Initializing Service.');
    server.acceptable.push('Service/x-protobuf');
    server.use(plugins.acceptParser(server.acceptable));
    server.use(plugins.bodyParser());
    server.use(plugins.queryParser());

    server.pre(cors.preflight);
    server.use(cors.actual);

    const graphqlSchema: GraphQLSchema = await schema();
    const isProductionEnv = process.env.NODE_ENV === 'production' ? true : false;

    // add routes here
    server.get(AuthenticationMiddleware.healthCheckPath, healthPing);
    server.get(AuthenticationMiddleware.subscriptionsPath,
      AuthenticationMiddleware.checkPreAuthentication,
      AuthenticationMiddleware.checkAuthentication,
      fetchSubscriptions);
    server.post(

      /*graphql*/ AuthenticationMiddleware.graphQlPath,
      AuthenticationMiddleware.checkPreAuthentication,
      AuthenticationMiddleware.checkAuthentication,
      AuthenticationMiddleware.checkPostAuthentication,
      graphqlRestify(async (req: IRequest) => ({
        schema: graphqlSchema,
        // tslint:disable-next-line: typedef
        formatError: (err) => {
          return customerror(err);
        },
        // tslint:disable-next-line:typedef
        context: () => {
          return { req };
        },
      }),
      ),

    );

    // if (!isProductionEnv) {
    logger.info('Enabled graphiql.');
    server.get(AuthenticationMiddleware.graphQlUIPath,
      graphiqlRestify({ endpointURL: '/graphql' }));
    // }

    logger.info('Starting server.');
    server.listen(settings.apiPort, () => {
      const address =
        server.address().address === '::'
          ? 'localhost'
          : server.address().address;
      logger.info(`${server.name} version ${settings.apiVersion}
      GraphQL: http://${address}:${settings.apiPort}/graphql
      Graphiql: http://${address}:${settings.apiPort}/graphiql
      Health Check: http://${address}:${settings.apiPort}/health/ping`);
    });

  } catch (e) {
    logger.error(e);
  }
}

async function schema(): Promise<GraphQLSchema> {
  const s = await buildSchema({
    resolvers: [
      defaultSubscriptionResolverFactory,
      defaultSubscriptionMutationResolverFactory,
      apiKeyResolverFactory,
      apiKeyQueryResolverFactory,
    ],
    emitSchemaFile: true,
    validate: true,
  }).catch((e) => {
    logger.error(e);
    throw e;
  });

  return s;
}

function healthPing(request: Request, response: Response, next: Next): Next {
  response.send(200, 'OK');
  return next;
}

startServer();
