import { Subscription as SharedSubscription } from '@w3-notifications/shared-types';
import { Field, ObjectType } from 'type-graphql';
import { Artifact } from './Artifact';
import { ChannelSettings } from './ChannelSettings';
import { Role, State } from './enums';

@ObjectType()
export class Subscription implements SharedSubscription {
  @Field()
  public readonly appId: string;
  @Field(type => Artifact)
  public readonly artifact: Artifact;
  @Field(type => ChannelSettings)
  public readonly channelSettings: ChannelSettings;
  @Field()
  public readonly userId: string;
  @Field(type => Role)
  public readonly role: Role;
  @Field(type => State)
  public readonly state: State;
  @Field()
  public readonly createdDate: Date;
  @Field()
  public readonly updatedDate: Date;
  @Field()
  public readonly subscriptionType: string;

  constructor(
    appId: string,
    artifact: Artifact,
    channelSettings: ChannelSettings,
    userId: string,
    role: Role,
    state: State,
    createdDate: Date,
    updatedDate: Date,
    subscriptionType: string,
  ) {
    this.appId = appId;
    this.artifact = artifact;
    this.channelSettings = channelSettings;
    this.role = role;
    this.userId = userId;
    this.state = state;
    this.createdDate = createdDate;
    this.updatedDate = updatedDate;
    this.subscriptionType = subscriptionType;
  }

}
 