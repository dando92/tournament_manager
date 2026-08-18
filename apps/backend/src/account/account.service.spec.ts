import { Repository } from 'typeorm';

import { Account, Player } from '@persistence/entities';
import { AccountService } from './services/account.service';

describe('AccountService', () => {
  let service: AccountService;

  beforeEach(() => {
    service = new AccountService(
      {} as Repository<Account>,
      {} as Repository<Player>,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
