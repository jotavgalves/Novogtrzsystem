import { AlertTriangle } from 'lucide-react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

function getErrorMessage(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return `${String(error.status)}: ${error.statusText}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'O módulo não pôde ser carregado.';
}

export function ErrorPage(): React.JSX.Element {
  const error = useRouteError();

  return (
    <section className="error-page" role="alert">
      <AlertTriangle size={36} aria-hidden="true" />
      <h1>Falha ao abrir esta área</h1>
      <p>{getErrorMessage(error)}</p>
      <Link className="button button--primary" to="/">
        Voltar para a visão geral
      </Link>
    </section>
  );
}
