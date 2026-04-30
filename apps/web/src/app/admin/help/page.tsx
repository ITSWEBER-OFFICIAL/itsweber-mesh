"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, ChevronDown, ExternalLink, GripVertical } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

const FormSchema = z.object({
  question: z.string().min(1, "Frage darf nicht leer sein"),
  answer: z.string().min(1, "Antwort darf nicht leer sein"),
  sortOrder: z.number().int().default(0),
});
type FormValues = z.infer<typeof FormSchema>;

type FaqItem = { id: string; question: string; answer: string; sortOrder: number };

function FaqModal({
  item,
  onClose,
  onSaved,
}: {
  item: FaqItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const isNew = item === null;

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      question: item?.question ?? "",
      answer: item?.answer ?? "",
      sortOrder: item?.sortOrder ?? 0,
    },
  });

  const upsert = trpc.helpItems.upsert.useMutation({
    onSuccess: () => {
      utils.helpItems.list.invalidate();
      toast.success(isNew ? "FAQ-Eintrag erstellt" : "FAQ-Eintrag gespeichert");
      onSaved();
    },
    onError: (e) => toast.error("Fehler", e.message),
  });

  function onSubmit(data: FormValues) {
    upsert.mutate({ id: item?.id, ...data });
  }

  return (
    <Modal onClose={onClose} size="md">
      <ModalHeader
        title={isNew ? "FAQ-Eintrag hinzufügen" : "FAQ-Eintrag bearbeiten"}
        onClose={onClose}
      />
      <form className="modal-form-shell" onSubmit={handleSubmit(onSubmit)}>
        <ModalBody>
          <div className="form-stack">
            <div className="admin-field">
              <label className="admin-label">Frage</label>
              <input
                {...register("question")}
                className="admin-input"
                placeholder="Wie füge ich einen Service hinzu?"
              />
              {errors.question && (
                <span className="admin-field-error">{errors.question.message}</span>
              )}
            </div>
            <div className="admin-field">
              <label className="admin-label">Antwort</label>
              <textarea
                {...register("answer")}
                className="admin-input admin-textarea"
                rows={5}
                placeholder="Beschreibe die Lösung..."
              />
              {errors.answer && (
                <span className="admin-field-error">{errors.answer.message}</span>
              )}
            </div>
            <div className="admin-field">
              <label className="admin-label">Reihenfolge</label>
              <input
                {...register("sortOrder", { valueAsNumber: true })}
                type="number"
                className="admin-input admin-input-narrow"
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <button type="button" className="btn-ghost" onClick={onClose}>Abbrechen</button>
          <button type="submit" className="btn-primary" disabled={upsert.isPending}>
            {upsert.isPending ? "Speichern…" : "Speichern"}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

export default function AdminHelpPage() {
  const toast = useToast();
  const utils = trpc.useUtils();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [editItem, setEditItem] = useState<FaqItem | null | undefined>(undefined);
  const [deleteItem, setDeleteItem] = useState<FaqItem | null>(null);

  const { data: items = [] } = trpc.helpItems.list.useQuery();

  const del = trpc.helpItems.delete.useMutation({
    onSuccess: () => {
      utils.helpItems.list.invalidate();
      toast.success("Eintrag gelöscht");
      setDeleteItem(null);
    },
    onError: (e) => toast.error("Fehler", e.message),
  });

  return (
    <>
      <div className="admin-card">
        <div className="faq-page-header">
          <div className="faq-page-header-text">
            <h1 className="admin-card-title">Hilfe & FAQ</h1>
            <p className="admin-card-sub">Häufige Fragen — im Admin pflegbar</p>
          </div>
          <button type="button" className="btn-primary" onClick={() => setEditItem(null)}>
            <Plus size={13} /> Eintrag hinzufügen
          </button>
        </div>

        <div className="faq-list">
          {items.length === 0 && (
            <p className="faq-empty">Noch keine FAQ-Einträge. Klicke auf „Eintrag hinzufügen".</p>
          )}
          {items.map((item, i) => (
            <div key={item.id} className="faq-item">
              <div className="faq-item-row">
                <span className="faq-item-grip"><GripVertical size={12} /></span>
                <button
                  type="button"
                  className="faq-item-trigger"
                  onClick={() => setOpenIdx(openIdx === i ? null : i)}
                >
                  <span className="faq-item-question">{item.question}</span>
                  <ChevronDown
                    size={14}
                    className={`faq-item-chevron${openIdx === i ? " faq-item-chevron--open" : ""}`}
                  />
                </button>
                <div className="faq-item-actions">
                  <button
                    type="button"
                    className="btn-ghost btn-xs"
                    onClick={() => setEditItem(item)}
                    aria-label="Bearbeiten"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    className="btn-danger btn-xs"
                    onClick={() => setDeleteItem(item)}
                    aria-label="Löschen"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              {openIdx === i && (
                <div className="faq-item-answer">{item.answer}</div>
              )}
            </div>
          ))}
        </div>

        <div className="admin-divider" />

        <div className="flex flex-col gap-3">
          <h2 className="faq-resources-title">Weitere Ressourcen</h2>
          <div className="flex flex-wrap gap-2">
            <a
              href="https://github.com/itsweber/mesh/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
            >
              <ExternalLink size={13} /> Bug melden / Feature Request
            </a>
            <a
              href="https://github.com/itsweber/mesh"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
            >
              <ExternalLink size={13} /> GitHub Repository
            </a>
          </div>
        </div>
      </div>

      {editItem !== undefined && (
        <FaqModal
          item={editItem}
          onClose={() => setEditItem(undefined)}
          onSaved={() => setEditItem(undefined)}
        />
      )}

      {deleteItem && (
        <Modal onClose={() => setDeleteItem(null)} size="sm">
          <ModalHeader title="Eintrag löschen?" onClose={() => setDeleteItem(null)} />
          <ModalBody>
            <p className="faq-delete-text">„{deleteItem.question}" wird dauerhaft gelöscht.</p>
          </ModalBody>
          <ModalFooter>
            <button type="button" className="btn-ghost" onClick={() => setDeleteItem(null)}>Abbrechen</button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => del.mutate({ id: deleteItem.id })}
              disabled={del.isPending}
            >
              {del.isPending ? "Löschen…" : "Löschen"}
            </button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}
