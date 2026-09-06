import React, { useState, useEffect, useRef } from 'react';
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
  Bell,
  CheckCheck,
  X,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { apiService } from '../services/api';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const adminToken = localStorage.getItem('admin_token');
  const citizenToken = localStorage.getItem('citizen_token');
  const activeToken = adminToken || citizenToken;
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    if (!activeToken) return;
    try {
      setLoading(true);
      const response = await apiService.getNotifications();
      if (response.status === 'success') {
        setNotifications(response.notifications || []);
        setUnreadCount(response.unread_count || 0);
      }
    } catch (err) {
      // Ignore background fetch errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [location.pathname, token, citizenGrievanceId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (e, id) => {
    e.stopPropagation();
    try {
      await apiService.markNotificationAsRead(id);
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiService.markAllNotificationsAsRead();
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = (notif) => {
    setShowDropdown(false);
    if (notif.grievance_id) {
      if (token) {
        navigate(`/admin/dashboard?search=${encodeURIComponent(notif.grievance_id)}`);
      } else {
        navigate(`/history?id=${encodeURIComponent(notif.grievance_id)}`);
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setNotifications([]);
    setUnreadCount(0);
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  const getNotifIcon = (type) => {
    switch (type) {
      case 'SLA_BREACHED':
      case 'COMPLAINT_ESCALATED':
        return <AlertCircle size={16} className="text-rose-600 shrink-0" />;
      case 'SLA_APPROACHING':
      case 'DUPLICATE_DETECTED':
        return <AlertTriangle size={16} className="text-amber-500 shrink-0" />;
      case 'COMPLAINT_RESOLVED':
        return <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />;
      default:
        return <Info size={16} className="text-blue-600 shrink-0" />;
    }
  };

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

        {/* Right Side Buttons & Notification Bell */}
        <div className="flex items-center gap-3">
          {/* Notification Bell Icon Dropdown */}
          {(token || citizenGrievanceId) && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => {
                  setShowDropdown(!showDropdown);
                  if (!showDropdown) fetchNotifications();
                }}
                className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100 hover:text-[#1E40AF] transition focus:outline-none"
                title="Notifications"
                id="notification-bell"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-sm animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-lg border border-slate-200 bg-white shadow-xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Bell size={16} className="text-[#1E40AF]" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Notifications {unreadCount > 0 && `(${unreadCount} Unread)`}
                      </h3>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllAsRead}
                        className="flex items-center gap-1 text-[11px] font-bold text-[#1E40AF] hover:underline"
                      >
                        <CheckCheck size={14} /> Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {loading && notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">Loading notifications...</div>
                    ) : notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">No notifications available</div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`p-3.5 flex gap-3 transition cursor-pointer hover:bg-slate-50 ${
                            !notif.is_read ? 'bg-blue-50/50 font-medium' : 'bg-white text-slate-600'
                          }`}
                        >
                          {getNotifIcon(notif.notification_type)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <h4 className="text-xs font-bold text-slate-900 truncate">{notif.title}</h4>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                {notif.created_at ? new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">{notif.message}</p>
                            {notif.grievance_id && (
                              <span className="inline-block mt-1 text-[10px] font-semibold text-[#1E40AF] bg-blue-100/70 px-1.5 py-0.5 rounded">
                                {notif.grievance_id}
                              </span>
                            )}
                          </div>
                          {!notif.is_read && (
                            <button
                              onClick={(e) => handleMarkAsRead(e, notif.id)}
                              className="self-center p-1 text-slate-400 hover:text-blue-600 transition"
                              title="Mark as read"
                            >
                              <CheckCheck size={14} />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

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

