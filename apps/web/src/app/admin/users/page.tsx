"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, UserCircle, ShieldAlert } from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc-client";
import { useToast } from "@/components/ui/Toast";

type SafeUser = {
  id: string;
  username: string;
  email?: string;
  role: "admin" | "editor" | "viewer";
  createdAt: string;
};

const CreateSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(8, "Mindestens 8 Zeichen"),
  email: z.string().email().optional().or(z.literal("")),
  role: z.enum(["admin", "editor", "viewer"]).default("viewer"),
});
type CreateForm = z.infer<typeof CreateSchema>;

const UpdateSchema = z.object({
  username: z.string().min(1).max(64).optional(),
  password: z.string().min(8).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  role: z.enum(["admin", "editor", "viewer"]).optional(),
});
type UpdateForm = z.infer<typeof UpdateSchema>;

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

export default function AdminUsersPage() {
  const { data: users = [] } = trpc.users.list.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();
  const onErr = (e: { message?: string }) => toast.error("Fehler", e?.message);

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<SafeUser | null>(null);

  const create = trpc.users.create.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); toast.success("Benutzer angelegt"); },
    onError: onErr,
  });

  const update = trpc.users.update.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); toast.success("Benutzer aktualisiert"); },
    onError: onErr,
  });

  const del = trpc.users.delete.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); toast.success("Benutzer gelöscht"); },
    onError: onErr,
  });

  return (
    <div className="admin-card">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="admin-card-title">Benutzer</h1>
          <p className="admin-card-sub">Benutzerverwaltung</p>
        </div>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus size={15} /> Neuer Benutzer
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {(users as SafeUser[]).map((user) => (
          <div key={user.id} className="admin-list-row">
            <div className="flex items-center gap-3 min-w-0">
              <span style={{ color: "var(--brand)" }}><UserCircle size={18} /></span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--fg)] truncate">{user.username}</span>
                  <span className={`admin-badge${user.role === "admin" ? " admin-badge-brand" : ""}`}>
                    {user.role === "admin" && <ShieldAlert size={10} />}
                    {ROLE_LABELS[user.role]}
                  </span>
                </div>
                {user.email && (
                  <span className="font-mono text-[11px] text-[var(--dim)]">{user.email}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button className="btn-ghost btn-xs" onClick={() => setEditUser(user)}>
                <Pencil size={13} />
              </button>
              <button
                className="btn-ghost btn-xs btn-danger"
                onClick={() => {
                  if (confirm(`Benutzer "${user.username}" wirklich löschen?`)) {
                    del.mutate({ id: user.id });
                  }
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <p className="text-[var(--dim)] text-sm py-6 text-center">
            Noch keine Benutzer. Im Modus &quot;userPassword&quot; werden Benutzer hier verwaltet.
          </p>
        )}
      </div>

      {createOpen && (
        <CreateUserModal
          onClose={() => setCreateOpen(false)}
          onSubmit={(data) =>
            create.mutateAsync({
              username: data.username,
              password: data.password,
              role: data.role,
              ...(data.email ? { email: data.email } : {}),
            }).then(() => setCreateOpen(false))
          }
        />
      )}
      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSubmit={(data) =>
            update.mutateAsync({
              id: editUser.id,
              ...(data.username ? { username: data.username } : {}),
              ...(data.password ? { password: data.password } : {}),
              ...(data.email ? { email: data.email } : {}),
              ...(data.role ? { role: data.role } : {}),
            }).then(() => setEditUser(null))
          }
        />
      )}
    </div>
  );
}

function CreateUserModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: CreateForm) => Promise<void>;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateForm>({
    resolver: zodResolver(CreateSchema),
    defaultValues: { role: "viewer" },
  });

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title="Neuer Benutzer" onClose={onClose} />
      <form className="modal-form-shell" onSubmit={handleSubmit(onSubmit)}>
        <ModalBody>
          <div className="form-stack">
            <div className="admin-field">
              <label className="admin-label">Benutzername</label>
              <input className="admin-input" {...register("username")} placeholder="max" autoComplete="off" />
              {errors.username && <span className="admin-field-error">{errors.username.message}</span>}
            </div>
            <div className="admin-field">
              <label className="admin-label">Passwort</label>
              <input className="admin-input" type="password" {...register("password")} autoComplete="new-password" />
              {errors.password && <span className="admin-field-error">{errors.password.message}</span>}
            </div>
            <div className="admin-field">
              <label className="admin-label">E-Mail (optional)</label>
              <input className="admin-input" type="email" {...register("email")} placeholder="max@example.com" />
              {errors.email && <span className="admin-field-error">{errors.email.message}</span>}
            </div>
            <div className="admin-field">
              <label className="admin-label">Rolle</label>
              <select className="admin-input" {...register("role")}>
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <button type="button" className="btn-ghost" onClick={onClose}>Abbrechen</button>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Anlege…" : "Anlegen"}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

function EditUserModal({
  user,
  onClose,
  onSubmit,
}: {
  user: SafeUser;
  onClose: () => void;
  onSubmit: (data: UpdateForm) => Promise<void>;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<UpdateForm>({
    resolver: zodResolver(UpdateSchema),
    defaultValues: { username: user.username, email: user.email ?? "", role: user.role },
  });

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader title="Benutzer bearbeiten" subtitle={user.username} onClose={onClose} />
      <form className="modal-form-shell" onSubmit={handleSubmit(onSubmit)}>
        <ModalBody>
          <div className="form-stack">
            <div className="admin-field">
              <label className="admin-label">Benutzername</label>
              <input className="admin-input" {...register("username")} autoComplete="off" />
              {errors.username && <span className="admin-field-error">{errors.username.message}</span>}
            </div>
            <div className="admin-field">
              <label className="admin-label">Neues Passwort (leer lassen = unverändert)</label>
              <input className="admin-input" type="password" {...register("password")} autoComplete="new-password" />
              {errors.password && <span className="admin-field-error">{errors.password.message}</span>}
            </div>
            <div className="admin-field">
              <label className="admin-label">E-Mail (optional)</label>
              <input className="admin-input" type="email" {...register("email")} />
              {errors.email && <span className="admin-field-error">{errors.email.message}</span>}
            </div>
            <div className="admin-field">
              <label className="admin-label">Rolle</label>
              <select className="admin-input" {...register("role")}>
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <button type="button" className="btn-ghost" onClick={onClose}>Abbrechen</button>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Speichere…" : "Speichern"}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
