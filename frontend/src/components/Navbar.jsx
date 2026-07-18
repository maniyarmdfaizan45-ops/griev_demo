import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Building2,
  House,
  FileText,
  SearchCheck,
  LayoutDashboard,
  PhoneCall,
  LogIn,
  CircleUserRound,
  UserPlus,
  LogOut,
  Globe,
} from 'lucide-react';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('admin_token');

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-300 bg-white">
      {/* Government Top Utility Bar */}
      <div className="bg-[#1e293b] text-slate-200 text-[11px] py-1.5 px-4 md:px-8 border-b border-slate-700">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-semibold uppercase tracking-wider flex items-center gap-1">
              <Globe size={11} className="text-[#1E40AF]" /> GOVERNMENT OF INDIA
            </span>
            <span className="hidden text-slate-400 sm:inline">|</span>
            <span className="hidden text-slate-300 sm:inline">Department of Public Grievances</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#content" className="hover:underline">Skip to main content</a>
            <span className="text-slate-400">|</span>
            <span className="cursor-pointer hover:underline">English</span>
            <span className="text-slate-400">|</span>
            <span className="cursor-pointer hover:underline">हिंदी</span>
          </div>
        </div>
      </div>

      {/* Main Branding & Navigation Bar */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
        <Link to="/" className="flex items-center gap-3">
          <div className="rounded bg-[#1E40AF] p-2.5 text-white">
            <Building2 size={24} />
          </div>
          <div className="leading-tight">
            <h1 className="text-base font-bold tracking-tight text-[#1E40AF]">
              AI Smart Public Grievance Management System
            </h1>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              National Citizen Services Portal
            </p>
          </div>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden items-center gap-1 lg:flex">
          <Link
            to="/"
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border-b-2 transition ${
              isActive('/')
                ? 'border-[#1E40AF] text-[#1E40AF]'
                : 'border-transparent text-slate-600 hover:text-[#1E40AF]'
            }`}
          >
            <House size={16} /> Home
          </Link>
          <Link
            to="/submit"
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border-b-2 transition ${
              isActive('/submit')
                ? 'border-[#1E40AF] text-[#1E40AF]'
                : 'border-transparent text-slate-600 hover:text-[#1E40AF]'
            }`}
          >
            <FileText size={16} /> Submit Complaint
          </Link>
          <Link
            to="/history"
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border-b-2 transition ${
              isActive('/history')
                ? 'border-[#1E40AF] text-[#1E40AF]'
                : 'border-transparent text-slate-600 hover:text-[#1E40AF]'
            }`}
          >
            <SearchCheck size={16} /> Track Complaint
          </Link>
          <Link
            to="/admin/dashboard"
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border-b-2 transition ${
              isActive('/admin/dashboard')
                ? 'border-[#1E40AF] text-[#1E40AF]'
                : 'border-transparent text-slate-600 hover:text-[#1E40AF]'
            }`}
          >
            <LayoutDashboard size={16} /> Dashboard
          </Link>
          <a
            href="#contact"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border-b-2 border-transparent text-slate-600 hover:text-[#1E40AF] transition"
          >
            <PhoneCall size={16} /> Contact
          </a>
        </div>

        {/* Right Side Buttons */}
        <div className="flex items-center gap-2">
          {!token ? (
            <>
              <Link
                to="/admin/login"
                className="hidden items-center gap-1.5 rounded border border-slate-300 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition sm:inline-flex"
              >
                <LogIn size={14} /> Employee Access
              </Link>
              <Link
                to="/submit"
                className="inline-flex items-center gap-1.5 rounded bg-[#1E40AF] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#16327e] transition shadow-sm"
              >
                <UserPlus size={14} /> Register Grievance
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/admin/dashboard"
                className="hidden items-center gap-1.5 rounded border border-slate-300 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition sm:inline-flex"
              >
                <CircleUserRound size={14} className="text-[#1E40AF]" /> Admin Profile
              </Link>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded border border-slate-300 px-3.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
              >
                <LogOut size={14} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      <div className="flex items-center justify-around border-t border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600 lg:hidden">
        <Link to="/" className={`flex flex-col items-center gap-0.5 ${isActive('/') ? 'text-[#1E40AF]' : ''}`}>
          <House size={16} /> Home
        </Link>
        <Link to="/submit" className={`flex flex-col items-center gap-0.5 ${isActive('/submit') ? 'text-[#1E40AF]' : ''}`}>
          <FileText size={16} /> Submit
        </Link>
        <Link to="/history" className={`flex flex-col items-center gap-0.5 ${isActive('/history') ? 'text-[#1E40AF]' : ''}`}>
          <SearchCheck size={16} /> Track
        </Link>
        <a href="#contact" className="flex flex-col items-center gap-0.5">
          <PhoneCall size={16} /> Contact
        </a>
      </div>
    </header>
  );
}
