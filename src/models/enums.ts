import 'reflect-metadata';
import { registerEnumType } from 'type-graphql';

export enum ChannelFrequencies {
  INSTANTLY = 'INSTANTLY', DAILY = 'DAILY', WEEKLY = 'WEEKLY', NA = 'NA',
}

export enum InstantChannelFrequencies {
  INSTANTLY = 'INSTANTLY', NA = 'NA',
}

export enum Channels {
  EMAIL = 'email', WEB_BELL = 'webBell', MOBILE_PUSH = 'mobilePush',
}

export enum State {
  ACTIVE = 1, INACTIVE = 2, HIDDEN = 3,
}

export enum Role {
  AUTHOR = 'AUTHOR', SUBSCRIBER = 'SUBSCRIBER',
}

registerEnumType(Role, { name: 'Role' });
registerEnumType(ChannelFrequencies, { name: 'ChannelFrequencies' });
registerEnumType(InstantChannelFrequencies, { name: 'InstantChannelFrequencies' });
registerEnumType(State, { name: 'State' });
 