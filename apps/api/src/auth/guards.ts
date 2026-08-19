import { LocalAuthGuard } from "./guards/local-auth.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "./guards/optional-jwt-auth.guard";
import { TournamentAccessGuard } from "./guards/tournament-access.guard";
import { AdminGuard } from "./guards/admin.guard";
import { CreatorOrAdminGuard } from "./guards/owner-or-admin.guard";

export { LocalAuthGuard };
export { JwtAuthGuard };
export { OptionalJwtAuthGuard };
export { TournamentAccessGuard };
export { AdminGuard };
export { CreatorOrAdminGuard };

export const Guards = [
    LocalAuthGuard,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    TournamentAccessGuard,
    AdminGuard,
    CreatorOrAdminGuard,
]
