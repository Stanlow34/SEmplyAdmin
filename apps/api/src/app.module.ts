import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth/auth.controller';
import { ProxyController } from './proxy/proxy.controller';
import { HealthController } from './health.controller';
import { OidcService } from './auth/oidc.service';
import { ProductTokenService } from './auth/product-token.service';
import { SessionStore } from './session/session.store';
import { ProductsService } from './registry/products.service';

/**
 * BFF du back-office. Aucune logique métier, aucun accès base : trois services,
 * dont deux sont des registres en mémoire.
 */
@Module({
  imports: [ConfigModule.forRoot({ envFilePath: ['.env'], isGlobal: true })],
  controllers: [AuthController, ProxyController, HealthController],
  providers: [OidcService, ProductTokenService, SessionStore, ProductsService],
})
export class AppModule {}
