import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDeviceCode, pollForToken, logout, isAuthenticated } from '../lib/oauth'
import { PlaySquare } from 'lucide-react'

export default function LoginPage() {
  const navigate = useNavigate()
  const [userCode, setUserCode] = useState<string>('')
  const [verificationUrl, setVerificationUrl] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/')
    }
  }, [navigate])

  const handleLogin = useCallback(async () => {
    setLoading(true)
    setError(null)
    logout()
    cancelledRef.current = false

    try {
      const authState = await getDeviceCode()
      setUserCode(authState.userCode)
      setVerificationUrl(authState.verificationUrl)

      await pollForToken(
        () => {
          navigate('/')
        },
        (err) => {
          setError(err)
        },
        () => cancelledRef.current
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start login process')
    } finally {
      setLoading(false)
    }
  }, [navigate])

  const handleCancel = useCallback(() => {
    cancelledRef.current = true
    logout()
    setUserCode('')
    setVerificationUrl('')
  }, [])

  const handleBack = useCallback(() => {
    navigate('/')
  }, [navigate])

  return (
    <div className="flex items-center justify-center py-20">
      <div className="max-w-md w-full">
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.4)]">
              <PlaySquare size={28} className="text-white fill-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-6 text-center text-zinc-100">Sign in to DeckTube</h1>

          {!userCode ? (
            <div className="space-y-4">
              <p className="text-zinc-400 text-center text-sm">
                Sign in to access personalized recommendations and your YouTube subscriptions.
              </p>

              {error && (
                <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-500 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? 'Loading...' : 'Sign in with YouTube'}
              </button>

              <button
                onClick={handleBack}
                className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded-xl text-sm font-medium transition-colors"
              >
                Back to Home
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-zinc-400 mb-4 text-sm">
                  1. Go to <span className="text-white font-medium">{verificationUrl}</span>
                </p>
                <p className="text-zinc-400 mb-4 text-sm">2. Enter this code:</p>
                <div className="bg-zinc-800 border border-white/10 rounded-2xl p-6 mb-4">
                  <span className="text-3xl font-mono font-bold tracking-wider text-zinc-100">{userCode}</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <p className="text-zinc-500 text-sm">
                    Waiting for authorization...
                  </p>
                </div>
              </div>

              <button
                onClick={handleCancel}
                className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
