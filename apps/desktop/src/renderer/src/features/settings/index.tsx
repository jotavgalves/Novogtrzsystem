import { KeyRound, Settings, ShieldCheck } from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';

export function SettingsPage(): React.JSX.Element {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formEvent: SyntheticEvent<HTMLFormElement>): Promise<void> {
    formEvent.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      if (newPassword !== confirmation) {
        throw new Error('A confirmação não corresponde à nova senha.');
      }

      await window.gtrz.settings.changeProductionPassword({
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      setMessage('Senha de Produção alterada com segurança.');
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error ? submitError.message : 'Não foi possível alterar a senha.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="feature-page">
      <header className="feature-header">
        <div>
          <span className="eyebrow">Acesso exclusivo da Produção</span>
          <h1>Configurações</h1>
          <p>Preferências administrativas e proteções do sistema offline.</p>
        </div>
        <span className="feature-icon" aria-hidden="true">
          <Settings size={26} />
        </span>
      </header>

      <div className="settings-grid">
        <article className="panel security-summary">
          <span className="security-summary__icon" aria-hidden="true">
            <ShieldCheck size={28} />
          </span>
          <div>
            <h2>Controle administrativo</h2>
            <p>
              O perfil Caixa não acessa eventos, ingressos, custos, margens, caixa administrativo,
              despesas, auditoria, backups ou configurações.
            </p>
          </div>
        </article>

        <form className="panel form-panel" onSubmit={(formEvent) => void handleSubmit(formEvent)}>
          <div className="panel__heading">
            <KeyRound size={20} aria-hidden="true" />
            <div>
              <h2>Senha de Produção</h2>
              <p>A senha inicial é 121225 e deve ser substituída antes do primeiro evento.</p>
            </div>
          </div>

          <label className="form-field">
            <span>Senha atual</span>
            <input
              autoComplete="current-password"
              onChange={(inputEvent) => {
                setCurrentPassword(inputEvent.target.value);
              }}
              required
              type="password"
              value={currentPassword}
            />
          </label>

          <label className="form-field">
            <span>Nova senha</span>
            <input
              autoComplete="new-password"
              minLength={6}
              onChange={(inputEvent) => {
                setNewPassword(inputEvent.target.value);
              }}
              required
              type="password"
              value={newPassword}
            />
          </label>

          <label className="form-field">
            <span>Confirmar nova senha</span>
            <input
              autoComplete="new-password"
              minLength={6}
              onChange={(inputEvent) => {
                setConfirmation(inputEvent.target.value);
              }}
              required
              type="password"
              value={confirmation}
            />
          </label>

          {error === null ? null : <p className="form-error">{error}</p>}
          {message === null ? null : <p className="form-success">{message}</p>}

          <button
            className="button button--primary"
            disabled={submitting || newPassword.length < 6 || confirmation.length < 6}
            type="submit"
          >
            <KeyRound size={17} aria-hidden="true" />
            Alterar senha
          </button>
        </form>
      </div>
    </section>
  );
}
