import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth-context';
import { Lock, Mail, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import { UserRole } from '@necessity/shared';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const data = await login(identifier, password, rememberMe);
      if (
        data.user.role === UserRole.SUPER_ADMIN ||
        data.user.role === UserRole.ADMIN ||
        data.user.role === UserRole.ACCOUNTS_MANAGER ||
        data.user.role === UserRole.SALES_MANAGER
      ) {
        navigate('/admin');
      } else {
        navigate('/retailer');
      }
    } catch (err: any) {
      const firstDetail = err.response?.data?.error?.details?.[0];
      const is500 = err.response?.status === 500;
      const msg =
        (firstDetail ? `${firstDetail.message}` : null) ||
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        (is500 ? 'Server is starting up or temporarily unavailable. Please retry in a moment.' : null) ||
        err.message ||
        'Login failed. Please check your credentials.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center sm:px-6 lg:px-8">

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm rounded-2xl sm:px-10 border border-[#F0E0D5]">
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start space-x-3 text-red-700 text-sm">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
              {/* Existing Logo Card */}
              <div className="inline-flex items-center justify-center bg-white rounded-2xl shadow-xs">
                <img src="/img.jpeg" alt="Necessity India" className="h-37 w-[210px] pb-5" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#292929] mb-1.5">
                Email Address
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#737373]">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin@necessityindia.com"
                  className="block w-full pl-10 pr-3 py-2.5 bg-white border border-[#F0E0D5] rounded-lg text-[#292929] placeholder-[#737373] text-sm focus:outline-none focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732] transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#292929]">
                  Password
                </label>
              </div>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#737373]">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="block w-full pl-10 pr-10 py-2.5 bg-white border border-[#F0E0D5] rounded-lg text-[#292929] placeholder-[#737373] text-sm focus:outline-none focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#737373] hover:text-[#292929]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 text-sm text-[#737373] cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded bg-white border-[#F0E0D5] text-[#F47732] focus:ring-[#F47732] h-4 w-4"
                />
                <span>Remember this device</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-[#F47732] hover:bg-[#E95B2A] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F47732] disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Log In...' : 'Log In'}
              {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
