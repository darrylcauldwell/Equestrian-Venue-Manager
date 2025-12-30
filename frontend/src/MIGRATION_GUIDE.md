# Component Migration Guide

This guide documents how to refactor existing components to use the design system hooks and UI components.

## Why Migrate?

Current large components have:
- 27-41 `useState` calls each
- Duplicated modal/form patterns
- Inline styling instead of design system components

After migration:
- ~60% reduction in state management code
- Consistent UI patterns
- Better accessibility (modals handle escape key, focus trap)
- Easier maintenance

## Core Tools

### 1. useModalForm Hook

**Before (7+ lines per modal):**
```tsx
const [showModal, setShowModal] = useState(false);
const [editingItem, setEditingItem] = useState<Item | null>(null);
const [formData, setFormData] = useState<CreateItem>({ name: '', ... });

const openAdd = () => {
  setEditingItem(null);
  setFormData({ name: '', ... });
  setShowModal(true);
};

const openEdit = (item: Item) => {
  setEditingItem(item);
  setFormData({ name: item.name, ... });
  setShowModal(true);
};
```

**After (1 line):**
```tsx
import { useModalForm } from '../hooks';

const modal = useModalForm<CreateItem>({ name: '', ... });

// Open for create
<button onClick={() => modal.open()}>Add</button>

// Open for edit
<button onClick={() => modal.edit(item.id, item)}>Edit</button>

// In form
<input
  value={modal.formData.name}
  onChange={(e) => modal.updateField('name', e.target.value)}
/>

// Submit
const handleSubmit = async () => {
  if (modal.isEditing) {
    await api.update(modal.editingId, modal.formData);
  } else {
    await api.create(modal.formData);
  }
  modal.close();
};
```

### 2. Modal Component

**Before (inline markup):**
```tsx
{showModal && (
  <div className="ds-modal-overlay" onClick={() => setShowModal(false)}>
    <div className="ds-modal" onClick={e => e.stopPropagation()}>
      <div className="ds-modal-header">
        <h2>Title</h2>
        <button className="ds-modal-close" onClick={() => setShowModal(false)}>&times;</button>
      </div>
      <div className="ds-modal-body">
        {/* content */}
      </div>
      <div className="ds-modal-footer">
        <button onClick={() => setShowModal(false)}>Cancel</button>
        <button onClick={handleSubmit}>Save</button>
      </div>
    </div>
  </div>
)}
```

**After:**
```tsx
import { Modal } from '../components/ui';

<Modal
  isOpen={modal.isOpen}
  onClose={modal.close}
  title={modal.isEditing ? 'Edit Item' : 'Add Item'}
  footer={
    <>
      <button className="ds-btn ds-btn-secondary" onClick={modal.close}>Cancel</button>
      <button className="ds-btn ds-btn-primary" onClick={handleSubmit}>
        {modal.isEditing ? 'Update' : 'Create'}
      </button>
    </>
  }
>
  {/* content */}
</Modal>
```

### 3. FormGroup Components

**Before:**
```tsx
<div className="ds-form-group">
  <label>Field Name *</label>
  <input
    type="text"
    value={formData.name}
    onChange={e => setFormData({ ...formData, name: e.target.value })}
    required
  />
</div>

<div className="form-row">
  <div className="ds-form-group">
    <label>Max Horses *</label>
    <input type="number" ... />
  </div>
  <div className="ds-form-group">
    <label>Size (acres)</label>
    <input type="number" ... />
  </div>
</div>
```

**After:**
```tsx
import { FormGroup, FormRow, Input, Checkbox } from '../components/ui';

<FormGroup label="Field Name" required>
  <Input
    value={modal.formData.name}
    onChange={e => modal.updateField('name', e.target.value)}
    required
  />
</FormGroup>

<FormRow>
  <FormGroup label="Max Horses" required>
    <Input type="number" ... />
  </FormGroup>
  <FormGroup label="Size (acres)">
    <Input type="number" ... />
  </FormGroup>
</FormRow>
```

### 4. ConfirmModal for Dangerous Actions

**Before:**
```tsx
const handleDelete = async (item: Item) => {
  if (!confirm(`Delete "${item.name}"?`)) return;
  await api.delete(item.id);
  await loadData();
};
```

**After:**
```tsx
import { ConfirmModal } from '../components/ui';

const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

<ConfirmModal
  isOpen={!!deleteTarget}
  onClose={() => setDeleteTarget(null)}
  onConfirm={async () => {
    await api.delete(deleteTarget!.id);
    setDeleteTarget(null);
    await loadData();
  }}
  title="Delete Item"
  message={`Are you sure you want to delete "${deleteTarget?.name}"?`}
  confirmLabel="Delete"
  variant="danger"
/>

// Trigger
<button onClick={() => setDeleteTarget(item)}>Delete</button>
```

## Migration Checklist

For each component:

- [ ] Import hooks: `import { useModalForm } from '../hooks';`
- [ ] Import UI: `import { Modal, FormGroup, FormRow, Input, Select, Checkbox, ConfirmModal } from '../components/ui';`
- [ ] Replace `useState` for modals with `useModalForm`
- [ ] Replace inline modal markup with `<Modal>` component
- [ ] Replace inline form groups with `<FormGroup>` + `<Input>`/`<Select>`
- [ ] Replace `confirm()` dialogs with `<ConfirmModal>`
- [ ] Test all CRUD operations work correctly
- [ ] Verify accessibility (escape key, tab navigation)

## Available Components

### From `../components/ui`
- `Modal`, `TabbedModal`, `ConfirmModal`
- `FormGroup`, `FormRow`, `Input`, `Select`, `Textarea`, `Checkbox`, `Radio`
- `Button`, `ButtonGroup`
- `Badge`, `StatusBadge`, `PriorityBadge`
- `Card`, `CardHeader`, `CardBody`, `CardFooter`
- `Tabs`, `TabPanel`
- `DataTable`
- `FilterBar`, `FilterSelect`, `FilterInput`
- `Loading`, `LoadingSpinner`, `Skeleton`
- `Alert`, `Empty`

### From `../hooks`
- `useModalForm` - modal + form state management
- `useFilteredList` - list filtering logic
- `useLoadingStates` - loading state management
- `useRequestState` - API request state

## Priority Order

1. **Small admin pages** (Fields, Stables, Compliance) - pilot migrations
2. **Medium pages** (ServiceRequests, EventTriage, CarePlans)
3. **Large pages** (StaffManagement, Clinics, Settings)
4. **Largest pages** (HorseHealthRecords, YardTasks, Lessons) - may need additional extraction
