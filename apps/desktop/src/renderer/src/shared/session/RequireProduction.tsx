import { Navigate, Outlet } from 'react-router';

import { useSession } from './session-context';

export function RequireProduction(): React.JSX.Element {
  const { state, loading, error } = useSession();

  if (state === null) {
    if (loading) {
      return <div className="route-state">Carregando permissões…</div>;
    }

    if (error !== null) {
      return <div className="route-state route-state--error">{error}</div>;
    }

    return <div className="route-state">Sessão indisponível.</div>;
  }

  if (state.profile !== 'production') {
    return <Navigate replace to="/mesas" />;
  }

  return <Outlet />;
}
