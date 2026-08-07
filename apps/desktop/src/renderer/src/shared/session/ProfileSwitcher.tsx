import { KeyRound, LogIn, UserRoundCog } from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router';

import { useSession } from './session-context';

export function ProfileSwitcher(): React.JSX.Element {
  const navigate = useNavigate();
  const { state, switchToCashier, switchToProduction } = useSession();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const profile = state?.profile ?? 'production';

  async function handleCashier(): Promise<void> {
    setSubmitting(true);
    setMessage(null);

    try {
      await switchToCashier();
      await navigate('/mesas', { replace: true });
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível trocar o perfil.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleProduction(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      await switchToProduction(password);
      setPassword('');
      await navigate('/', { replace: true });
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível trocar o perfil.');
    } finally {
      setSubmitting(false);
    }
  }

  if (profile === 'production') {
    return (
      <div className="profile-switcher">
        <button
          className="button button--secondary button--compact"
          disabled={submitting}
          onClick={() => {
            void handleCashier();
          }}
          type="button"
        >
          <UserRoundCog size={16} aria-hidden="true" />
          Usar perfil Caixa
        </button>
        {message === null ? null : <small className="form-error">{message}</small>}
      </div>
    );
  }

  return (
    <form className="profile-switcher" onSubmit={(event) => void handleProduction(event)}>
      <label className="compact-field">
        <span>Senha de Produção</span>
        <span className="compact-field__input">
          <KeyRound size={15} aria-hidden="true" />
          <input
            autoComplete="current-password"
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            placeholder="Digite a senha"
            type="password"
            value={password}
          />
        </span>
      </label>
      <button
        className="button button--primary button--compact"
        disabled={submitting || password.length === 0}
        type="submit"
      >
        <LogIn size={16} aria-hidden="true" />
        Entrar em Produção
      </button>
      {message === null ? null : <small className="form-error">{message}</small>}
    </form>
  );
}
