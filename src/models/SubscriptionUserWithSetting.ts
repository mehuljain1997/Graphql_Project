import { Field, InputType } from 'type-graphql';
import { ChannelSettings } from './ChannelSettings';
import { Role } from './enums';

@InputType('SubscriptionUserWithSettings')
export class SubscriptionUserWithSettings {

  @Field()
  public readonly userId: string;
  @Field(type => ChannelSettings)
  public readonly channelSettings: ChannelSettings;
  @Field(type => Role)
  public readonly role: Role;
  @Field()
  public readonly subscriptionType: string;

  constructor(
    userId: string,
    channelSettings: ChannelSettings,
    role: Role,
    subscriptionType: string,
  ) {
    this.userId = userId;
    this.channelSettings = channelSettings;
    this.role = role;
    this.subscriptionType = subscriptionType;
  }
}
