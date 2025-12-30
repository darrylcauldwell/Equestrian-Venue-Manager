import { useState, useCallback } from 'react';

/**
 * Manages modal + form state for create/edit patterns.
 * Consolidates: showModal, editingItem, formData states.
 *
 * @example
 * const modal = useModalForm<CreateComplianceItem>({
 *   category: '',
 *   item_type: 'document',
 *   title: '',
 *   description: '',
 * });
 *
 * // Open for create
 * <button onClick={() => modal.open()}>Add New</button>
 *
 * // Open for edit
 * <button onClick={() => modal.edit(item.id, item)}>Edit</button>
 *
 * // In modal
 * <Modal isOpen={modal.isOpen} onClose={modal.close}>
 *   <input
 *     value={modal.formData.title}
 *     onChange={(e) => modal.updateField('title', e.target.value)}
 *   />
 *   <button onClick={() => handleSubmit(modal.formData, modal.editingId)}>
 *     {modal.isEditing ? 'Update' : 'Create'}
 *   </button>
 * </Modal>
 */
export function useModalForm<T extends object>(defaultValues: T) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<T>(defaultValues);

  const isEditing = editingId !== null;

  const open = useCallback((initialData?: Partial<T>) => {
    setFormData({ ...defaultValues, ...initialData });
    setEditingId(null);
    setIsOpen(true);
  }, [defaultValues]);

  const close = useCallback(() => {
    setIsOpen(false);
    setEditingId(null);
    setFormData(defaultValues);
  }, [defaultValues]);

  const edit = useCallback((id: number, data: Partial<T>) => {
    setEditingId(id);
    setFormData({ ...defaultValues, ...data });
    setIsOpen(true);
  }, [defaultValues]);

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const updateFields = useCallback((updates: Partial<T>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData(defaultValues);
  }, [defaultValues]);

  return {
    // State
    isOpen,
    isEditing,
    editingId,
    formData,
    // Actions
    open,
    close,
    edit,
    setFormData,
    updateField,
    updateFields,
    resetForm,
  };
}

export default useModalForm;
