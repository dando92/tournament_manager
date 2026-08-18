import { Body, Controller, Post, Get, Request, UseGuards, ValidationPipe } from '@nestjs/common';
import { AuthService } from '../services';
import { LocalApiKeyLoginDto } from '../dtos';
import { LocalAuthGuard, JwtAuthGuard } from '@auth/guards';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @UseGuards(LocalAuthGuard)
    @Post('login')
    async login(@Request() req) {
        return this.authService.login(req.user);
    }

    @Post('login/local')
    async loginLocal(@Body(new ValidationPipe()) dto: LocalApiKeyLoginDto) {
        return this.authService.loginWithApiKey(dto.apiKey);
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    async getMe(@Request() req) {
        return this.authService.getMe(req.user.id);
    }

    @UseGuards(JwtAuthGuard)
    @Get('permissions')
    async getPermissions(@Request() req) {
        return this.authService.getPermissions(req.user.id);
    }
}
