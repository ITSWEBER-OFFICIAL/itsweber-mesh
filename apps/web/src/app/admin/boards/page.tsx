"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Home, LayoutGrid } from "lucide-react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc-client";
import { useToast } from "@/components/ui/Toast";
import type { Board } from "@/server/config/schema";

const FormSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Nur Kleinbuchstaben, Ziffern und Bindestriche"),
  name: z.string().min(1),
  icon: z.string().optional(),
  isHome: z.boolean().default(false),
  layout: z.enum(["flat", "sections"]).default("flat"),
});
type Form = z.infer<typeof FormSchema>;

export default function AdminBoardsPage() {
  const { data: boards = [] } = trpc.boards.list.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();
  const onErr = (e: { message?: string }) => toast.error("Fehler", e?.message);

  const [editBoard, setEditBoard] = useState<Board | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const upsert = trpc.boards.upsert.useMutation({
    onSuccess: () => { utils.boards.list.invalidate(); toast.success("Board gespeichert"); },
    onError: onErr,
  });

  const del = trpc.boards.delete.useMutation({
    onSuccess: () => { utils.boards.list.invalidate(); toast.success("Board gelöscht"); },
    onError: onErr,
  });

  const setHome = trpc.boards.setHome.useMutation({
    onSuccess: () => { utils.boards.list.invalidate(); toast.success("Home-Board gesetzt"); },
    onError: onErr,
  });

  return (
    <div className="admin-card">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="admin-card-title">Boards</h1>
          <p className="admin-card-sub">Multi-Board-Verwaltung</p>
        </div>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus size={15} /> Neues Board
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {boards.map((board) => (
          <div key={board.id} className="admin-list-row">
            <div className="flex items-center gap-3 min-w-0">
              <span style={{ color: "var(--brand)" }}><LayoutGrid size={16} /></span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--fg)] truncate">{board.name}</span>
                  {board.isHome && (
                    <span className="admin-badge admin-badge-brand">
                      <Home size={10} /> Home
                    </span>
                  )}
                  <span className="admin-badge">{board.layout}</span>
                </div>
                <span className="font-mono text-[11px] text-[var(--dim)]">/{board.slug}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!board.isHome && (
                <button
                  className="btn-ghost btn-xs"
                  title="Als Home setzen"
                  onClick={() => setHome.mutate({ id: board.id })}
                >
                  <Home size={13} />
                </button>
              )}
              <button className="btn-ghost btn-xs" onClick={() => setEditBoard(board)}>
                <Pencil size={13} />
              </button>
              {!board.isHome && (
                <button
                  className="btn-ghost btn-xs btn-danger"
                  onClick={() => {
                    if (confirm(`Board "${board.name}" wirklich löschen?`)) {
                      del.mutate({ id: board.id });
                    }
                  }}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        ))}
        {boards.length === 0 && (
          <p className="text-[var(--dim)] text-sm py-6 text-center">Keine Boards gefunden.</p>
        )}
      </div>

      {createOpen && (
        <BoardModal
          onClose={() => setCreateOpen(false)}
          onSubmit={(data) => upsert.mutateAsync(data).then(() => setCreateOpen(false))}
        />
      )}
      {editBoard && (
        <BoardModal
          board={editBoard}
          onClose={() => setEditBoard(null)}
          onSubmit={(data) =>
            upsert.mutateAsync({ ...data, id: editBoard.id }).then(() => setEditBoard(null))
          }
        />
      )}
    </div>
  );
}

function BoardModal({
  board,
  onClose,
  onSubmit,
}: {
  board?: Board;
  onClose: () => void;
  onSubmit: (data: Form) => Promise<void>;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(FormSchema),
    defaultValues: board
      ? { slug: board.slug, name: board.name, icon: board.icon ?? "", isHome: board.isHome, layout: board.layout }
      : { slug: "", name: "", icon: "", isHome: false, layout: "flat" },
  });

  return (
    <Modal onClose={onClose} size="sm">
      <ModalHeader
        title={board ? "Board bearbeiten" : "Neues Board"}
        onClose={onClose}
      />
      <form className="modal-form-shell" onSubmit={handleSubmit(onSubmit)}>
        <ModalBody>
          <div className="form-stack">
            <div className="admin-field">
              <label className="admin-label">Name</label>
              <input className="admin-input" {...register("name")} placeholder="Home" />
              {errors.name && <span className="admin-field-error">{errors.name.message}</span>}
            </div>
            <div className="admin-field">
              <label className="admin-label">Slug</label>
              <input className="admin-input" {...register("slug")} placeholder="home" />
              {errors.slug && <span className="admin-field-error">{errors.slug.message}</span>}
            </div>
            <div className="admin-field">
              <label className="admin-label">Icon (optional)</label>
              <input className="admin-input" {...register("icon")} placeholder="🏠" />
            </div>
            <div className="admin-field">
              <label className="admin-label">Layout</label>
              <select className="admin-input" {...register("layout")}>
                <option value="flat">Flat</option>
                <option value="sections">Sections</option>
              </select>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" {...register("isHome")} className="admin-checkbox" />
              <span className="text-[13px] text-[var(--fg)]">Als Home-Board setzen</span>
            </label>
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
