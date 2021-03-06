
import { SubscriptionInput as SharedSubscriptionInput } from '@w3-notifications/shared-types';
import { Field, InputType } from 'type-graphql';
import { Artifact } from './Artifact';
import { ChannelSettings } from './ChannelSettings';
import { Role } from './enums';

@InputType('SubscriptionInput')
export class SubscriptionInput implements SharedSubscriptionInput {
  @Field()
  public readonly appId: string;
  @Field(type => Artifact)
  public readonly artifact: Artifact;
  @Field(type => ChannelSettings)
  public readonly channelSettings: ChannelSettings;
  @Field(type => Role)
  public readonly role: Role;
  @Field()
  public readonly userId: string;
  @Field()
  public readonly subscriptionType: string;

  constructor(
    appId: string,
    artifact: Artifact,
    userId: string,
    channelSettings: ChannelSettings,
    role: Role,
    subscriptionType: string,

  ) {
    this.appId = appId;
    this.artifact = artifact;
    this.channelSettings = channelSettings;
    this.role = role;
    this.userId = userId;
    this.subscriptionType = subscriptionType;
  }
}
 