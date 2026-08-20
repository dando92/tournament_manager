import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';

import { Account } from '@tournament-manager/persistence';
import { AuthService } from '@api/auth/services/auth.service';

describe('AuthService', () => {
  function createService(findOneBy: jest.Mock): AuthService {
    return new AuthService(
      { findOneBy } as unknown as Repository<Account>,
      {} as JwtService,
    );
  }

  it('should be defined', () => {
    expect(createService(jest.fn())).toBeDefined();
  });

  it('rejects an unknown username without dereferencing a missing account', async () => {
    const service = createService(jest.fn().mockResolvedValue(null));

    await expect(service.validateUser('nobody', 'whatever')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
