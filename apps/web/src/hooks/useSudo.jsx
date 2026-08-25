import React, { useCallback, useRef, useState } from 'react';
import { SudoPrompt } from '../components/SudoPrompt.jsx';

/**
 * Erreur 403 renvoyée par SudoGuard quand l'élévation manque ou a expiré.
 * L'appelant doit propager le code d'erreur de l'API sur `error.code`.
 */
const isSudoRequired = (error) => error?.code === 'SUDO_REQUIRED';

/**
 * Enveloppe une action d'administration : si l'API réclame une élévation, la
 * modale de ré-authentification s'affiche et l'action est rejouée telle quelle
 * après confirmation.
 *
 *   const { run, prompt } = useSudo()
 *   await run(() => savePlan())
 *   return <>{…}{prompt}</>
 *
 * L'action est donc potentiellement exécutée deux fois (un premier appel refusé
 * en 403, puis le vrai) : elle doit être rejouable sans effet de bord, ce qui
 * est le cas d'un appel HTTP refusé avant d'atteindre le service.
 */
export function useSudo() {
  const [pending, setPending] = useState(false);
  // L'action à rejouer après confirmation, et le resolve/reject de l'appelant.
  const deferred = useRef(null);

  const run = useCallback(async (action) => {
    try {
      return await action();
    } catch (error) {
      if (!isSudoRequired(error)) throw error;

      // Élévation manquante : on suspend, la modale prend la main.
      return new Promise((resolve, reject) => {
        deferred.current = { action, resolve, reject };
        setPending(true);
      });
    }
  }, []);

  const handleConfirmed = useCallback(async () => {
    const current = deferred.current;
    deferred.current = null;
    setPending(false);
    if (!current) return;

    try {
      current.resolve(await current.action());
    } catch (error) {
      current.reject(error);
    }
  }, []);

  const handleCancel = useCallback(() => {
    const current = deferred.current;
    deferred.current = null;
    setPending(false);
    current?.reject(new Error('Action annulée'));
  }, []);

  const prompt = pending ? (
    <SudoPrompt onConfirmed={handleConfirmed} onCancel={handleCancel} />
  ) : null;

  return { run, prompt };
}
