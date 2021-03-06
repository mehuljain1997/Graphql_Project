import { ChannelSettings as SharedChannelSettings } from '@w3-notifications/shared-types';
import { Field, InputType, ObjectType } from 'type-graphql';
import { InstantChannelSettings } from './InstantChannelSettings';
import { SingleChannelSettings  } from './SingleChannelSettings';

@ObjectType()
@InputType('ChannelSettingsInput')
export class ChannelSettings implements SharedChannelSettings {
  @Field()
  public readonly email: SingleChannelSettings;
  @Field(type => SingleChannelSettings, {
    nullable: true,
  })
  public webBell?: SingleChannelSettings;

  @Field(type => InstantChannelSettings, {
    nullable: true,
  })
  public mobilePush?: InstantChannelSettings;

  constructor(
    email: SingleChannelSettings,
    webBell?: SingleChannelSettings,
    mobilePush?: InstantChannelSettings,
  ) {
    this.email = email;
    this.webBell = webBell;
    this.mobilePush = mobilePush;
  }
}
 