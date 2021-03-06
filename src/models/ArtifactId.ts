import { ArtifactId as SharedArtifactId } from '@w3-notifications/shared-types';
import { Field, InputType, ObjectType } from 'type-graphql';
import { ArtifactIdElement } from './ArtifactIdElement';


@InputType('ArtifactIdInput')
@ObjectType()
export class ArtifactId implements SharedArtifactId {
  @Field(type => [ArtifactIdElement])
  public readonly elements: ArtifactIdElement[];
}
 