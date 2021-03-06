import { ArtifactIdElement as SharedArtifactIdElement } from '@w3-notifications/shared-types';
import { Field, InputType, ObjectType } from 'type-graphql';

@ObjectType()
@InputType('ArtifactIdElementInput')
export class ArtifactIdElement implements SharedArtifactIdElement {
  @Field()
  public readonly id: string;

  constructor(id: string) {
    this.id = id;
  }
} 