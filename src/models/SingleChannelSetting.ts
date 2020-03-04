import { SingleChannelSettings as SharedSingleChannelSettings } from '@w3-notifications/shared-types';
import { Field, InputType, ObjectType } from 'type-graphql';
import { ChannelFrequencies } from './enums';

@ObjectType()
@InputType('SingleChannelSettingsInput')
export class SingleChannelSettings implements SharedSingleChannelSettings {

  @Field(type => ChannelFrequencies)
  public readonly frequency: ChannelFrequencies;

  constructor(frequency: ChannelFrequencies) {
    this.frequency = frequency;
  }
}