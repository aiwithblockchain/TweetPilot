import { useEffect, useState } from 'react';
import type { Role } from '../../domain/role';

type RoleFormValues = {
  name: string;
  description: string;
  prompt: string;
};

type RoleFormProps = {
  workspaceName: string;
  editingRole?: Role | null;
  disabled?: boolean;
  onSubmit: (values: RoleFormValues) => Promise<void> | void;
  onCancelEdit?: () => void;
};

const emptyForm: RoleFormValues = {
  name: '',
  description: '',
  prompt: '',
};

export default function RoleForm({
  workspaceName,
  editingRole,
  disabled = false,
  onSubmit,
  onCancelEdit,
}: RoleFormProps) {
  const [values, setValues] = useState<RoleFormValues>(emptyForm);

  useEffect(() => {
    if (!editingRole) {
      setValues(emptyForm);
      return;
    }

    setValues({
      name: editingRole.name,
      description: editingRole.description,
      prompt: editingRole.prompt,
    });
  }, [editingRole]);

  const submitLabel = editingRole ? 'Save Role' : 'Create Role';

  return (
    <section className="panel role-panel">
      <p className="panel-title">{editingRole ? 'Edit Role' : 'Create Role'}</p>
      <p className="muted">Workspace: {workspaceName}</p>
      <form
        className="role-form"
        onSubmit={async (event) => {
          event.preventDefault();
          await onSubmit(values);
          if (!editingRole) {
            setValues(emptyForm);
          }
        }}
      >
        <label className="field">
          <span>Role Name</span>
          <input
            value={values.name}
            disabled={disabled}
            onChange={(event) =>
              setValues((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="专业客服"
            required
          />
        </label>

        <label className="field">
          <span>Description</span>
          <textarea
            value={values.description}
            disabled={disabled}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            placeholder="说明该角色适合的业务场景"
            rows={3}
            required
          />
        </label>

        <label className="field">
          <span>Prompt</span>
          <textarea
            value={values.prompt}
            disabled={disabled}
            onChange={(event) =>
              setValues((current) => ({ ...current, prompt: event.target.value }))
            }
            placeholder="用于注入 AI 的角色提示词"
            rows={5}
            required
          />
        </label>

        <div className="action-row">
          <button type="submit" className="action-button" disabled={disabled}>
            {submitLabel}
          </button>
          {editingRole && onCancelEdit && (
            <button
              type="button"
              className="secondary-button"
              onClick={onCancelEdit}
              disabled={disabled}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
