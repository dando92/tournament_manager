import { NestFactory } from "@nestjs/core";
import { SyncStartModule } from "./syncstart.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(SyncStartModule);
  app.enableShutdownHooks();
  await app.listen(process.env.SYNCSTART_PORT ?? 3002);
}
void bootstrap();
