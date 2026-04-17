import { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import RichTextEditor from '../flashcards/RichTextEditor';

interface EditableNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  initialContent?: string | null;
  onSave: (newContent: string) => Promise<void>;
  isSaving?: boolean;
}

export function EditableNoteModal({
  isOpen,
  onClose,
  title,
  initialContent,
  onSave,
  isSaving = false,
}: EditableNoteModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(initialContent || '');
  const [internalIsSaving, setInternalIsSaving] = useState(false);

  // Reset state when modal opens or initial content changes
  useEffect(() => {
    if (isOpen) {
      setContent(initialContent || '');
      setIsEditing(false);
      setInternalIsSaving(false);
    }
  }, [isOpen, initialContent]);

  const handleSave = async () => {
    setInternalIsSaving(true);
    await onSave(content.trim());
    setInternalIsSaving(false);
    setIsEditing(false);
  };

  const handleClear = async () => {
    if (window.confirm('Are you sure you want to clear and delete this note?')) {
      setInternalIsSaving(true);
      setContent('');
      await onSave('');
      setInternalIsSaving(false);
      setIsEditing(false);
      onClose();
    }
  };

  const currentIsSaving = isSaving || internalIsSaving;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <div className="my-4 min-h-[150px] max-h-[calc(100vh-260px)] overflow-y-auto pb-24">
        {isEditing ? (
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="Write your note down here..."
            minHeight="240px"
            maxHeight="calc(100vh - 320px)"
            dataTestId="editable-note-modal-editor"
          />
        ) : (
          <div className="prose dark:prose-invert max-w-none max-h-[calc(100vh-260px)] overflow-y-auto text-sm text-gray-700 dark:text-gray-300">
            {content ? (
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />
            ) : (
              <p className="italic text-gray-400">No note written yet.</p>
            )}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 left-0 z-10 mt-6 pt-4 border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-row justify-between items-center">
          <div>
            {!isEditing && content ? (
              <Button
                variant="secondary"
                onClick={handleClear}
                disabled={currentIsSaving}
                className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Delete
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="secondary" onClick={() => setIsEditing(false)} disabled={currentIsSaving}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={currentIsSaving}>
                  {currentIsSaving ? 'Saving...' : 'Save Note'}
                </Button>
              </>
            ) : (
              <>
                <Button variant="primary" onClick={() => setIsEditing(true)}>
                  {content ? 'Edit Note' : 'Add Note'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
