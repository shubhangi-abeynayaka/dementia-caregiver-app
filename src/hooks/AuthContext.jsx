import React, { createContext, useContext, useMemo, useState } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user] = useState({ id: 'local-user', name: 'Caregiver', email: 'caregiver@example.com' });
  const [isAuthenticated] = useState(true);
  const [isLoadingAuth] = useState(false);
  const [isLoadingPublicSettings] = useState(false);
  const [authError] = useState(null);
  const [authChecked] = useState(true);

  const value = useMemo(() => ({
    user,
    isAuthenticated,
    isLoadingAuth,
    isLoadingPublicSettings,
    authError,
    authChecked,
    logout: () => {},
    navigateToLogin: () => {},
    checkUserAuth: async () => true,
    checkAppState: async () => true
  }), [user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError, authChecked]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
