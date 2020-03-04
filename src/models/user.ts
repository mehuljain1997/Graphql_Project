import { User as SharedUser } from '@w3-notifications/shared-types';
import { ObjectType } from 'type-graphql';
@ObjectType()
export class User implements SharedUser {
  public readonly uid: string;
  public readonly email: string;
  public readonly name: string;
}