import axios from 'axios';

/**
 * Client HTTP unique — vers NOTRE relais, jamais vers un produit.
 *
 * Le navigateur ne connaît aucune API de produit et ne détient aucun jeton :
 * il parle à `/api` sur sa propre origine, et le BFF ajoute le
 * `Authorization: Bearer` côté serveur. Trois conséquences :
 *
 *  - aucune configuration CORS nulle part : tout est en même origine ;
 *  - le cookie de session est host-only sur admin.semply.fr, donc invisible
 *    depuis les autres sous-domaines ;
 *  - une XSS ici ne peut rien exfiltrer de rejouable ailleurs — il n'y a
 *    aucun secret à voler dans la page.
 */
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Sur 401, le relais a déjà tenté le renouvellement : s'il échoue, la session
// est bel et bien finie. On renvoie vers le portail plutôt que d'insister.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && !/\/auth\//.test(error.config?.url ?? '')) {
      window.location.assign('/api/auth/login');
    }
    return Promise.reject(error);
  },
);

export default api;

/** Client préfixé pour un produit : `apiFor('semplyapp').get('admin/articles')`. */
export function apiFor(productKey) {
  return {
    get: (path, config) => api.get(`/p/${productKey}/${path}`, config),
    post: (path, body, config) => api.post(`/p/${productKey}/${path}`, body, config),
    patch: (path, body, config) => api.patch(`/p/${productKey}/${path}`, body, config),
    put: (path, body, config) => api.put(`/p/${productKey}/${path}`, body, config),
    delete: (path, config) => api.delete(`/p/${productKey}/${path}`, config),
  };
}
