# Backend Architecture and Coding Rules

## NestJS Architecture

The backend uses the following architectural layers:

- **Controllers:** Define API routes and contain almost no application logic. Controllers encapsulate and delegate to services or managers. They must not access or inject repositories.
- **Controller routes:** Route inputs must be mapped through DTOs instead of individual native parameters. A native parameter is allowed only when the route accepts a single value, such as `id: number`.
- **Managers:** Implement application logic and complex orchestration. Managers must not access or inject repositories. They use the appropriate services whenever they need to retrieve or update database data. Managers also transform database entities into DTOs for the view.
- **Services:** Provide CRUD access to the database. Services encapsulate repositories and all database access, and return plain database entities that managers decouple from the presentation layer.
- **Entities:** Represent database entities.
- **Gateways:** Provide real-time view updates through WebSockets.
- **DTOs:** Define data exchanged with the view, both incoming and outgoing.

## Technologies

- NestJS

Other backend technologies have not been defined yet.
