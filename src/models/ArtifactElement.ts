import { ArtifactElement as SharedArtifactElement } from '@w3-notifications/shared-types';
import { Field, InputType, ObjectType } from 'type-graphql';
import { ArtifactIdElement } from './ArtifactIdElement';


@ObjectType()
@InputType('ArtifactElementInput')
export class ArtifactElement implements SharedArtifactElement {
  @Field()
  public readonly artifactIdElement: ArtifactIdElement;
  @Field()
  public readonly title: string;

  @Field()
  public readonly artifactDate: string;

  constructor(artifactIdElement: ArtifactIdElement,
    title: string,
    artifactDate: string,
  ) {
    this.artifactIdElement = artifactIdElement;
    this.title = title;
    this.artifactDate = artifactDate;
  }
}
 