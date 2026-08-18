import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(() => {
    controller = new AuthController({} as AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
