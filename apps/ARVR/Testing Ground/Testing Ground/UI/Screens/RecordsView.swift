//
//  RecordsView.swift
//  Testing Ground
//
//  Created by ituser on 29/1/2026.
//

import SwiftUI

struct RecordsView: View {
    @StateObject private var viewModel = RecordsViewModel()

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Picker("", selection: $viewModel.selectedTab) {
                Text("Games").tag(RecordsViewModel.RecordsTab.games)
                Text("Activity").tag(RecordsViewModel.RecordsTab.activity)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            .padding(.vertical, 8)

            if viewModel.isLoading {
                loadingView
            } else if let error = viewModel.errorMessage {
                errorView(error)
            } else {
                contentView
            }
        }
        .navigationTitle("Records")
        .task {
            await viewModel.loadGameRecords()
        }
    }
    
    @ViewBuilder
    private var contentView: some View {
        switch viewModel.selectedTab {
        case .games:
            gamesContent
        case .activity:
            activityContent
        }
    }
    
    private var gamesContent: some View {
        ScrollView {
            if viewModel.gameRecords.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "gamecontroller.fill")
                        .font(.system(size: 48))
                        .foregroundColor(.gray)
                    Text("No Game Records")
                        .font(.headline)
                    Text("Your game records will appear here")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding()
            } else {
                LazyVStack(spacing: 12) {
                    ForEach(viewModel.gameRecords) { record in
                        NavigationLink(value: AppRoute.scriptScenes(
                            scriptId: record.scriptId ?? "",
                            scriptTitle: record.title ?? record.documentName ?? "Script"
                        )) {
                            GameRecordCard(record: record)
                        }
                        .buttonStyle(.plain)
                        .disabled(record.scriptId == nil)
                    }
                }
                .padding()
            }
        }
        .refreshable {
            await viewModel.loadGameRecords()
        }
    }
    
    private var activityContent: some View {
        ScrollView {
            if viewModel.activityRecords.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "doc.text.fill")
                        .font(.system(size: 48))
                        .foregroundColor(.gray)
                    Text("No Activity Records")
                        .font(.headline)
                    Text("Your activity will appear here")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding()
            } else {
                LazyVStack(spacing: 12) {
                    ForEach(viewModel.activityRecords) { record in
                        ActivityRecordCard(record: record)
                    }
                }
                .padding()
            }
        }
        .refreshable {
            await viewModel.loadActivityRecords()
        }
    }
    
    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
            Text("Loading records...")
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private func errorView(_ error: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.circle.fill")
                .font(.system(size: 48))
                .foregroundColor(.red)
            Text("Error Loading Records")
                .font(.headline)
            Text(error)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            Button(action: {
                Task {
                    await viewModel.refresh()
                }
            }) {
                Text("Retry")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Color.blue)
                    .cornerRadius(8)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
    
}

// MARK: - Game Record Card

struct GameRecordCard: View {
    let record: GameRecord
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(record.title ?? record.documentName ?? "Unknown Title")
                        .font(.headline)
                        .fontWeight(.semibold)
                        .lineLimit(2)

                    if let module = record.moduleName {
                        Text(module)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                    }
                }

                Spacer()
            }

            if let createdAt = record.createdAt {
                Text(formatDate(createdAt))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.gray.opacity(0.1), lineWidth: 1)
        )
    }
    
    private func statusBadge(_ status: String) -> some View {
        Text(status.uppercased())
            .font(.caption2)
            .fontWeight(.semibold)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(statusColor(status).opacity(0.2))
            .foregroundColor(statusColor(status))
            .cornerRadius(4)
    }
    
    private func statusColor(_ status: String) -> Color {
        switch status.lowercased() {
        case "valid": return .green
        case "invalid": return .red
        case "pending": return .orange
        default: return .gray
        }
    }
    
    private func formatDate(_ dateString: String) -> String {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = parser.date(from: dateString) ?? ISO8601DateFormatter().date(from: dateString)
        guard let date else { return dateString }
        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .short
        displayFormatter.timeStyle = .none
        return displayFormatter.string(from: date)
    }
}

// MARK: - Activity Record Card

struct ActivityRecordCard: View {
    let record: ActivityRecord
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                // User Avatar
                Circle()
                    .fill(Color.blue.opacity(0.3))
                    .frame(width: 44, height: 44)
                    .overlay(
                        Image(systemName: "person.fill")
                            .foregroundColor(.blue)
                    )
                
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(record.user?.displayName ?? "Unknown User")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                        
                        Spacer()
                        
                        if let createdAt = record.createdAt {
                            Text(formatDate(createdAt))
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    Text(record.content?.title ?? "Unknown Title")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            if let description = record.content?.description, !description.isEmpty {
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
            
            HStack(spacing: 16) {
                Label("\(record.likes ?? 0)", systemImage: "heart.fill")
                    .font(.caption2)
                    .foregroundColor(.red)
                
                Label("\(record.comments ?? 0)", systemImage: "bubble.right.fill")
                    .font(.caption2)
                    .foregroundColor(.blue)
                
                Spacer()
                
                Label(record.entityType ?? "Unknown", systemImage: "tag.fill")
                    .font(.caption2)
                    .foregroundColor(.gray)
            }
        }
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.gray.opacity(0.1), lineWidth: 1)
        )
    }
    
    private func formatDate(_ date: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            let timeFormatter = DateFormatter()
            timeFormatter.timeStyle = .short
            return timeFormatter.string(from: date)
        } else {
            let displayFormatter = DateFormatter()
            displayFormatter.dateStyle = .short
            return displayFormatter.string(from: date)
        }
    }
}

#Preview {
    RecordsView()
}
