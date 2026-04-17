import SwiftUI
import Observation

/// Maintains app-wide state
@MainActor
@Observable
class AppModel {
    let immersiveSpaceID = "ImmersiveSpace"

    enum ImmersiveSpaceState {
        case closed
        case inTransition
        case open
    }
    var immersiveSpaceState = ImmersiveSpaceState.closed

    // MARK: - Immersion Mode

    enum ImmersionMode: String, CaseIterable, Identifiable {
        case ar = "AR"
        case vr = "VR"

        var id: String { rawValue }
    }
    var immersionMode: ImmersionMode = .vr

    // MARK: - Palace State

    var currentPalace: MemoryPalace?
    var isInsidePalace: Bool { currentPalace != nil }

    // MARK: - Audio Settings

    var spatialAudioEnabled: Bool = true
    var arSoundEnabled: Bool = true
    var vrSoundEnabled: Bool = true
    var masterVolume: Float = 0.8
    var effectsVolume: Float = 0.7

    // MARK: - Haptics

    var hapticsEnabled: Bool = true

    // MARK: - Live Scene Override
    // Set from ObjectLibraryView → Scenes tab to hot-swap the skybox.
    var activeSceneURL: String? = nil       // HDRI thumbnail URL (takes priority over preset)
    var activeScenePreset: String? = nil    // Built-in preset name

    // MARK: - Refresh Triggers

    /// Increment to signal immersive views to reload palace items.
    var palaceItemRefreshTrigger: Int = 0

    // MARK: - Deep Link

    /// Palace ID to open, set by deep link from website
    var deepLinkPalaceId: String? = nil

    /// Handle memorypalace:// URLs from the website
    func handleDeepLink(_ url: URL) {
        // memorypalace://palace/PALACE_ID  → open that palace
        // memorypalace://open              → just open the app
        guard url.scheme == "memorypalace" else { return }
        if url.host == "palace", let id = url.pathComponents.dropFirst().first {
            deepLinkPalaceId = id
        }
    }
}
