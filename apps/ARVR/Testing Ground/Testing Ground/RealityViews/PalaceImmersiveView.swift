import SwiftUI
import RealityKit
import RealityKitContent

#if os(visionOS)
/// VR mode immersive view — full skybox dome with placed memory items.
struct PalaceImmersiveView: View {

    @Environment(AppModel.self) private var appModel
    @State private var palaceVM = PalaceViewModel()
    @State private var selectedItem: PalaceItem?
    @State private var showReviewOverlay = false
    @State private var loadingItemIds: Set<String> = []
    @State private var palaceRoot: Entity? = nil
    @State private var aiTargetItem: PalaceItem? = nil
    @State private var memoryTargetItem: PalaceItem? = nil
    @State private var memorySaveError: String? = nil

    /// Demo items shown when the palace has no real items yet.
    private static let demoItems: [(label: String, position: SIMD3<Float>, color: UIColor)] = [
        ("Photosynthesis",    SIMD3(-1.2, 1.4, -2.5), .systemGreen),
        ("Mitochondria",      SIMD3( 0.0, 1.8, -3.0), .systemBlue),
        ("Newton's Laws",     SIMD3( 1.2, 1.4, -2.5), .systemOrange),
        ("Water Cycle",       SIMD3(-0.8, 1.0, -2.0), .systemCyan),
        ("Pythagorean Thm",   SIMD3( 0.8, 1.0, -2.0), .systemPurple),
        ("DNA Structure",     SIMD3( 0.0, 1.2, -1.8), .systemRed),
    ]

