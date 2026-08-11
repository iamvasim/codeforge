import { useState, useContext } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from '../config/axios'
import { UserContext } from '../context/user.context'

const Login = () => {
    const [ email, setEmail ] = useState('')
    const [ password, setPassword ] = useState('')
    const [ error, setError ] = useState('')
    const [ isLoading, setIsLoading ] = useState(false)

    const { setUser } = useContext(UserContext)
    const navigate = useNavigate()

    function submitHandler(e) {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        axios.post('/users/login', {
            email,
            password
        }).then((res) => {
            localStorage.setItem('token', res.data.token)
            setUser(res.data.user)
            navigate('/')
        }).catch((err) => {
            const errorMsg = err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Login failed. Please try again.'
            setError(errorMsg)
        }).finally(() => {
            setIsLoading(false)
        })
    }

    return (
        <div className="relative min-h-screen flex items-center justify-center bg-[#080810] text-[#f4f4f5] font-sans px-4 overflow-hidden">
            {/* Ambient Background Glows */}
            <div className='absolute top-[-120px] left-[-120px] w-[520px] h-[520px] rounded-full bg-violet-700/20 blur-[110px] pointer-events-none' />
            <div className='absolute bottom-[-120px] right-[-120px] w-[520px] h-[420px] rounded-full bg-fuchsia-700/15 blur-[110px] pointer-events-none' />

            <div className="relative w-full max-w-md px-4 z-10">
                <div className="glass-modal p-8 rounded-2xl shadow-2xl space-y-6">
                    <div className="text-center space-y-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-violet-500/25">
                            <i className="ri-flashlight-line text-white text-xl"></i>
                        </div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">Welcome Back</h2>
                        <p className="text-sm text-zinc-400">Sign in to your CodeForge workspace</p>
                    </div>

                    {error && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                            <i className="ri-error-warning-line text-base text-red-400 shrink-0"></i>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={submitHandler} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold uppercase font-mono text-zinc-400 mb-1.5 ml-1" htmlFor="email">Email Address</label>
                            <input
                                onChange={(e) => setEmail(e.target.value)}
                                value={email}
                                type="email"
                                id="email"
                                className="w-full bg-[#14141a] border border-white/10 p-3 px-4 rounded-xl text-white text-sm placeholder-zinc-500 outline-none focus:border-violet-500 transition-all"
                                placeholder="developer@example.com"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase font-mono text-zinc-400 mb-1.5 ml-1" htmlFor="password">Password</label>
                            <input
                                onChange={(e) => setPassword(e.target.value)}
                                value={password}
                                type="password"
                                id="password"
                                className="w-full bg-[#14141a] border border-white/10 p-3 px-4 rounded-xl text-white text-sm placeholder-zinc-500 outline-none focus:border-violet-500 transition-all"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold text-sm shadow-lg shadow-violet-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                        >
                            {isLoading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    <p className="text-center text-xs text-zinc-400 pt-1">
                        Don't have an account? <Link to="/register" className="text-violet-400 hover:text-violet-300 font-semibold transition-colors">Create account</Link>
                    </p>
                </div>
            </div>
        </div>
    )
}

export default Login