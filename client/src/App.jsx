import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Home from './pages/Home';
import RealAnonymousSwap from './pages/RealAnonymousSwap';
import TokenLaunch from './pages/TokenLaunch';
import { WalletProvider } from './contexts/WalletContext';
import { PrivacyProvider } from './contexts/PrivacyContext';

function App() {
  return (
    <WalletProvider>
      <PrivacyProvider>
        <Router>
          <Toaster 
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#18181b',
                color: '#f4f4f5',
                border: '1px solid #3f3f46',
              },
              success: {
                iconTheme: {
                  primary: '#00ff88',
                  secondary: '#18181b',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#18181b',
                },
              },
            }}
          />
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/swap" element={<RealAnonymousSwap />} />
              <Route path="/launch" element={<TokenLaunch />} />
            </Routes>
          </Layout>
        </Router>
      </PrivacyProvider>
    </WalletProvider>
  );
}

export default App;
