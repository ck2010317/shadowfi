import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowRightLeft, 
  Rocket, 
  Lock,
  ChevronRight,
  Sparkles,
  Shield,
  Key,
  Zap,
  CheckCircle
} from 'lucide-react';

const features = [
  {
    icon: ArrowRightLeft,
    title: 'Anonymous Swap',
    description: 'Swap any token without linking your wallet. Relayer executes trades so your identity stays hidden.',
    href: '/swap',
    color: 'from-cyan-500 to-blue-500',
    stats: 'Live on Mainnet',
    badge: '✓ Working'
  },
  {
    icon: Rocket,
    title: 'Launch + Pre-Buy',
    description: 'Launch tokens and instantly buy into stealth wallets. Beat snipers with distributed buys.',
    href: '/launch',
    color: 'from-orange-500 to-red-500',
    stats: 'Live on Mainnet',
    badge: '✓ Working'
  },
];

const howItWorks = [
  {
    step: '1',
    title: 'Anonymous Swap',
    points: [
      'You send SOL to our relayer',
      'Relayer swaps to your chosen token',
      'Tokens sent to YOUR stealth address',
      'No link between your wallet & purchase'
    ]
  },
  {
    step: '2', 
    title: 'Launch + Pre-Buy',
    points: [
      'Create token via Anoncoin API',
      'Instantly buy into multiple stealth wallets',
      'Get private keys for all wallets',
      'You control tokens, nobody knows it\'s you'
    ]
  }
];

export default function Home() {
  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="relative pt-12 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-shadow-500/10 border border-shadow-500/30 mb-8"
          >
            <Sparkles className="w-4 h-4 text-shadow-400" />
            <span className="text-sm font-medium text-shadow-400">Built for Anoncoin Hackathon</span>
          </motion.div>

          {/* Main heading */}
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            <span className="gradient-text">ShadowFi</span>
            <br />
            <span className="text-white">Privacy Tooling for Tokens</span>
          </h1>

          <p className="text-xl text-dark-400 max-w-2xl mx-auto mb-8">
            Anonymous swaps and private token launches on Solana mainnet.
            <br />
            <span className="text-neon-green font-semibold">Both features live and working.</span>
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/swap">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-primary flex items-center gap-2"
              >
                <ArrowRightLeft className="w-5 h-5" />
                Anonymous Swap
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            </Link>
            <Link to="/launch">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-neon flex items-center gap-2"
              >
                <Rocket className="w-5 h-5" />
                Launch + Pre-Buy
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Live Stats */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-glow text-center"
          >
            <div className="text-3xl md:text-4xl font-bold text-neon-green">
              ✓
            </div>
            <div className="text-sm text-dark-400 mt-1">Mainnet Live</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card-glow text-center"
          >
            <div className="text-3xl md:text-4xl font-bold gradient-text">
              3+
            </div>
            <div className="text-sm text-dark-400 mt-1">Anon Swaps Done</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card-glow text-center"
          >
            <div className="text-3xl md:text-4xl font-bold gradient-text">
              2+
            </div>
            <div className="text-sm text-dark-400 mt-1">Tokens Launched</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card-glow text-center"
          >
            <div className="text-3xl md:text-4xl font-bold text-neon-green">
              100%
            </div>
            <div className="text-sm text-dark-400 mt-1">Privacy</div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section>
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Working Features</h2>
          <p className="text-dark-400 max-w-xl mx-auto">
            Both features are live on Solana mainnet. No simulations, no demos - real privacy.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link to={feature.href}>
                <motion.div
                  whileHover={{ scale: 1.02, y: -5 }}
                  className="card-glow h-full relative overflow-hidden group"
                >
                  {/* Gradient overlay on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                  
                  <div className="relative">
                    {/* Badge */}
                    <div className="absolute top-0 right-0">
                      <span className="px-3 py-1 rounded-full bg-neon-green/20 text-neon-green text-xs font-semibold">
                        {feature.badge}
                      </span>
                    </div>

                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`}>
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>

                    {/* Content */}
                    <h3 className="text-xl font-semibold mb-2 group-hover:text-shadow-400 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-dark-400 text-sm mb-4">
                      {feature.description}
                    </p>

                    {/* Stats badge */}
                    <div className="flex items-center justify-between">
                      <span className="privacy-badge">
                        <Lock className="w-3 h-3" />
                        {feature.stats}
                      </span>
                      <ChevronRight className="w-5 h-5 text-dark-400 group-hover:text-shadow-400 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </motion.div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="relative">
        <div className="card p-8 md:p-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-dark-400">
              Real privacy through relayer-based execution
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {howItWorks.map((item, index) => (
              <div key={item.title} className="bg-dark-100 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-shadow-500/20 flex items-center justify-center text-shadow-400 font-bold">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                </div>
                <ul className="space-y-2">
                  {item.points.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-dark-400">
                      <CheckCircle className="w-4 h-4 text-neon-green mt-0.5 flex-shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Privacy Features */}
      <section>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="card-glow text-center">
            <Shield className="w-12 h-12 text-shadow-400 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Stealth Addresses</h3>
            <p className="text-sm text-dark-400">
              Every swap creates a new stealth wallet. You get the private key to import anywhere.
            </p>
          </div>
          <div className="card-glow text-center">
            <Key className="w-12 h-12 text-neon-green mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Your Keys</h3>
            <p className="text-sm text-dark-400">
              Export private keys to Phantom, Solflare, or any wallet. Full control of your tokens.
            </p>
          </div>
          <div className="card-glow text-center">
            <Zap className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Beat Snipers</h3>
            <p className="text-sm text-dark-400">
              Pre-buy executes instantly after launch. Multiple wallets, nobody knows it's you.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative">
        <div className="animated-border rounded-2xl">
          <div className="bg-dark-50 rounded-2xl p-8 md:p-12 text-center">
            <h2 className="text-3xl font-bold mb-4">Try It Now</h2>
            <p className="text-dark-400 mb-8 max-w-xl mx-auto">
              Both features work on Solana mainnet. Connect your wallet and experience real privacy.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link to="/swap">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="btn-primary"
                >
                  Try Anonymous Swap
                </motion.button>
              </Link>
              <Link to="/launch">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="btn-neon"
                >
                  Launch a Token
                </motion.button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
