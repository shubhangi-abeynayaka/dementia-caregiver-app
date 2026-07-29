import { useEffect, useState } from 'react'

export function Toaster() {
  const [message, setMessage] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setMessage(''), 3000)
    return () => clearTimeout(timer)
  }, [message])

  if (!message) return null

  return (
    <div className="fixed bottom-4 right-4 max-w-xs rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
      {message}
    </div>
  )
}

export default Toaster
