import { Ban } from 'lucide-react';
import { useState } from 'react';

interface CancellationFormProps {
  readonly busy: boolean;
  readonly label: string;
  readonly onSubmit: (reason: string) => Promise<void>;
}

export function CancellationForm({
  busy,
  label,
  onSubmit,
}: CancellationFormProps): React.JSX.Element {
  const [reason, setReason] = useState('');

  return (
    <form
      className="cancellation-form"
      onSubmit={(event) => {
        event.preventDefault();
        const normalizedReason = reason.trim();

        if (normalizedReason.length < 3) {
          return;
        }

        void onSubmit(normalizedReason).then(() => {
          setReason('');
        });
      }}
    >
      <label className="form-field">
        <span>Motivo obrigatório</span>
        <input
          disabled={busy}
          maxLength={240}
          onChange={(event) => {
            setReason(event.target.value);
          }}
          placeholder="Ex.: lançamento duplicado"
          value={reason}
        />
      </label>
      <button
        className="button button--ghost cancellation-form__button"
        disabled={busy || reason.trim().length < 3}
        type="submit"
      >
        <Ban size={16} aria-hidden="true" />
        {label}
      </button>
    </form>
  );
}
