import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/api';
import {
  Building2,
  User,
  Phone,
  Mail,
  Lock,
  MapPin,
  FileText,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

export const WholesaleRegisterScreen: React.FC = () => {
  const navigate = useNavigate();

  const [businessName, setBusinessName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Address
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [stateCode, setStateCode] = useState('27');
  const [pincode, setPincode] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (phone.trim().length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.post('/auth/register', {
        businessName: businessName.trim(),
        tradeName: tradeName.trim() || undefined,
        gstin: gstin.trim().toUpperCase() || undefined,
        pan: pan.trim().toUpperCase() || undefined,
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase() || undefined,
        password,
        billingAddress: {
          street: street.trim(),
          city: city.trim(),
          state: state.trim(),
          stateCode: stateCode.trim() || '27',
          pincode: pincode.trim(),
          isDefault: true,
        },
      });

      setIsSuccess(true);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error?.message ||
        err.message ||
        'Registration failed. Please check your information.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 shadow-sm rounded-2xl border border-[#F0E0D5] text-center">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <h2 className="text-xl font-black text-[#292929]">
              Application Submitted!
            </h2>
            <p className="text-xs text-[#737373] mt-2 leading-relaxed">
              Your wholesale business registration for{' '}
              <strong className="text-[#292929]">{businessName}</strong> has been received and marked as{' '}
              <span className="font-bold text-[#E95B2A]">Pending Approval</span>.
            </p>

            <div className="bg-[#FFF8F3] border border-[#F0E0D5] rounded-xl p-4 my-6 text-left text-xs text-[#737373] space-y-2">
              <div className="flex items-center space-x-2 font-bold text-[#292929]">
                <Building2 className="h-4 w-4 text-[#F47732]" />
                <span>Next Steps in Onboarding:</span>
              </div>
              <p>1. Our commercial accounts team will review your business credentials & GST status.</p>
              <p>2. You will be assigned your buyer tier, credit terms, and payment parameters.</p>
              <p>3. You can log in immediately to preview our institutional catalog while awaiting full pricing activation.</p>
            </div>

            <button
              onClick={() => navigate('/login')}
              className="w-full py-2.5 px-4 bg-[#F47732] hover:bg-[#E95B2A] text-white font-bold rounded-xl shadow-xs transition-colors text-sm flex items-center justify-center space-x-2"
            >
              <span>Proceed to Login</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center py-10 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center mb-6">
        <div className="inline-flex items-center justify-center bg-white rounded-2xl shadow-xs mb-3">
          <img src="/img.jpeg" alt="Necessity India" className="h-20 w-auto object-contain p-2" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-[#292929]">
          Wholesale Buyer Registration
        </h1>
        <p className="text-xs text-[#737373] mt-1 max-w-md mx-auto">
          Register your business to access institutional wholesale pricing, bulk carton volume tiers, and commercial credit terms.
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-6 shadow-sm rounded-2xl sm:px-10 border border-[#F0E0D5]">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-rose-700 text-xs">
              <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Section 1: Business Identification */}
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-[#F47732] block mb-2">
                1. Company & Business Details
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1">
                    Company / Business Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Apex Hospitality Supplies"
                    className="w-full text-xs px-3 py-2 border border-[#F0E0D5] rounded-xl focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1">
                    Trade Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={tradeName}
                    onChange={(e) => setTradeName(e.target.value)}
                    placeholder="e.g. Apex Trading"
                    className="w-full text-xs px-3 py-2 border border-[#F0E0D5] rounded-xl focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1">
                    GSTIN Number
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="27AAAAA0000A1Z5"
                    className="w-full text-xs font-mono px-3 py-2 border border-[#F0E0D5] rounded-xl focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1">
                    PAN Card Number
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase())}
                    placeholder="AAAAA0000A"
                    className="w-full text-xs font-mono px-3 py-2 border border-[#F0E0D5] rounded-xl focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Contact Information */}
            <div className="pt-3 border-t border-[#F0E0D5]">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#F47732] block mb-2">
                2. Contact & Account Credentials
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1">
                    Contact Person *
                  </label>
                  <input
                    type="text"
                    required
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Full Name"
                    className="w-full text-xs px-3 py-2 border border-[#F0E0D5] rounded-xl focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1">
                    Mobile Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="10-digit Mobile"
                    className="w-full text-xs font-mono px-3 py-2 border border-[#F0E0D5] rounded-xl focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="purchasing@company.com"
                    className="w-full text-xs px-3 py-2 border border-[#F0E0D5] rounded-xl focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full text-xs px-3 py-2 pr-9 border border-[#F0E0D5] rounded-xl focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2 text-[#737373] hover:text-[#292929]"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Billing Address */}
            <div className="pt-3 border-t border-[#F0E0D5]">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#F47732] block mb-2">
                3. Business Location
              </span>
              <div>
                <label className="block text-xs font-semibold text-[#292929] mb-1">
                  Street Address / Premise *
                </label>
                <input
                  type="text"
                  required
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Plot / Shop No, Industrial Area / Street"
                  className="w-full text-xs px-3 py-2 border border-[#F0E0D5] rounded-xl focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3">
                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className="w-full text-xs px-3 py-2 border border-[#F0E0D5] rounded-xl focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1">
                    State *
                  </label>
                  <input
                    type="text"
                    required
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="State"
                    className="w-full text-xs px-3 py-2 border border-[#F0E0D5] rounded-xl focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#292929] mb-1">
                    Pincode *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                    placeholder="6-digit PIN"
                    className="w-full text-xs font-mono px-3 py-2 border border-[#F0E0D5] rounded-xl focus:ring-2 focus:ring-[#F47732] focus:border-[#F47732]"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl shadow-xs text-sm font-bold text-white bg-[#F47732] hover:bg-[#E95B2A] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F47732] disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Submitting Application...' : 'Submit Wholesale Application'}
                {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
              </button>
            </div>

            <div className="text-center pt-2">
              <span className="text-xs text-[#737373]">
                Already have an approved wholesale account?{' '}
                <Link to="/login" className="font-bold text-[#F47732] hover:underline">
                  Sign In
                </Link>
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
