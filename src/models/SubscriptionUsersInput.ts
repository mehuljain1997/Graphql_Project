import { ArrayMaxSize } from 'class-validator';
import { Field, InputType } from 'type-graphql';
import { Artifact } from './Artifact';
import { ChannelSettings } from './ChannelSettings';
import { Role } from './enums';

@InputType('SubscriptionUsersInput')
export class SubscriptionUsersInput {

  @Field()
  public readonly appId: string;
  @Field(type => Artifact)
  public readonly artifact: Artifact;
  @Field(type => ChannelSettings)
  public readonly channelSettings: ChannelSettings;
  @Field(type => Role)
  public readonly role: Role;
  @ArrayMaxSize(50)
  @Field(type => [String!]!)
  public readonly userIds: string[];
  @Field()
  public readonly subscriptionType: string;

  constructor(
    appId: string,
    artifact: Artifact,
    userIds: string[],
    channelSettings: ChannelSettings,
    role: Role,
    subscriptionType: string,
  ) {
    this.appId = appId;
    this.artifact = artifact;
    this.channelSettings = channelSettings;
    this.role = role;
    this.userIds = userIds;
    this.subscriptionType = subscriptionType;
  }
}
 