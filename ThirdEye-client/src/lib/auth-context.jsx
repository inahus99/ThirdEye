import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
 import axios from 'axios';
 
 const AuthCtx = createContext(null);
 export const useAuth = () => useContext(AuthCtx);
 
 // Configure a custom axios instance for the API
 const api = axios.create({
   baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
 });
 
 // Intercept requests to add the auth token
 api.interceptors.request.use((config) => {
   const token = localStorage.getItem('thirdeye_token');
   if (token) {
     config.headers.Authorization = `Bearer ${token}`;
   }
   return config;
 });

 export function AuthProvider({ children }) {
   const [user, setUser]   = useState(null);
   const [ready, setReady] = useState(false);
 
   useEffect(() => {
     const initAuth = async () => {
       const token = localStorage.getItem('thirdeye_token');
       if (token) {
         try {
           const { data } = await api.get('/api/auth/me');
           setUser(data.user);
         } catch (e) {
           console.error('[auth] Invalid/expired token:', e);
           localStorage.removeItem('thirdeye_token');
           setUser(null);
         }
       }
       setReady(true);
     };
     initAuth();
   }, []);

   // helpers with consistent error surfacing
   const login = async (email, password) => {
     try {
       const { data } = await api.post('/api/auth/login', { email, password });
       localStorage.setItem('thirdeye_token', data.token);
       setUser(data.user);
       return data;
     } catch (err) {
       throw new Error(err.response?.data?.error || 'Login failed');
     }
   };
 
   const register = async (email, password) => {
     try {
       const { data } = await api.post('/api/auth/register', { email, password });
       localStorage.setItem('thirdeye_token', data.token);
       setUser(data.user);
       return data;
     } catch (err) {
       throw new Error(err.response?.data?.error || 'Registration failed');
     }
   };
 
   const logout = async () => {
     localStorage.removeItem('thirdeye_token');
     setUser(null);
   };

  const value = useMemo(
     () => ({
       user,
       ready,
       isAuthenticated: !!user,
       login,
       register,
       logout,
       api, // Expose configured api instance
     }),
     [user, ready]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
