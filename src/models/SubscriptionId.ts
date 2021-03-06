import { SubscriptionId as SharedSubscriptionId } from '@w3-notifications/shared-types';
import { Field, InputType, ObjectType } from 'type-graphql';
import { ArtifactId } from './ArtifactId';

@InputType('SubscriptionIdInput')
@ObjectType()
export class SubscriptionId implements SharedSubscriptionId {
  @Field()
  public readonly appId: string;

  @Field(type => ArtifactId)
  public readonly artifactId: ArtifactId;

  @Field()
  public readonly userId: string;

  @Field(type => Number)
  public readonly state: number;

  constructor(appId: string, artifactId: ArtifactId, userId: string, state: number) {
    this.appId = appId;
    this.artifactId = artifactId;
    this.userId = userId;
    this.state = state;
  }
}
 