import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Mail, Lock, LogIn, ArrowRight, UserCheck, UserPlus, User, X } from 'lucide-react';
import { UserProfile } from '../types';
import { MOCK_PROFILES } from '../data/profiles';

interface LoginScreenProps {
  onLogin: (user: UserProfile) => void;
  onClose?: () => void;
}

export default function LoginScreen({ onLogin, onClose }: LoginScreenProps) {
  const [activeTab, setActiveTab] = useState<'signin' | 'register'>('signin');
  
  // Sign In States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Register States
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerRole, setRegisterRole] = useState('Bespoke Wedding Client');
  const [registerBudget, setRegisterBudget] = useState('100000');
  
  // Field-specific validation error states
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const getCustomProfiles = (): UserProfile[] => {
    try {
      const saved = localStorage.getItem('villa_hotel_custom_profiles');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const newErrors: Record<string, string> = {};

    if (!trimmedEmail) {
      newErrors.email = 'Please enter your email address.';
    }
    if (!trimmedPassword) {
      newErrors.password = 'Please enter your password.';
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }

    const emailLower = trimmedEmail.toLowerCase();
    
    // Check in preloaded mock profiles
    let foundProfile = MOCK_PROFILES.find((p) => p.email.toLowerCase() === emailLower);
    
    // Check in dynamically registered profiles
    if (!foundProfile) {
      const customProfiles = getCustomProfiles();
      foundProfile = customProfiles.find((p) => p.email.toLowerCase() === emailLower);
    }

    if (foundProfile) {
      onLogin(foundProfile);
    } else {
      setFieldErrors({
        email: 'Email not registered. Please choose a Quick-Login profile below or sign up using the Register tab.',
      });
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    const trimmedName = registerName.trim();
    const trimmedEmail = registerEmail.trim();
    const parsedBudget = parseFloat(registerBudget);
    const newErrors: Record<string, string> = {};

    if (!trimmedName) {
      newErrors.registerName = 'Please enter your name.';
    }
    if (!trimmedEmail) {
      newErrors.registerEmail = 'Please enter your email address.';
    }
    if (isNaN(parsedBudget) || parsedBudget <= 0) {
      newErrors.registerBudget = 'Please enter a valid target budget greater than $0.';
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }

    const emailLower = trimmedEmail.toLowerCase();

    // Check if email already in use
    const isMockEmail = MOCK_PROFILES.some((p) => p.email.toLowerCase() === emailLower);
    const customProfiles = getCustomProfiles();
    const isCustomEmail = customProfiles.some((p) => p.email.toLowerCase() === emailLower);

    if (isMockEmail || isCustomEmail) {
      setFieldErrors({
        registerEmail: 'This email address is already registered. Please Sign In instead.',
      });
      return;
    }

    // Create new custom profile
    const newProfile: UserProfile = {
      id: `custom_${Date.now()}`,
      name: trimmedName,
      email: emailLower,
      role: registerRole,
      targetBudget: parsedBudget,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150',
    };

    try {
      customProfiles.push(newProfile);
      localStorage.setItem('villa_hotel_custom_profiles', JSON.stringify(customProfiles));
      onLogin(newProfile);
    } catch (err) {
      console.error(err);
      setFieldErrors({
        general: 'Failed to complete registration. Please try again.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#070708] flex items-center justify-center p-4 relative overflow-hidden" id="auth-gateway-container">
      {/* Premium ambient decorative glowing backgrounds */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold-premium/5 rounded-full filter blur-3xl opacity-30 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full filter blur-3xl opacity-25 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6"
      >
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-dark-text-tertiary hover:text-dark-text-primary hover:bg-dark-input/60 rounded-lg transition-all cursor-pointer"
            id="close-login-btn"
            title="Cancel and continue as guest"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1 bg-gold-premium/10 border border-gold-premium/25 text-gold-premium text-[10px] uppercase tracking-widest font-black px-3 py-1 rounded-full">
            <Sparkles className="w-3.5 h-3.5" /> Luxury Gateway Planner
          </div>
          <h1 className="font-serif font-light text-2xl text-dark-text-primary uppercase tracking-wider mt-2">
            Villa &amp; Vale
          </h1>
          <p className="text-xs text-dark-text-tertiary">
            Demo portal — password is not verified. Any non-empty password works with a known email.
            Guest plans can be brought onto an account at sign-in.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-2 bg-dark-input/60 border border-dark-border p-1 rounded-xl">
          <button
            onClick={() => {
              setActiveTab('signin');
              setFieldErrors({});
            }}
            className={`py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'signin'
                ? 'bg-gold-premium text-[#0A0A0A]'
                : 'text-dark-text-secondary hover:text-dark-text-primary'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" /> Sign In
          </button>
          <button
            onClick={() => {
              setActiveTab('register');
              setFieldErrors({});
            }}
            className={`py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'register'
                ? 'bg-gold-premium text-[#0A0A0A]'
                : 'text-dark-text-secondary hover:text-dark-text-primary'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" /> Register
          </button>
        </div>

        {activeTab === 'signin' ? (
          /* Sign In Form */
          <form onSubmit={handleSignIn} noValidate className="space-y-4">
            <div>
              <label htmlFor="login-email-input" className="block text-[10px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-dark-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sophia@amalfiwedding.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-dark-input border border-dark-border rounded-xl text-xs font-medium text-dark-text-primary placeholder-dark-text-tertiary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
                />
              </div>
              {fieldErrors.email && (
                <span className="text-[10px] text-amber-500 font-semibold mt-1 block leading-normal">
                  {fieldErrors.email}
                </span>
              )}
            </div>

            <div>
              <label htmlFor="login-password-input" className="block text-[10px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-dark-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-dark-input border border-dark-border rounded-xl text-xs font-medium text-dark-text-primary placeholder-dark-text-tertiary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
                />
              </div>
              {fieldErrors.password && (
                <span className="text-[10px] text-amber-500 font-semibold mt-1 block leading-normal">
                  {fieldErrors.password}
                </span>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gold-premium hover:bg-gold-hover text-[#0A0A0A] rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <LogIn className="w-4 h-4 text-dark-bg" />
              <span>Sign In to Planner</span>
            </button>
          </form>
        ) : (
          /* Register Form */
          <form onSubmit={handleRegister} noValidate className="space-y-4">
            <div>
              <label htmlFor="register-name-input" className="block text-[10px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1">
                Full Name / Event Title
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-dark-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="register-name-input"
                  type="text"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  placeholder="e.g. Julian &amp; Clara"
                  className="w-full pl-10 pr-4 py-2.5 bg-dark-input border border-dark-border rounded-xl text-xs font-medium text-dark-text-primary placeholder-dark-text-tertiary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
                />
              </div>
              {fieldErrors.registerName && (
                <span className="text-[10px] text-amber-500 font-semibold mt-1 block leading-normal">
                  {fieldErrors.registerName}
                </span>
              )}
            </div>

            <div>
              <label htmlFor="register-email-input" className="block text-[10px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-dark-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="register-email-input"
                  type="email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  placeholder="e.g. julian@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-dark-input border border-dark-border rounded-xl text-xs font-medium text-dark-text-primary placeholder-dark-text-tertiary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
                />
              </div>
              {fieldErrors.registerEmail && (
                <span className="text-[10px] text-amber-500 font-semibold mt-1 block leading-normal">
                  {fieldErrors.registerEmail}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="register-role-select" className="block text-[10px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1">
                  Planner Role
                </label>
                <select
                  id="register-role-select"
                  value={registerRole}
                  onChange={(e) => setRegisterRole(e.target.value)}
                  className="w-full px-3 py-2.5 bg-dark-input border border-dark-border rounded-xl text-xs font-medium text-dark-text-primary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
                >
                  <option value="Bespoke Wedding Client">Wedding Couple</option>
                  <option value="Corporate Event Planner">Corporate Planner</option>
                  <option value="Independent Agent">Independent Planner</option>
                </select>
              </div>

              <div>
                <label htmlFor="register-budget-input" className="block text-[10px] uppercase tracking-wider font-bold text-dark-text-secondary mb-1">
                  Budget Cap ($)
                </label>
                <input
                  id="register-budget-input"
                  type="number"
                  value={registerBudget}
                  onChange={(e) => setRegisterBudget(e.target.value)}
                  placeholder="100000"
                  className="w-full px-3 py-2.5 bg-dark-input border border-dark-border rounded-xl text-xs font-medium text-dark-text-primary placeholder-dark-text-tertiary focus:outline-none focus:ring-1 focus:ring-gold-premium focus:border-gold-premium"
                />
                {fieldErrors.registerBudget && (
                  <span className="text-[10px] text-amber-500 font-semibold mt-1 block leading-normal">
                    {fieldErrors.registerBudget}
                  </span>
                )}
              </div>
            </div>

            {fieldErrors.general && (
              <span className="text-[10px] text-amber-500 font-semibold mt-1 block leading-normal">
                {fieldErrors.general}
              </span>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-gold-premium hover:bg-gold-hover text-[#0A0A0A] rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <UserPlus className="w-4 h-4 text-dark-bg" />
              <span>Create Account &amp; Plan</span>
            </button>
          </form>
        )}

        <div className="relative flex py-2 items-center">
          <div className="grow border-t border-dark-border/40"></div>
          <span className="shrink mx-4 text-[9px] text-dark-text-tertiary uppercase tracking-widest font-black">
            Quick Login Profiles
          </span>
          <div className="grow border-t border-dark-border/40"></div>
        </div>

        {/* Quick Profiles grid list */}
        <div className="grid grid-cols-1 gap-2.5">
          {MOCK_PROFILES.map((profile) => (
            <button
              key={profile.id}
              onClick={() => onLogin(profile)}
              className="w-full flex items-center justify-between p-3 bg-dark-input/40 border border-dark-border hover:border-gold-premium/40 hover:bg-dark-input/70 rounded-2xl cursor-pointer text-left transition-all group"
            >
              <div className="flex items-center gap-3">
                <img
                  src={profile.avatar}
                  alt={profile.name}
                  className="w-9 h-9 rounded-full object-cover border border-dark-border/60"
                />
                <div>
                  <h4 className="text-xs font-bold text-dark-text-primary leading-tight group-hover:text-gold-premium transition-colors">
                    {profile.name}
                  </h4>
                  <span className="text-[10px] text-dark-text-tertiary uppercase tracking-wide font-semibold block mt-0.5">
                    {profile.role}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-gold-premium transition-colors pr-1">
                <UserCheck className="w-3.5 h-3.5" /> Login <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
