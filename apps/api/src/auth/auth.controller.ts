import {
  Controller, Get, Post, Req, Res, Query,
  UnauthorizedException, ForbiddenException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { OidcService } from './oidc.service';
import { SessionStore } from '../session/session.store';
import { ProductTokenService } from './product-token.service';
import { SESSION_COOKIE, setSessionCookie, clearSessionCookie } from '../session/cookie';

/**
 * Méthodes d'authentification attendues d'un administrateur.
 *
 * L'AUTORITÉ est l'`AdminGuard` d'AuthSEmply, qui refuse toute session
 * d'administration ouverte autrement que par mot de passe + TOTP. Le contrôle
 * ci-dessous ne sécurise donc rien de plus : il sert à dire tout de suite, sur
 * l'écran de connexion, ce qui manque — plutôt que de laisser découvrir la
 * règle trois clics plus loin sous la forme d'un 403 sans contexte.
 *
 * Absent de `userinfo`, `amr` ne fait pas échouer la connexion : c'est au
 * portail de trancher, pas à un miroir approximatif.
 */
const EXPECTED_AMR = ['pwd', 'otp'];

/**
 * Entrée et sortie de session. Le navigateur ne voit jamais un jeton : il
 * reçoit un identifiant opaque, et tout le reste vit dans le processus.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly oidc: OidcService,
    private readonly sessions: SessionStore,
    private readonly productTokens: ProductTokenService,
  ) {}

  @Get('login')
  login(@Res() res: Response) {
    res.redirect(this.oidc.beginAuthorization());
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code || !state) throw new UnauthorizedException('Retour d’autorisation incomplet');

    const tokens = await this.oidc.exchange(code, state);
    const profile = await this.oidc.userinfo(tokens.accessToken);

    const amr = Array.isArray(profile.amr) ? profile.amr.map(String) : null;
    if (amr) {
      const missing = EXPECTED_AMR.filter((method) => !amr.includes(method));
      if (missing.length > 0) {
        throw new ForbiddenException(
          'L’administration exige une connexion par mot de passe et code TOTP. ' +
            'Reconnectez-vous au portail avec ces deux facteurs.',
        );
      }
    }

    const id = this.sessions.create({
      sub: String(profile.sub ?? ''),
      email: String(profile.email ?? ''),
      ...tokens,
    });

    // 12 h : une journée de travail. Le refresh token vit plus longtemps, mais
    // une session d'administration ne doit pas traîner ouverte une semaine.
    setSessionCookie(res, id, 12 * 3600_000);
    res.redirect('/admin');
  }

  @Post('logout')
  logout(@Req() req: Request, @Res() res: Response) {
    const session = this.sessions.get(req.cookies?.[SESSION_COOKIE]);
    if (session) this.productTokens.forget(session.sub);
    this.sessions.destroy(req.cookies?.[SESSION_COOKIE]);
    clearSessionCookie(res);
    res.status(204).send();
  }

  /**
   * Qui est connecté. Ne renvoie QUE l'identité — jamais un jeton, jamais une
   * durée de validité qui aiderait à cadencer une attaque.
   */
  @Get('me')
  me(@Req() req: Request) {
    const session = this.sessions.get(req.cookies?.[SESSION_COOKIE]);
    if (!session) throw new UnauthorizedException();
    return { sub: session.sub, email: session.email };
  }
}
