import SwiftUI

/// SwiftUI attachment that appears above a 3D entity in the palace.
/// Shows item label on idle; expands to review card on tap.
struct ItemInfoAttachment: View {

    let item: PalaceItem
    var onTap: (() -> Void)?
    var onReview: ((Int) -> Void)?
    var onEditMemory: (() -> Void)?
    var onAskAI: (() -> Void)?

    @State private var isExpanded = false

    var body: some View {
        VStack(spacing: 8) {
            if isExpanded {
                expandedView
            } else {
                compactView
            }
        }
        .animation(.spring(duration: 0.3), value: isExpanded)
    }

    // MARK: - Compact (label only)

    private var compactView: some View {
        Button {
            isExpanded = true
            onTap?()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: displayTypeIcon)
                    .font(.body)
                    .foregroundStyle(.blue)
                Text(item.label ?? "Item")
                    .font(.body)
                    .fontWeight(.semibold)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
        }
        .buttonStyle(.plain)
        .glassBackground()
    }

    // MARK: - Expanded (review card)

    private var expandedView: some View {
        VStack(spacing: 12) {
            // Header
            HStack {
                Image(systemName: displayTypeIcon)
                    .foregroundStyle(Brand.primary)
                Text(item.label ?? "Review Item")
                    .font(.headline)
                Spacer()
                Button {
                    isExpanded = false
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }

            // Content
            if let text = item.customText {
                ScrollView {
                    Text(text)
                        .font(.body)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxHeight: 200)
            }

            // Review due indicator
            if let nextReview = item.nextReviewAt {
                HStack {
                    Image(systemName: "clock")
                    Text(nextReview < Date() ? "Review overdue" : "Next review: \(nextReview, style: .relative)")
                        .font(.caption)
                }
                .foregroundStyle(nextReview < Date() ? .red : .secondary)
            }

            // AI Helper button
            HStack(spacing: 8) {
                if let onEditMemory {
                    Button {
                        onEditMemory()
                    } label: {
                        Label("Memory Text", systemImage: "text.bubble")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 4)
                    }
                    .buttonStyle(.bordered)
                    .tint(.blue)
                }

                if let onAskAI {
                    Button {
                        onAskAI()
                    } label: {
                        Label("Ask AI", systemImage: "sparkles")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 4)
                    }
                    .buttonStyle(.bordered)
                    .tint(.purple)
                }
            }

            // Review buttons
            if let onReview {
                Divider()
                Text("Rate your recall:")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                HStack(spacing: 6) {
                    reviewButton(quality: 0, label: "Again", color: .red, action: onReview)
                    reviewButton(quality: 1, label: "Hard", color: .orange, action: onReview)
                    reviewButton(quality: 3, label: "Good", color: .green, action: onReview)
                    reviewButton(quality: 5, label: "Easy", color: Brand.primary, action: onReview)
                }
            }
        }
        .padding(16)
        .frame(width: 400)
        .glassBackground()
    }

    private func reviewButton(quality: Int, label: String, color: Color, action: @escaping (Int) -> Void) -> some View {
        Button {
            action(quality)
        } label: {
            Text(label)
                .font(.caption)
                .fontWeight(.medium)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
        }
        .buttonStyle(.bordered)
        .tint(color)
    }

    private var displayTypeIcon: String {
        switch item.displayType {
        case "3d_model": return "cube"
        case "text_panel": return "text.alignleft"
        default: return "rectangle.portrait"
        }
    }
}
