import {
    CanActivate,
    ExecutionContext,
    Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { Roles } from "@auth/decorators";
import { Role } from "@auth/enums/role.enum";


const ROLE_HIERARCHY: Role[] = [
    Role.Player,
    Role.TournamentStaff,
    Role.TournamentOwner,
    Role.Admin,
];


@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.get(Roles, context.getHandler());
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user) return false;

        const userRoleIndex = ROLE_HIERARCHY.indexOf(user.role);
        const minRequiredIndex = Math.min(
            ...requiredRoles.map((r: Role) => ROLE_HIERARCHY.indexOf(r))
        );

        return userRoleIndex >= minRequiredIndex;
    }
}
