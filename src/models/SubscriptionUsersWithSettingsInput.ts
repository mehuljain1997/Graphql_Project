import { ArrayMaxSize } from 'class-validator';
import { Field, InputType } from 'type-graphql';
import { Artifact } from './Artifact';
import { SubscriptionUserWithSettings } from './SubscriptionUserWithSettings';

@InputType('SubscriptionUsersWithSettingsInput')
export class SubscriptionUsersWithSettingsInput {

  @Field()
  public readonly appId: string;
  @Field(type => Artifact)
  public readonly artifact: Artifact;
  @ArrayMaxSize(50)
  @Field(type => [SubscriptionUserWithSettings!]!)
  public readonly usersWithSettings: SubscriptionUserWithSettings[];

  constructor(
    appId: string,
    artifact: Artifact,
    usersWithSettings: SubscriptionUserWithSettings[],
  ) {
    this.appId = appId;
    this.artifact = artifact;
    this.usersWithSettings = usersWithSettings;
  }
}
