import SwiftUI

/// Floating panel to capture user memory text that links object, scene, and recall content.
struct MemoryNotePanel: View {

    let item: PalaceItem
    var errorMessage: String?
    var onSave: (ObjectSceneMemoryNote) -> Void
    var onClose: (() -> Void)?

    @State private var note: ObjectSceneMemoryNote

    init(
        item: PalaceItem,
        errorMessage: String? = nil,
        onSave: @escaping (ObjectSceneMemoryNote) -> Void,
        onClose: (() -> Void)? = nil
    ) {
        self.item = item
        self.errorMessage = errorMessage
        self.onSave = onSave
        self.onClose = onClose
        _note = State(initialValue: ObjectSceneMemoryNote.from(customText: item.customText, fallbackObjectName: nil))
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Image(systemName: "text.bubble")
                    .foregroundStyle(.blue)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Memory Note")
                        .font(.headline)
                    Text(item.label ?? "Object")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer()
                Button { onClose?() } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                        .font(.title3)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            Divider()

            VStack(spacing: 10) {
                Group {
                    TextField("Object name", text: $note.objectName)
                        .textFieldStyle(.roundedBorder)

                    TextField("Scene context (e.g. museum hall)", text: $note.sceneContext)
                        .textFieldStyle(.roundedBorder)

                    VStack(alignment: .leading, spacing: 6) {
                        Text("What should you remember?")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        TextEditor(text: $note.rememberContent)
                            .frame(minHeight: 110)
                            .padding(6)
                            .background(Color.white.opacity(0.06))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                }

                if let errorMessage, !errorMessage.isEmpty {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button {
                    onSave(note)
                } label: {
                    Label("Save Memory Note", systemImage: "square.and.arrow.down")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(!note.isMeaningful)
            }
            .padding(14)
        }
        .frame(width: 430)
        .glassBackground()
    }
}