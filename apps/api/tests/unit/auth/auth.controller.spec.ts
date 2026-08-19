import { AuthController } from '@api/auth/controllers/auth.controller';
import { AuthService } from '@api/auth/services/auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(() => {
    controller = new AuthController({} as AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
