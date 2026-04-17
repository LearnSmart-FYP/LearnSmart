import { useEffect, useMemo, useState } from "react"
import { apiClient } from "../lib/api"

export type ComprehensionSubject = {
  id: string
  code: string
  name: string
}

export type ComprehensionDocument = {
  id: string
  document_name: string
  subjects?: ComprehensionSubject[]
}

type DocumentConcept = {
  id: string
  title: string
}

type UseComprehensionWorkspaceReturn = {
  loading: boolean
  subjects: ComprehensionSubject[]
  documents: ComprehensionDocument[]
  selectedSubjectId: string
  setSelectedSubjectId: (value: string) => void
  selectedDocumentId: string
  setSelectedDocumentId: (value: string) => void
  selectedDocument: ComprehensionDocument | null
  documentConceptLabels: string[]
}

export type ComprehensionWorkspace = UseComprehensionWorkspaceReturn

export function useComprehensionWorkspace(): UseComprehensionWorkspaceReturn {
  const [loading, setLoading] = useState(true)
  const [subjects, setSubjects] = useState<ComprehensionSubject[]>([])
  const [allDocuments, setAllDocuments] = useState<ComprehensionDocument[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState("")
  const [selectedDocumentId, setSelectedDocumentId] = useState("")
  const [documentConceptLabels, setDocumentConceptLabels] = useState<string[]>([])

  useEffect(() => {
    let active = true

    const load = async () => {
      setLoading(true)
      try {
        const [subjectsResult, documentsResult] = await Promise.allSettled([
          apiClient.get<ComprehensionSubject[]>("/api/subjects"),
          apiClient.get<{ documents?: ComprehensionDocument[] }>("/api/documents?page=1&page_size=100&status=completed")
        ])

        if (!active) return

        setSubjects(
          subjectsResult.status === "fulfilled" && Array.isArray(subjectsResult.value)
            ? subjectsResult.value
            : []
        )

        setAllDocuments(
          documentsResult.status === "fulfilled" && Array.isArray(documentsResult.value?.documents)
            ? documentsResult.value.documents
            : []
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  const documents = useMemo(() => {
    if (!selectedSubjectId) return allDocuments
    return allDocuments.filter((document) =>
      (document.subjects ?? []).some((subject) => subject.id === selectedSubjectId)
    )
  }, [allDocuments, selectedSubjectId])

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId]
  )

  useEffect(() => {
    if (!selectedDocumentId) {
      setDocumentConceptLabels([])
      return
    }

    let active = true

    const loadConcepts = async () => {
      try {
        const data = await apiClient.get<{ concepts?: DocumentConcept[] }>(
          `/api/documents/${selectedDocumentId}/concepts?page_size=50`
        )
        if (!active) return

        setDocumentConceptLabels(
          Array.isArray(data?.concepts)
            ? data.concepts
                .map((concept) => concept.title?.trim())
                .filter((label): label is string => Boolean(label))
            : []
        )
      } catch {
        if (!active) return
        setDocumentConceptLabels([])
      }
    }

    void loadConcepts()

    return () => {
      active = false
    }
  }, [selectedDocumentId])

  useEffect(() => {
    if (!selectedDocumentId) return
    if (documents.some((document) => document.id === selectedDocumentId)) return

    setSelectedDocumentId("")
    setDocumentConceptLabels([])
  }, [documents, selectedDocumentId])

  return {
    loading,
    subjects,
    documents,
    selectedSubjectId,
    setSelectedSubjectId,
    selectedDocumentId,
    setSelectedDocumentId,
    selectedDocument,
    documentConceptLabels
  }
}
