export function normalizeChunkText(rawText: string): string {
  if (!rawText) return ""

  let text = rawText.replace(/\r\n|\r/g, "\n")
  text = text.replace(/\t/g, " ")

  // Fix hyphenated words broken across lines (OCR artifacts)
  text = text.replace(/(\w+)-\n(\w+)/g, "$1$2")

  // Limit consecutive newlines
  text = text.replace(/\n{3,}/g, "\n\n")

  // Merge wrapped paragraph lines but preserve structured breaks (lists, headers, dialogues, code blocks, etc.)
  text = text.replace(/([^\n])\n([^\n])/g, (_, p1, p2) => {
    // 1. Starts with bullets, numbers, or letters (e.g. -, *, 1., a), A., ○, ■)
    // 2. Starts with markdown/html tags or comments (#, <, //, >)
    // 3. Starts with dialogue speakers (Name: or 名字：)
    // 4. Starts with code block brackets ({, }, [, ])
    const isStructuredStart = /^\s*([\-\*•○●■▪✓➢]|\d+[\.\)]\s|[a-zA-Z]{1,2}[\.\)]\s|#|<|\/\/|>|[\w\u4e00-\u9fa5]{1,10}[：:]|[{}[\]])/.test(p2)
    
    // Ends with structural indicators (e.g. colon, semicolon, brackets, HTML tags)
    const isStructuredEnd = /[>}:;{]$/.test(p1.trim())

    if (isStructuredStart || isStructuredEnd) {
      return `${p1}\n${p2}`
    }
    return `${p1} ${p2}`
  })

  // Extract inline lists combined by OCR, even missing ending punctuation (e.g. "...page 2. The...")
  text = text.replace(/([a-zA-Z\u4e00-\u9fa5"'>])\s+([1-9][0-9]?[\.\)])\s+(?=[A-Z\u4e00-\u9fa5<])/g, "$1\n$2 ")
  
  // Also keep the existing punctuation matcher just in case it's a punctuation followed by a list
  text = text.replace(/([.!?])\s+([1-9][0-9]?[\.\)])\s+(?=[A-Z\u4e00-\u9fa5<])/g, "$1\n$2 ")

  // Clean redundant whitespace between words, but PRESERVE line starting indentation for code or poetry
  text = text.replace(/([^\s]) {2,}(?=[^\s])/g, "$1 ")
  text = text.replace(/ \n/g, "\n")

  return text.trim()
}
