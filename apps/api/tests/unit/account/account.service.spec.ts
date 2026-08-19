import { Repository } from 'typeorm';

import { Account, Player } from '@tournament-manager/persistence';
import { AccountService } from '@api/account/services/account.service';

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
