import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { HttpSyncStartClient } from './http-syncstart.client';
import { SYNCSTART_CLIENT } from './syncstart-client';

@Module({
  imports: [HttpModule],
  providers: [
    HttpSyncStartClient,
    { provide: SYNCSTART_CLIENT, useExisting: HttpSyncStartClient },
  ],
  exports: [SYNCSTART_CLIENT],
})
export class SyncStartIntegrationModule {}