    var body: some View {
        RealityView { content, attachments in
            let root = Entity()
            root.name = "PalaceRoot"
            content.add(root)
            palaceRoot = root

            // 1. Load environment
            if let palace = appModel.currentPalace {
                await loadSkybox(for: palace, into: root)
            } else {
                await loadDefaultDome(into: root)
            }

            // 2. IBL lighting
            try? await root.applyImageBasedLighting()

        } update: { content, attachments in
            guard let root = content.entities.first(where: { $0.name == "PalaceRoot" }) else { return }

            // Add/update real items when they arrive from the API
            if !palaceVM.items.isEmpty {
                for item in palaceVM.items {
                    if root.findEntity(named: item.id) == nil {
                        let entity = createItemEntity(item)
                        root.addChild(entity)
                    }
                    // Position label attachment above item
                    if let attachment = attachments.entity(for: item.id) {
                        attachment.position = item.position + SIMD3<Float>(0, 0.25, 0)
                        if attachment.parent == nil {
                            root.addChild(attachment)
                        }
                    }
                    // Position per-item loading spinner
                    if let spinner = attachments.entity(for: "loading_\(item.id)") {
                        spinner.position = item.position + SIMD3<Float>(0, 0.40, 0)
                        if spinner.parent == nil {
                            root.addChild(spinner)
                        }
                    }
                }
            } else if appModel.currentPalace != nil {
                if root.findEntity(named: "demo_entity_0") == nil {
                    addDemoEntities(to: root, attachments: attachments)
                }
            }

            // Position AI helper panel above the target item
            if let aiPanel = attachments.entity(for: "ai_helper"),
               let aiItem = aiTargetItem {
                aiPanel.position = aiItem.position + SIMD3<Float>(0, 0.6, 0)
                if aiPanel.parent == nil {
                    root.addChild(aiPanel)
                }
            }

            // Position memory note panel next to the AI panel target
            if let notePanel = attachments.entity(for: "memory_note_panel"),
               let noteItem = memoryTargetItem {
                notePanel.position = noteItem.position + SIMD3<Float>(0.35, 0.6, 0)
                if notePanel.parent == nil {
                    root.addChild(notePanel)
                }
            }
        } attachments: {
            // Attachments for real items
            ForEach(palaceVM.items) { item in
                Attachment(id: item.id) {
                    ItemInfoAttachment(
                        item: item,
                        onTap: { selectItem(item) },
                        onReview: { quality in
                            Task {
                                await palaceVM.submitReview(itemId: item.id, quality: quality)
                                showReviewOverlay = false
                                selectedItem = nil
                            }
                        },
                        onEditMemory: {
                            memorySaveError = nil
                            memoryTargetItem = item
                        },
                        onAskAI: {
                            aiTargetItem = item
                        }
                    )
                }
            }

            if let noteItem = memoryTargetItem {
                Attachment(id: "memory_note_panel") {
                    MemoryNotePanel(
                        item: noteItem,
                        errorMessage: memorySaveError,
                        onSave: { note in
                            Task {
                                await saveMemoryNote(note, for: noteItem)
                            }
                        },
                        onClose: {
                            memorySaveError = nil
                            memoryTargetItem = nil
                        }
                    )
                }
            }

            // AI Helper panel — floats above the selected item
            if let aiItem = aiTargetItem {
                Attachment(id: "ai_helper") {
                    AIHelperPanel(
                        modelName: aiItem.label ?? aiItem.assetId ?? "Model",
                        onClose: { aiTargetItem = nil }
                    )
                }
            }

            // Per-item loading spinners (always created for 3D items, visibility controlled by state)
            ForEach(palaceVM.items.filter { $0.displayType == "3d_model" && $0.assetId != nil }) { item in
                Attachment(id: "loading_\(item.id)") {
                    if loadingItemIds.contains(item.id) {
                        HStack(spacing: 8) {
                            ProgressView()
                                .scaleEffect(0.7)
                            Text("Loading…")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .glassBackground()
                    }
                }
            }

            // Attachments for demo items
            if palaceVM.items.isEmpty && appModel.currentPalace != nil {
                ForEach(0..<Self.demoItems.count, id: \.self) { idx in
                    Attachment(id: "demo_\(idx)") {
                        demoLabel(Self.demoItems[idx].label)
                    }
                }
            }
        }
        .gesture(
            TapGesture()
                .targetedToAnyEntity()
                .onEnded { value in
                    handleTap(on: value.entity)
                }
        )
        .gesture(
            DragGesture()
                .targetedToAnyEntity()
                .onChanged { value in
                    handleDrag(entity: value.entity, translation: value.translation3D)
                }
                .onEnded { value in
                    handleDragEnd(entity: value.entity)
                }
        )
        .task {
            if let palace = appModel.currentPalace {
                palaceVM.currentPalace = palace
            }
            await palaceVM.loadItems()
        }
        .onChange(of: appModel.palaceItemRefreshTrigger) { _, _ in
            Task { await palaceVM.loadItems() }
        }
        .onChange(of: appModel.activeSceneURL) { _, newURL in
            Task { await swapSkybox(urlString: newURL, preset: appModel.activeScenePreset) }
        }
        .onChange(of: appModel.activeScenePreset) { _, newPreset in
            guard appModel.activeSceneURL == nil else { return }
            Task { await swapSkybox(urlString: nil, preset: newPreset) }
        }
        .alert("Error", isPresented: .init(
            get: { palaceVM.errorMessage != nil },
            set: { if !$0 { palaceVM.errorMessage = nil } }
        )) {
            Button("OK") { palaceVM.errorMessage = nil }
        } message: {
            Text(palaceVM.errorMessage ?? "")
        }
    }

    // MARK: - Live Skybox Swap

    @MainActor
    private func swapSkybox(urlString: String?, preset: String?) async {
        guard let root = palaceRoot else { return }
        root.findEntity(named: "PalaceSkybox")?.removeFromParent()

        let newSkybox: Entity
        if let urlStr = urlString, let url = URL(string: urlStr) {
            newSkybox = (try? await Entity.createSkybox(from: url))
                ?? Entity.createProceduralSkybox(preset: preset ?? "library")
        } else {
            newSkybox = (try? await Entity.createSkybox(named: preset ?? "library"))
                ?? Entity.createProceduralSkybox(preset: preset ?? "library")
        }
        newSkybox.name = "PalaceSkybox"
        root.addChild(newSkybox)
    }

    // MARK: - Environment Loading

    private func loadDefaultDome(into root: Entity) async {
        if let immersiveScene = try? await Entity(named: "Immersive", in: realityKitContentBundle) {
            if let videoDock = immersiveScene.findEntity(named: "Video_Dock") {
                videoDock.removeFromParent()
            }
            immersiveScene.name = "PalaceSkybox"
            root.addChild(immersiveScene)
        } else {
            let skybox = Entity.createProceduralSkybox(preset: "library")
            skybox.name = "PalaceSkybox"
            root.addChild(skybox)
        }
    }

    private func loadSkybox(for palace: MemoryPalace, into root: Entity) async {
        let skybox: Entity
        switch palace.skyboxType {
        case "uploaded", "ai_generated":
            if let path = palace.skyboxImagePath,
               let url = URL(string: "\(BackendConfig.baseURL)/\(path)") {
                skybox = (try? await Entity.createSkybox(from: url))
                    ?? Entity.createProceduralSkybox(preset: palace.skyboxPreset ?? "library")
            } else {
                skybox = (try? await Entity.createSkybox(named: palace.skyboxPreset ?? "library"))
                    ?? Entity.createProceduralSkybox(preset: palace.skyboxPreset ?? "library")
            }
        default:
            skybox = (try? await Entity.createSkybox(named: palace.skyboxPreset ?? "library"))
                ?? Entity.createProceduralSkybox(preset: palace.skyboxPreset ?? "library")
        }
        skybox.name = "PalaceSkybox"
        root.addChild(skybox)
    }

    // MARK: - Demo Label

    private func demoLabel(_ text: String) -> some View {
        Text(text)
            .font(.body)
            .fontWeight(.semibold)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .glassBackground()
    }

    // MARK: - Demo Entities

    private func addDemoEntities(to root: Entity, attachments: RealityViewAttachments) {
        for (idx, demo) in Self.demoItems.enumerated() {
            let entity = Entity()
            entity.name = "demo_entity_\(idx)"
            entity.position = demo.position

            let mesh = MeshResource.generateBox(width: 0.18, height: 0.24, depth: 0.008, cornerRadius: 0.01)
            var mat = PhysicallyBasedMaterial()
            mat.baseColor = .init(tint: demo.color)
            mat.roughness = .init(floatLiteral: 0.3)
            mat.metallic = .init(floatLiteral: 0.1)
            entity.components.set(ModelComponent(mesh: mesh, materials: [mat]))

            entity.components.set(CollisionComponent(shapes: [.generateBox(width: 0.18, height: 0.24, depth: 0.008)]))
            entity.components.set(InputTargetComponent())
            entity.components.set(HoverEffectComponent())

            let lookDir = -normalize(demo.position)
            let angle = atan2(lookDir.x, lookDir.z)
            entity.orientation = simd_quatf(angle: angle, axis: SIMD3<Float>(0, 1, 0))

            root.addChild(entity)

            if let attachment = attachments.entity(for: "demo_\(idx)") {
                attachment.position = demo.position + SIMD3<Float>(0, 0.16, 0)
                root.addChild(attachment)
            }
        }
    }

    // MARK: - Item Entities

    private func createItemEntity(_ item: PalaceItem) -> Entity {
        let entity = Entity()
        entity.name = item.id
        entity.position = item.position

        // Start with a loading placeholder sphere
        let placeholderMesh = MeshResource.generateSphere(radius: 0.06)
        var placeholderMat = PhysicallyBasedMaterial()
        placeholderMat.baseColor = .init(tint: .gray.withAlphaComponent(0.5))
        placeholderMat.roughness = .init(floatLiteral: 0.2)
        placeholderMat.metallic = .init(floatLiteral: 0.8)
        entity.components.set(ModelComponent(mesh: placeholderMesh, materials: [placeholderMat]))

        entity.components.set(CollisionComponent(shapes: [.generateSphere(radius: 0.06)]))
        entity.components.set(InputTargetComponent())
        entity.components.set(HoverEffectComponent())
        entity.components.set(HighlightComponent(
            itemId: item.id,
            label: item.label,
            flashcardId: item.flashcardId,
            assetId: item.assetId,
            displayType: item.displayType
        ))

        entity.orientation = simd_quatf(angle: item.rotationY * .pi / 180, axis: SIMD3<Float>(0, 1, 0))

        // Load the actual 3D model asynchronously
        if item.displayType == "3d_model", let assetId = item.assetId {
            let itemId = item.id
            Task {
                loadingItemIds.insert(itemId)
                defer { loadingItemIds.remove(itemId) }

                do {
                    // Download USDZ (geometry only — MaterialX shaders are ignored by RealityKit)
                    let assetURL = try await AssetAPIService.shared.downloadAssetAsUSDZ(assetId: assetId)
                    let model = try await Entity(contentsOf: assetURL)

                    // Immediately apply grey so model is never red while texture loads
                    Self.applyFallbackMaterial(to: model)

                    // Then replace with actual diffuse texture from backend
                    await Self.applyPolyhavenTexture(assetId: assetId, to: model)

                    // Auto-scale to fit within ~0.3m
                    let bounds = model.visualBounds(relativeTo: nil)
                    let maxDim = max(bounds.extents.x, max(bounds.extents.y, bounds.extents.z))
                    if maxDim > 0.001 {
                        model.scale *= 0.3 / maxDim
                    }

                    entity.components.remove(ModelComponent.self)
                    entity.addChild(model)

                    let newBounds = entity.visualBounds(relativeTo: nil)
                    if newBounds.extents.x > 0 {
                        entity.components.set(CollisionComponent(shapes: [.generateBox(size: newBounds.extents)]))
                    }
                } catch {
                    palaceVM.errorMessage = "Failed to load 3D model: \(error.localizedDescription)"
                }
            }
        } else {
            // Non-3D items: card or text panel
            let mesh: MeshResource
            let material: any RealityKit.Material
            switch item.displayType {
            case "text_panel":
                mesh = MeshResource.generatePlane(width: 0.3, height: 0.2)
                var mat = UnlitMaterial()
                mat.color = .init(tint: .white.withAlphaComponent(0.9))
                material = mat
            default:
                mesh = MeshResource.generateBox(width: 0.15, height: 0.2, depth: 0.005)
                var mat = PhysicallyBasedMaterial()
                mat.baseColor = .init(tint: .white)
                material = mat
            }
            entity.components.set(ModelComponent(mesh: mesh, materials: [material]))
            let bounds = entity.visualBounds(relativeTo: nil)
            entity.components.set(CollisionComponent(shapes: [.generateBox(size: bounds.extents)]))
        }

        entity.scale = SIMD3<Float>(repeating: item.scale)

        return entity
    }

    // MARK: - Material Fix (Polyhaven MaterialX → RealityKit PBR)

    /// Replace all materials on entity tree with PhysicallyBasedMaterial using downloaded textures.
    @MainActor
    private static func applyDownloadedTextures(to entity: Entity, from assetURL: URL) {
        let parentDir = assetURL.deletingLastPathComponent()
        let texturesDir = parentDir.appendingPathComponent("textures")
        
        var diffuseURL: URL? = nil
        var roughnessURL: URL? = nil
        
        let fm = FileManager.default
        if let files = try? fm.contentsOfDirectory(at: texturesDir, includingPropertiesForKeys: nil) {
            diffuseURL = files.first { $0.lastPathComponent.contains("diff") || $0.lastPathComponent.contains("color") }
            roughnessURL = files.first { $0.lastPathComponent.contains("rough") }
        }

        let diffuseTex = diffuseURL.flatMap { try? TextureResource.load(contentsOf: $0) }
        let roughnessTex = roughnessURL.flatMap { try? TextureResource.load(contentsOf: $0) }

        applyMaterialsRecursive(to: entity, diffuse: diffuseTex, roughness: roughnessTex)
    }

    private static func applyMaterialsRecursive(to entity: Entity, diffuse: TextureResource?, roughness: TextureResource?) {
        if var mc = entity.components[ModelComponent.self] {
            let materialCount = max(1, mc.materials.count)
            mc.materials = (0..<materialCount).enumerated().map { index, _ in
                var mat = PhysicallyBasedMaterial()
                if let diffuse {
                    // Bright white tint lets the full texture color through
                    mat.baseColor = .init(tint: .white, texture: .init(diffuse))
                } else {
                    // No diffuse texture — use a warm, visible tone
                    let brightness: CGFloat = 0.85 + CGFloat(index % 3) * 0.05
                    mat.baseColor = .init(tint: UIColor(white: brightness, alpha: 1.0))
                }
                if let roughness {
                    mat.roughness = .init(texture: .init(roughness))
                } else {
                    mat.roughness = .init(floatLiteral: 0.6)
                }
                mat.metallic = .init(floatLiteral: 0.0)
                // Boost brightness with a subtle emissive so models aren't dark in dim environments
                mat.emissiveColor = .init(color: UIColor(white: 0.15, alpha: 1.0))
                mat.emissiveIntensity = 0.3
                return mat as any RealityKit.Material
            }
            entity.components.set(mc)
        }
        for child in entity.children {
            applyMaterialsRecursive(to: child, diffuse: diffuse, roughness: roughness)
        }
    }

    // MARK: - Interactions

    private func saveMemoryNote(_ note: ObjectSceneMemoryNote, for item: PalaceItem) async {
        let trimmedObjectName = note.objectName.trimmingCharacters(in: .whitespacesAndNewlines)
        let success = await palaceVM.updateMemoryText(
            itemId: item.id,
            customText: note.toCustomText(),
            label: trimmedObjectName.isEmpty ? item.label : trimmedObjectName
        )

        if success {
            memorySaveError = nil
            if let refreshed = palaceVM.items.first(where: { $0.id == item.id }) {
                memoryTargetItem = refreshed
            }
            appModel.palaceItemRefreshTrigger += 1
        } else {
            memorySaveError = palaceVM.errorMessage ?? "Failed to save memory note."
        }
    }

    private func selectItem(_ item: PalaceItem) {
        selectedItem = item
        showReviewOverlay = true
    }

    private func handleTap(on entity: Entity) {
        guard let highlight = entity.components[HighlightComponent.self] else { return }
        if let item = palaceVM.items.first(where: { $0.id == highlight.itemId }) {
            selectItem(item)
        }
    }

    @State private var dragStartPosition: SIMD3<Float>?

    private func handleDrag(entity: Entity, translation: Vector3D) {
        if dragStartPosition == nil {
            dragStartPosition = entity.position
        }
        let t = SIMD3<Float>(Float(translation.x), Float(translation.y), Float(translation.z)) * 0.001
        entity.position = (dragStartPosition ?? .zero) + t
    }

    private func handleDragEnd(entity: Entity) {
        guard let highlight = entity.components[HighlightComponent.self] else { return }
        let pos = entity.position
        Task {
            await palaceVM.updatePosition(itemId: highlight.itemId, x: pos.x, y: pos.y, z: pos.z)
        }
        dragStartPosition = nil
    }

    // MARK: - Texture Application

    /// Downloads only the diffuse/colour JPG from the thumbnail endpoint
    /// (already proxied by our backend) and applies it as a PBR material.
    /// This gives correct colours without downloading all texture maps.
    @MainActor
    private static func applyPolyhavenTexture(assetId: String, to entity: Entity) async {
        let cacheKey = "diff_\(assetId)_512.jpg"
        let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("AssetCache", isDirectory: true)
        let cachedFile = cacheDir.appendingPathComponent(cacheKey)

        var diffuseURL: URL? = nil

        // Check cached texture — but reject zero-byte files (failed previous download)
        if FileManager.default.fileExists(atPath: cachedFile.path),
           let size = try? FileManager.default.attributesOfItem(atPath: cachedFile.path)[.size] as? Int,
           size > 1024 {
            diffuseURL = cachedFile
        } else {
            try? FileManager.default.removeItem(at: cachedFile)
            // Download diffuse thumbnail from our backend proxy (small JPG)
            let urlStr = "\(BackendConfig.baseURL)/api/models/\(assetId)/thumbnail"
            if let url = URL(string: urlStr) {
                var request = URLRequest(url: url)
                if let token = KeychainService.get(forKey: "access_token") {
                    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                }
                if let (tmp, _) = try? await URLSession.shared.download(for: request) {
                    try? FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
                    try? FileManager.default.moveItem(at: tmp, to: cachedFile)
                    diffuseURL = cachedFile
                }
            }
        }

        guard let diffuseURL,
              let texture = try? await TextureResource(contentsOf: diffuseURL) else {
            // Fallback: neutral grey so model is at least visible
            applyFallbackMaterial(to: entity)
            return
        }

        applyTextureRecursive(texture: texture, to: entity)
    }

    private static func applyTextureRecursive(texture: TextureResource, to entity: Entity) {
        if var mc = entity.components[ModelComponent.self] {
            let count = max(1, mc.materials.count)
            mc.materials = (0..<count).map { _ in
                var mat = PhysicallyBasedMaterial()
                mat.baseColor = .init(tint: .white, texture: .init(texture))
                mat.roughness = .init(floatLiteral: 0.7)
                mat.metallic  = .init(floatLiteral: 0.0)
                return mat as any RealityKit.Material
            }
            entity.components.set(mc)
        }
        for child in entity.children {
            applyTextureRecursive(texture: texture, to: child)
        }
    }

    private static func applyFallbackMaterial(to entity: Entity) {
        if var mc = entity.components[ModelComponent.self] {
            let count = max(1, mc.materials.count)
            mc.materials = (0..<count).map { _ in
                var mat = PhysicallyBasedMaterial()
                mat.baseColor = .init(tint: UIColor(white: 0.85, alpha: 1))
                mat.roughness = .init(floatLiteral: 0.7)
                mat.metallic  = .init(floatLiteral: 0.0)
                return mat as any RealityKit.Material
            }
            entity.components.set(mc)
        }
        for child in entity.children {
            applyFallbackMaterial(to: child)
        }
    }
}
#endif
