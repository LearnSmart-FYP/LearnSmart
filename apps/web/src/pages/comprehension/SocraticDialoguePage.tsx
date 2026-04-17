import { useToast } from "../../contexts"
import { SocraticDialogue } from "../../components/comprehension/SocraticDialogue"

export function SocraticDialoguePage() {
  const { showToast } = useToast()

  return (
    <div className="space-y-6">
      <SocraticDialogue onToast={showToast} />
    </div>
  )
}
