import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

/**
 * Le BFF sert UNIQUEMENT l'API du back-office, sous /api.
 * Les fichiers statiques (apps/web/dist) sont servis par nginx, pas ici.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: true });

  // Derrière nginx : sans ça, `secure: true` sur les cookies est ignoré et
  // req.protocol vaut toujours http.
  app.set('trust proxy', 1);

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-origin' } }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // PAS de CORS : le back-office et son relais partagent la même origine
  // (admin.semply.fr), nginx routant /api vers ce processus. Aucune autre
  // origine n'a de raison d'appeler ce service — et l'absence de CORS est ici
  // une protection, pas un oubli.

  const port = Number(process.env.PORT ?? 3010);
  await app.listen(port, '127.0.0.1');
  new Logger('bootstrap').log(`BFF back-office à l'écoute sur 127.0.0.1:${port}`);
}

void bootstrap();
