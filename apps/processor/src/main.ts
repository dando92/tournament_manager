import { NestFactory } from '@nestjs/core';
import { ProcessorModule } from './processor.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ProcessorModule);
  app.enableShutdownHooks();
  await app.listen(process.env.PROCESSOR_PORT ?? 3001);
}

void bootstrap();
