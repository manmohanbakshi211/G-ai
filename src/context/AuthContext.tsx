import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isTeamMember: boolean;
  login: (user: User, token: string, isTeamMember?: boolean) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const storedTeamFlag = localStorage.getItem('isTeamMember');

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setIsTeamMember(storedTeamFlag === 'true');
      } catch (err) {
        console.error('Failed to parse stored user data', err);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('isTeamMember');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (newUser: User, newToken: string, teamMember: boolean = false) => {
    setUser(newUser);
    setToken(newToken);
    setIsTeamMember(teamMember);
    localStorage.setItem('user', JSON.stringify(newUser));
    localStorage.setItem('token', newToken);
    localStorage.setItem('isTeamMember', String(teamMember));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setIsTeamMember(false);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('isTeamMember');
  };

  return (
    <AuthContext.Provider value={{ user, token, isTeamMember, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
