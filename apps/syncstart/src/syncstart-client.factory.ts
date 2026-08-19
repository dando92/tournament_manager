import {
  defaultSyncStartClientFactory,
  type SyncStartClientFactory,
} from "@tournament-manager/syncstart-protocol";

export const SYNCSTART_CLIENT_FACTORY = Symbol("SYNCSTART_CLIENT_FACTORY");
export const syncStartClientFactoryProvider = {
  provide: SYNCSTART_CLIENT_FACTORY,
  useValue: defaultSyncStartClientFactory satisfies SyncStartClientFactory,
};
