import { useToast } from "../../contexts"
import { GuidedBrainstorm } from "../../components/comprehension/GuidedBrainstorm"

export function GuidedBrainstormPage() {
  const { showToast } = useToast()

  return (
    <div className="space-y-6">
      <GuidedBrainstorm onToast={showToast} />
    </div>
  )
}
