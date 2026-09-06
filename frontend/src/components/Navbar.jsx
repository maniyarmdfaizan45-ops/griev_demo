import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Clock,
  Flame,
  ShieldAlert,
  Copy,
  RefreshCw,
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

  const [markingReadId, setMarkingReadId] = useState(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  // Human-friendly relative timestamp helper
  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 0) return 'Just now';
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Fetch notifications wrapped in useCallback
  const fetchNotifications = useCallback(async () => {
    if (!activeToken) return;
    try {
      setLoading(true);
      const response = await apiService.getNotifications();
      if (response && response.status === 'success') {
        setNotifications(response.notifications || []);
        setUnreadCount(Math.max(0, response.unread_count || 0));
      }
    } catch {
      // Background fetch errors ignored gracefully
    } finally {
      setLoading(false);
    }
  }, [activeToken]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications, location.pathname]);

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
    if (markingReadId === id) return;
    try {
      setMarkingReadId(id);
      await apiService.markNotificationAsRead(id);
      await fetchNotifications();
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    } finally {
      setMarkingReadId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (markingAllRead) return;
    try {
      setMarkingAllRead(true);
      await apiService.markAllNotificationsAsRead();
      await fetchNotifications();
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleNotificationClick = (notif) => {
    setShowDropdown(false);
    if (!notif.is_read) {
      apiService.markNotificationAsRead(notif.id).catch(() => {});
    }

    if (notif.grievance_id) {
      if (adminToken) {
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

  // Type-specific icons & visual priority styling
  const getNotifIconAndStyle = (type, title = '') => {
    const titleUpper = title.toUpperCase();

    if (type === 'SLA_BREACHED' || titleUpper.includes('SLA BREACH')) {
      return {
        icon: <Clock size={16} className="text-rose-600 shrink-0" />,
        accentClass: 'border-l-rose-500 bg-rose-50/70',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
        label: 'SLA Breach',
      };
    }
    if (type === 'COMPLAINT_ESCALATED' || titleUpper.includes('ESCALATED')) {
      return {
        icon: <Flame size={16} className="text-amber-600 shrink-0" />,
        accentClass: 'border-l-amber-500 bg-amber-50/70',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
        label: 'Escalated',
      };
    }
    if (type === 'DUPLICATE_DETECTED' || titleUpper.includes('DUPLICATE')) {
      return {
        icon: <Copy size={16} className="text-purple-600 shrink-0" />,
        accentClass: 'border-l-purple-500 bg-purple-50/70',
        badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
        label: 'Duplicate',
      };
    }
    if (type === 'COMPLAINT_RESOLVED' || titleUpper.includes('RESOLVED')) {
      return {
        icon: <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />,
        accentClass: 'border-l-emerald-500 bg-emerald-50/70',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        label: 'Resolved',
      };
    }
    if (type === 'COMPLAINT_REOPENED' || titleUpper.includes('REOPENED')) {
      return {
        icon: <ShieldAlert size={16} className="text-rose-600 shrink-0" />,
        accentClass: 'border-l-rose-500 bg-rose-50/70',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
        label: 'Reopened',
      };
    }
    if (type === 'SLA_APPROACHING' || titleUpper.includes('NEAR DEADLINE')) {
      return {
        icon: <AlertTriangle size={16} className="text-amber-500 shrink-0" />,
        accentClass: 'border-l-amber-500 bg-amber-50/70',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
        label: 'Near Deadline',
      };
    }

    return {
      icon: <Info size={16} className="text-[#1E40AF] shrink-0" />,
      accentClass: 'border-l-[#1E40AF] bg-blue-50/50',
      badgeClass: 'bg-blue-100 text-[#1E40AF] border-blue-200',
      label: 'Update',
    };
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-300 bg-white shadow-2xs">
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
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 md:px-8">
        <Link to="/" className="flex items-center gap-2.5 sm:gap-3">
          <div className="rounded-lg bg-[#1E40AF] p-2 sm:p-2.5 text-white shadow-xs shrink-0">
            <Building2 size={20} className="sm:w-6 sm:h-6" />
          </div>
          <div className="leading-tight">
            <h1 className="text-xs sm:text-base font-extrabold tracking-tight text-[#1E40AF]">
              AI Smart Public Grievance Management System
            </h1>
            <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.15em] sm:tracking-[0.18em] text-slate-500">
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

        {/* Right Side Controls & Notification Center Bell */}
        <div className="flex items-center gap-3">
          {activeToken && (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setShowDropdown(!showDropdown);
                  if (!showDropdown) fetchNotifications();
                }}
                className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100 hover:text-[#1E40AF] transition focus:outline-none cursor-pointer"
                aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                aria-expanded={showDropdown}
                aria-haspopup="true"
                id="notification-bell"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Enhanced Notification Dropdown Panel */}
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 rounded-xl border border-slate-200 bg-white shadow-2xl z-50 overflow-hidden transition-all">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Bell size={16} className="text-[#1E40AF]" />
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                        Notifications
                      </h3>
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-extrabold text-rose-700 border border-rose-200">
                          {unreadCount} unread
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllAsRead}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1E40AF] hover:text-[#16327e] hover:underline cursor-pointer"
                      >
                        <CheckCheck size={14} />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>

                  {/* List Container */}
                  <div className="max-h-[75vh] sm:max-h-96 overflow-y-auto divide-y divide-slate-100">
                    {loading && notifications.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                        <RefreshCw size={18} className="animate-spin text-[#1E40AF]" />
                        <span>Loading notification center...</span>
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                        <AlertCircle size={24} className="text-slate-300" />
                        <span className="font-semibold text-slate-700">No notifications available</span>
                        <p className="text-[11px] text-slate-400">Updates regarding your complaints will appear here.</p>
                      </div>
                    ) : (
                      notifications.map((notif) => {
                        const styleInfo = getNotifIconAndStyle(notif.notification_type, notif.title);
                        const isUnread = !notif.is_read;

                        return (
                          <div
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`p-3.5 flex items-start gap-3 border-l-4 transition cursor-pointer hover:bg-slate-50 ${
                              isUnread ? styleInfo.accentClass : 'border-l-transparent bg-white opacity-85'
                            }`}
                          >
                            <div className="mt-0.5 shrink-0">{styleInfo.icon}</div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded border ${styleInfo.badgeClass}`}>
                                  {styleInfo.label}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium shrink-0">
                                  {formatTimeAgo(notif.created_at)}
                                </span>
                              </div>

                              <h4 className={`text-xs ${isUnread ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-700'} truncate`}>
                                {notif.title}
                              </h4>

                              <p className="text-[11px] text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                                {notif.message}
                              </p>

                              {notif.grievance_id && (
                                <div className="mt-1.5 flex items-center justify-between">
                                  <span className="inline-flex items-center gap-1 font-mono text-[10px] font-extrabold text-[#1E40AF] bg-blue-100/70 px-1.5 py-0.5 rounded">
                                    {notif.grievance_id}
                                  </span>
                                  <span className="text-[10px] text-[#1E40AF] font-bold hover:underline">View details →</span>
                                </div>
                              )}
                            </div>

                            {isUnread && (
                              <button
                                type="button"
                                onClick={(e) => handleMarkAsRead(e, notif.id)}
                                className="mt-0.5 p-1 text-slate-400 hover:text-[#1E40AF] hover:bg-blue-100/50 rounded transition"
                                title="Mark as read"
                                aria-label="Mark notification as read"
                              >
                                <CheckCheck size={14} />
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {!adminToken ? (
            <>
              <Link
                to="/admin/login"
                className="hidden items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition sm:inline-flex"
              >
                <LogIn size={14} /> Employee Access
              </Link>
              <Link
                to="/submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E40AF] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#16327e] transition shadow-xs"
              >
                <UserPlus size={14} /> Register Grievance
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/admin/dashboard"
                className="hidden items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition sm:inline-flex"
              >
                <CircleUserRound size={14} className="text-[#1E40AF]" /> Admin Profile
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              >
                <LogOut size={14} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="flex items-center justify-around border-t border-slate-200 bg-slate-50 px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600 lg:hidden">
        <Link to="/" className={`flex flex-col items-center gap-0.5 ${isActive('/') ? 'text-[#1E40AF]' : ''}`}>
          <House size={16} /> Home
        </Link>
        <Link to="/submit" className={`flex flex-col items-center gap-0.5 ${isActive('/submit') ? 'text-[#1E40AF]' : ''}`}>
          <FileText size={16} /> Submit
        </Link>
        <Link to="/history" className={`flex flex-col items-center gap-0.5 ${isActive('/history') ? 'text-[#1E40AF]' : ''}`}>
          <SearchCheck size={16} /> Track
        </Link>
        {adminToken ? (
          <Link to="/admin/dashboard" className={`flex flex-col items-center gap-0.5 ${isActive('/admin/dashboard') ? 'text-[#1E40AF]' : ''}`}>
            <LayoutDashboard size={16} /> Dashboard
          </Link>
        ) : (
          <a href="#contact" className="flex flex-col items-center gap-0.5">
            <PhoneCall size={16} /> Contact
          </a>
        )}
      </div>
    </header>
  );
}


