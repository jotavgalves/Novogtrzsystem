import { FolderPlus } from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';

interface CategoryFormProps {
  readonly busy: boolean;
  readonly onSubmit: (name: string) => Promise<void>;
}

export function CategoryForm({ busy, onSubmit }: CategoryFormProps): React.JSX.Element {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    try {
      await onSubmit(name);
      setName('');
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error ? submitError.message : 'Não foi possível criar a categoria.',
      );
    }
  }

  return (
    <form className="category-form" onSubmit={(event) => void handleSubmit(event)}>
      <label className="form-field">
        <span>Nova categoria</span>
        <input
          maxLength={60}
          minLength={2}
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder="Ex.: Cervejas"
          required
          value={name}
        />
      </label>
      {error === null ? null : <p className="form-error">{error}</p>}
      <button
        className="button button--secondary"
        disabled={busy || name.trim().length < 2}
        type="submit"
      >
        <FolderPlus size={16} aria-hidden="true" />
        Criar categoria
      </button>
    </form>
  );
}
