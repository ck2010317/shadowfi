import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Shield, 
  Moon, 
  Waves, 
  ArrowRightLeft, 
  Rocket, 
  UserCheck, 
  Zap,
  Menu,
  X,
  Eye,
  EyeOff,
  Wallet
} from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import { usePrivacy } from '../contexts/PrivacyContext';

const navItems = [
  { path: '/swap', label: 'Anonymous Swap', icon: ArrowRightLeft },
  { path: '/launch', label: 'Launch Token', icon: Rocket },
];

export default function Layout({ children }) {
  const location = useLocation();
  const { connected, connect, disconnect, shortenedAddress, balance, address, isLoading } = useWallet();
  const { privacyLevel, setPrivacyLevel } = usePrivacy();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const [showWalletInfo, setShowWalletInfo] = useState(false);

  const privacyLevels = [
    { value: 'standard', label: 'Standard', color: 'text-yellow-500' },
    { value: 'enhanced', label: 'Enhanced', color: 'text-blue-500' },
    { value: 'maximum', label: 'Maximum', color: 'text-neon-green' },
  ];

  return (
    <div className="min-h-screen cyber-bg">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-shadow-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-neon-green/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-dark-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <motion.div
                className="relative"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Waves className="w-8 h-8 text-shadow-500" />
                <div className="absolute inset-0 bg-shadow-500/30 blur-lg" />
              </motion.div>
              <span className="text-xl font-bold gradient-text">ShadowFi</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-shadow-500/20 text-shadow-400'
                        : 'text-dark-500 hover:text-white hover:bg-dark-100'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-4">
              {/* Privacy Level Indicator */}
              <div className="relative">
                <button
                  onClick={() => setShowPrivacySettings(!showPrivacySettings)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-100 border border-dark-200 hover:border-shadow-500/50 transition-all"
                >
                  <EyeOff className="w-4 h-4 text-neon-green" />
                  <span className="text-sm font-medium text-neon-green capitalize">
                    {privacyLevel}
                  </span>
                </button>

                {showPrivacySettings && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full right-0 mt-2 w-48 p-2 glass rounded-xl"
                  >
                    <p className="text-xs text-dark-400 mb-2 px-2">Privacy Level</p>
                    {privacyLevels.map((level) => (
                      <button
                        key={level.value}
                        onClick={() => {
                          setPrivacyLevel(level.value);
                          setShowPrivacySettings(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-all ${
                          privacyLevel === level.value
                            ? 'bg-dark-100'
                            : 'hover:bg-dark-100'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${
                          level.value === 'standard' ? 'bg-yellow-500' :
                          level.value === 'enhanced' ? 'bg-blue-500' : 'bg-neon-green'
                        }`} />
                        <span className={level.color}>{level.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>

              {/* Wallet Button */}
              {connected ? (
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex flex-col items-end">
                    <span className="text-xs text-dark-400">Balance</span>
                    <span className="text-sm font-mono text-white">
                      {balance.toFixed(2)} SOL
                    </span>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setShowWalletInfo(!showWalletInfo)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-100 border border-dark-200 hover:border-shadow-500/50 transition-all"
                    >
                      <Wallet className="w-4 h-4 text-shadow-400" />
                      <span className="text-sm font-medium">{shortenedAddress}</span>
                    </button>

                    {/* Wallet Info Popup */}
                    {showWalletInfo && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute top-full right-0 mt-2 w-80 p-4 glass rounded-xl border border-dark-200"
                      >
                        <p className="text-xs text-dark-400 mb-2">Connected Wallet Address</p>
                        <div className="bg-dark-100 rounded-lg p-3 mb-3">
                          <p className="text-sm font-mono text-white break-all">
                            {address}
                          </p>
                        </div>
                        <div className="flex items-center justify-between mb-4 p-2 bg-dark-100/50 rounded-lg">
                          <span className="text-sm text-dark-400">Balance:</span>
                          <span className="text-sm font-bold text-neon-green">{balance.toFixed(4)} SOL</span>
                        </div>
                        <p className="text-xs text-dark-400 mb-3">
                          💡 To switch wallets: Open Phantom → select different account → return here and disconnect, then reconnect.
                        </p>
                        <button
                          onClick={() => {
                            disconnect();
                            setShowWalletInfo(false);
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all text-sm font-medium"
                        >
                          Disconnect Wallet
                        </button>
                      </motion.div>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  onClick={connect}
                  disabled={isLoading}
                  className={`btn-neon flex items-center gap-2 transition-all ${
                    isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'
                  }`}
                >
                  <Wallet className="w-4 h-4" />
                  <span>{isLoading ? 'Connecting...' : 'Connect'}</span>
                </button>
              )}

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-dark-100"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-dark-200"
          >
            <nav className="p-4 space-y-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-shadow-500/20 text-shadow-400'
                        : 'text-dark-500 hover:text-white hover:bg-dark-100'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </motion.div>
        )}
      </header>

      {/* Main content */}
      <main className="pt-20 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
        {children}
      </main>

      {/* Footer */}
      <footer className="glass border-t border-dark-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Waves className="w-6 h-6 text-shadow-500" />
              <span className="font-semibold gradient-text">ShadowFi</span>
            </div>
            <p className="text-sm text-dark-400">
              Privacy-first memecoin infrastructure. Built for Anoncoin Hackathon.
            </p>
            <div className="flex items-center gap-2">
              <span className="privacy-badge">
                <Shield className="w-3 h-3" />
                <span>Privacy First</span>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
