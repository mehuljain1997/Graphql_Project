import { InstantChannelSettings as SharedInstantChannelSettings } from '@w3-notifications/shared-types';
import { Field, InputType, ObjectType } from 'type-graphql';
import { InstantChannelFrequencies } from './enums';

@ObjectType()
@InputType('InstantChannelSettingsInput')
export class InstantChannelSettings implements SharedInstantChannelSettings {

  @Field(type => InstantChannelFrequencies)
  public readonly frequency: InstantChannelFrequencies;

  constructor(frequency: InstantChannelFrequencies) {
    this.frequency = frequency;
  }
}
 