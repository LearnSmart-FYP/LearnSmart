import { useToast } from "../../contexts"
import { AnalogiesMetaphors } from "../../components/comprehension/AnalogiesMetaphors"

export function AnalogiesMetaphorsPage() {
  const { showToast } = useToast()

  return (
    <div className="space-y-6">
      <AnalogiesMetaphors onToast={showToast} />
    </div>
  )
}
