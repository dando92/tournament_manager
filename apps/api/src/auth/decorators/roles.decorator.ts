import { Reflector } from "@nestjs/core";
import { Role } from "@auth/enums/role.enum";


export const Roles = Reflector.createDecorator<Role[]>();
