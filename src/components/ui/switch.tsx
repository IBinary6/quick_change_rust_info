import * as React from "react"
import { cn } from "@/lib/utils"

interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, ...props }, ref) => {
    return (
      <label className={cn("inline-flex items-center cursor-pointer relative group", className)}>
        <input type="checkbox" className="sr-only peer" ref={ref} {...props} />
        <div className="w-12 h-6 bg-input/50 backdrop-blur-sm rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500/50 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-purple-600 neon-switch shadow-inner group-hover:shadow-lg transition-all"></div>
      </label>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }
