import { Controller, Get } from '@nestjs/common';

/**
 * Sonde de vie, consommée par deploy.sh et par la supervision.
 *
 * Volontairement sans état et sans dépendance : elle dit « le processus
 * répond », rien de plus. La joignabilité des produits relayés se constate
 * sur les écrans — un relais en vie avec un produit éteint est un état
 * normal, pas une panne du relais.
 */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
