import React, { createContext, useState, useEffect } from 'react';
import axios from '../config/axios';

// Create the UserContext
export const UserContext = createContext();

// Create a provider component
export const UserProvider = ({ children }) => {
    const [ user, setUser ] = useState(null);
    const [ isAuthLoading, setIsAuthLoading ] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token && !user) {
            axios.get('/users/profile')
                .then((res) => {
                    setUser(res.data.user);
                })
                .catch(() => {
                    localStorage.removeItem('token');
                    setUser(null);
                })
                .finally(() => {
                    setIsAuthLoading(false);
                });
        } else {
            setIsAuthLoading(false);
        }
    }, []);

    return (
        <UserContext.Provider value={{ user, setUser, isAuthLoading }}>
            {children}
        </UserContext.Provider>
    );
};