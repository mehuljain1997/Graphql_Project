import { Artifact as SharedArtifact } from '@w3-notifications/shared-types';
import { Field, InputType, ObjectType } from 'type-graphql';
import { ArtifactElement } from './ArtifactElement';

@InputType('ArtifactInput')
@ObjectType()
export class Artifact implements SharedArtifact {
  @Field(type => ArtifactElement)
  public readonly elements: ArtifactElement[];

  constructor(elements: ArtifactElement[]) {
    this.elements = elements;
  }
} 