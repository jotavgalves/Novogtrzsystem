import { Plus } from 'lucide-react';
import { useState } from 'react';

interface CreateTableFormProps {
  readonly busy: boolean;
  readonly onSubmit: (label: string) => Promise<void>;
}

export function CreateTableForm({ busy, onSubmit }: CreateTableFormProps): React.JSX.Element {
  const [label, setLabel] = useState('');

  return (
    <form
      className="create-table-form"
      onSubmit={(event) => {
        event.preventDefault();
        const normalized = label.trim();

        if (normalized.length === 0) {
          return;
        }

        void onSubmit(normalized).then(() => {
          setLabel('');
        });
      }}
    >
      <label className="form-field">
        <span>Nome ou número da mesa</span>
        <input
          disabled={busy}
          maxLength={40}
          onChange={(event) => {
            setLabel(event.target.value);
          }}
          placeholder="Ex.: Mesa 12"
          value={label}
        />
      </label>
      <button className="button" disabled={busy || label.trim().length === 0} type="submit">
        <Plus size={17} aria-hidden="true" />
        Criar mesa
      </button>
    </form>
  );
}
