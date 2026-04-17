
import { deleteTemplate, duplicateTemplate, listTemplates } from "../api/gameTemplates"

interface TemplateItem {
	id: string
	name: string
	subject: string
	status: "published" | "draft" | "ready" | "archived"
	lastModified: string // YYYY-MM-DD
}

export async function handleDuplicate(id: string, setTemplates: React.Dispatch<React.SetStateAction<TemplateItem[]>>) {
	try {
		await duplicateTemplate(id)
		// Refresh the template list from backend to get the new template with correct id
		const data = await listTemplates()
		const mapped: TemplateItem[] = data.map(t => ({
			id: t.id,
			name: t.name,
			subject:
				t.subject_code && t.subject_name
					? `${t.subject_code} – ${t.subject_name}`
					: t.subject_code || t.subject_name || "(no subject)",
			status: (t.status ?? "draft") as TemplateItem["status"],
			lastModified: (t.updated_at || t.created_at).slice(0, 10),
		}))
		setTemplates(mapped)
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error("Failed to duplicate template", e)
	}
}

export async function handleDelete(id: string, setTemplates: React.Dispatch<React.SetStateAction<TemplateItem[]>>) {
	// eslint-disable-next-line no-alert
	const ok = confirm("Are you sure you want to delete this template? This action cannot be undone.")
	if (!ok) return
	try {
		await deleteTemplate(id)
		setTemplates(prev => prev.filter(t => t.id !== id))
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error("Failed to delete template", e)
	}
}
