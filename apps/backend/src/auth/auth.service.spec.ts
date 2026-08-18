import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';

import { Account } from '@persistence/entities';
import { AuthService } from './services/auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService(
      {} as Repository<Account>,
      {} as JwtService,
      {} as ConfigService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
