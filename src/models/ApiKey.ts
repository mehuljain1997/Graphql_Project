import { Field, ObjectType } from 'type-graphql';

@ObjectType()
export class ApiKey {
  @Field()
  public readonly appId: string;
  @Field()
  public readonly key: string;
  @Field()
  public readonly createdBy: string;
  @Field()
  public readonly createdDate: Date;
  @Field()
  public readonly updatedDate: Date;

  constructor(
    appId: string,
    key: string,
    createdBy: string,
    createdDate: Date,
    updatedDate: Date,
  ) {
    this.appId = appId;
    this.key = key;
    this.createdBy = createdBy;
    this.createdDate = createdDate;
    this.updatedDate = updatedDate;
  }
}
 