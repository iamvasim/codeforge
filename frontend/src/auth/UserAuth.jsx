import React, { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../context/user.context'
import axios from '../config/axios'

const UserAuth = ({ children }) => {
    const { user, setUser } = useContext(UserContext)
    const [ loading, setLoading ] = useState(true)
    const token = localStorage.getItem('token')
    const navigate = useNavigate()

    useEffect(() => {
        if (!token) {
            setLoading(false)
            navigate('/login')
            return
        }

        if (!user) {
            axios.get('/users/profile')
                .then((res) => {
                    setUser(res.data.user)
                    setLoading(false)
                })
                .catch(() => {
                    localStorage.removeItem('token')
                    setUser(null)
                    setLoading(false)
                    navigate('/login')
                })
        } else {
            setLoading(false)
        }
    }, [token, user])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#080810] text-white">
                <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm text-white/60">Loading session...</span>
                </div>
            </div>
        )
    }

    return (
        <>{children}</>
    )
}

export default UserAuth