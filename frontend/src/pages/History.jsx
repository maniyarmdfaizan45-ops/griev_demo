import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { apiService } from '../services/api';
import {
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Inbox,
  ShieldCheck,
  Clock,
  Building2,
  Tag,
  Check,
  Copy,
  PlusCircle,
  ArrowRight,
  Calendar,
  X,
  ShieldAlert,
} from 'lucide-react';

export default function History() {
  const location = useLocation();

  const [activeTab, setActiveTab] = useState('track'); // 'track' or 'ledger'
  const [complaints, setComplaints] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [trackLoading, setTrackLoading] = useState(false);
  const [error, setError] = useState('');

  // Search for tracking
  const [trackId, setTrackId] = useState('');
  const [trackedGrievance, setTrackedGrievance] = useState(null);
  const [statusHistory, setStatusHistory] = useState([]);
  const [copiedId, setCopiedId] = useState(false);

  // Search & filters for public ledger
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [priority, setPriority] = useState('All');
  const [status, setStatus] = useState('All');
  const [department, setDepartment] = useState('All');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Fetch Public Ledger complaints
  const fetchComplaints = useCallback(async () => {
    if (activeTab !== 'ledger') return;
    setLoading(true);
    setError('');
    try {
      const params = {
        search: search.trim(),
        category,
        priority,
        status,
        department,
        page,
        limit,
      };
      const response = await apiService.getComplaints(params);
      if (response && response.status === 'success') {
        setComplaints(response.complaints || []);
        setTotal(response.total || 0);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch public complaints ledger.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, category, priority, status, department, page]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  // Track search function
  const performTrackSearch = async (queryId) => {
    if (!queryId || !queryId.trim()) {
      setTrackedGrievance(null);
      setStatusHistory([]);
      return;
    }

    const cleanTrackId = queryId.trim().toUpperCase();
    setTrackLoading(true);
    setError('');
    setTrackedGrievance(null);
    setStatusHistory([]);

    try {
      const response = await apiService.getComplaintByGrievanceId(cleanTrackId);
      if (response && response.status === 'success' && response.complaint) {
        setTrackedGrievance(response.complaint);
        setStatusHistory(response.history || []);
        setTrackLoading(false);
        return;
      }
    } catch {
      // Fallback search if direct endpoint fails
    }

    // Fallback: search in complaints endpoint
    try {
      const listResponse = await apiService.getComplaints({
        search: cleanTrackId,
        page: 1,
        limit: 20,
      });

      if (
        listResponse &&
        listResponse.status === 'success' &&
        listResponse.complaints &&
        listResponse.complaints.length > 0
      ) {
        const found =
          listResponse.complaints.find(
            (c) =>
              (c.grievance_id && c.grievance_id.toUpperCase() === cleanTrackId) ||
              c.id.toLowerCase() === cleanTrackId.toLowerCase()
          ) || listResponse.complaints[0];

        if (found) {
          setTrackedGrievance(found);
          try {
            const histRes = await apiService.getComplaintHistory(found.id);
            setStatusHistory(histRes.history || []);
          } catch {
            setStatusHistory([]);
          }
          setTrackLoading(false);
          return;
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch grievance data.');
    }

    setTrackLoading(false);
    setError(
      `No grievance found matching Reference ID "${cleanTrackId}". Please verify the ID format (e.g. GRV-2026-000001) and try again.`
    );
  };

  // Auto-search if URL query param `?id=...` exists
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const idParam = params.get('id');
    if (idParam) {
      setTrackId(idParam);
      setActiveTab('track');
      performTrackSearch(idParam);
    }
  }, [location.search]);

  const handleTrackSubmit = (e) => {
    e.preventDefault();
    performTrackSearch(trackId);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchComplaints();
  };

  const handleResetFilters = () => {
    setSearch('');
    setCategory('All');
    setPriority('All');
    setStatus('All');
    setDepartment('All');
    setPage(1);
  };

  const handleCopyId = (id) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const getStatusBadgeClass = (stat) => {
    const mapping = {
      SUBMITTED: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold',
      ASSIGNED: 'bg-indigo-50 text-indigo-800 border-indigo-300 font-semibold',
      IN_PROGRESS: 'bg-blue-50 text-[#1E40AF] border-blue-300 font-bold',
      RESOLVED: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
      CLOSED: 'bg-slate-100 text-slate-700 border-slate-300 font-medium',
      REOPENED: 'bg-rose-50 text-rose-800 border-rose-300 font-bold',
    };
    return mapping[stat] || 'bg-slate-100 text-slate-700 border-slate-300 font-medium';
  };

  const getPriorityBadgeClass = (pri) => {
    const mapping = {
      High: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
      Medium: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
      Low: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
    };
    return mapping[pri] || 'bg-slate-100 text-slate-700 border-slate-300 font-semibold';
  };

  const getSlaBadgeDetails = (slaStatusVal) => {
    switch (slaStatusVal) {
      case 'WITHIN_SLA':
        return {
          label: 'Within SLA',
          className: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold',
          Icon: CheckCircle2,
        };
      case 'NEAR_DEADLINE':
        return {
          label: 'Near SLA Deadline',
          className: 'bg-amber-50 text-amber-900 border-amber-400 font-extrabold ring-1 ring-amber-200',
          Icon: AlertTriangle,
        };
      case 'SLA_BREACHED':
        return {
          label: 'SLA Breached',
          className: 'bg-rose-100 text-rose-900 border-rose-400 font-extrabold ring-1 ring-rose-200',
          Icon: AlertCircle,
        };
      case 'RESOLVED_WITHIN_SLA':
        return {
          label: 'Resolved Within SLA',
          className: 'bg-emerald-100 text-emerald-900 border-emerald-400 font-extrabold',
          Icon: CheckCircle2,
        };
      case 'RESOLVED_AFTER_SLA':
        return {
          label: 'Resolved After SLA',
          className: 'bg-rose-50 text-rose-900 border-rose-300 font-bold',
          Icon: Clock,
        };
      default:
        return {
          label: slaStatusVal || 'Standard SLA',
          className: 'bg-slate-100 text-slate-700 border-slate-300 font-medium',
          Icon: Clock,
        };
    }
  };

  const getSlaTimeRemaining = (slaDeadline, slaStatusVal, ticketStatus) => {
    if (
      ticketStatus === 'RESOLVED' ||
      ticketStatus === 'CLOSED' ||
      slaStatusVal === 'RESOLVED_WITHIN_SLA' ||
      slaStatusVal === 'RESOLVED_AFTER_SLA'
    ) {
      return { text: 'Resolution Completed', isBreached: false, isNear: false };
    }
    if (slaStatusVal === 'SLA_BREACHED') {
      return { text: 'Deadline Exceeded', isBreached: true, isNear: false };
    }
    if (!slaDeadline) {
      return { text: 'Standard SLA Window (48h-72h)', isBreached: false, isNear: false };
    }

    const deadlineTime = new Date(slaDeadline).getTime();
    const now = new Date().getTime();
    const diffMs = deadlineTime - now;

    if (diffMs <= 0) {
      return { text: 'Deadline Exceeded', isBreached: true, isNear: false };
    }

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours === 0) {
      return { text: `${diffMins} mins remaining`, isBreached: false, isNear: true };
    }
    if (diffHours < 24) {
      return { text: `${diffHours}h ${diffMins}m remaining`, isBreached: false, isNear: diffHours < 6 };
    }
    const diffDays = Math.floor(diffHours / 24);
    const remHours = diffHours % 24;
    return { text: `${diffDays}d ${remHours}h remaining`, isBreached: false, isNear: false };
  };

  const getTimelineSteps = (ticketStatus) => {
    const isReopened = ticketStatus === 'REOPENED';
    const steps = [
      { key: 'SUBMITTED', name: 'Submitted', desc: 'Recorded in ledger' },
      { key: 'ASSIGNED', name: 'Assigned', desc: 'Routed to officer' },
      { key: 'IN_PROGRESS', name: 'In Progress', desc: 'Under resolution' },
      { key: 'RESOLVED', name: 'Resolved', desc: 'Issue resolved' },
      { key: 'CLOSED', name: 'Closed', desc: 'Ticket closed' },
    ];

    const statusOrder = {
      SUBMITTED: 0,
      ASSIGNED: 1,
      IN_PROGRESS: 2,
      REOPENED: 2,
      RESOLVED: 3,
      CLOSED: 4,
    };

    const currentIndex = statusOrder[ticketStatus] ?? 0;

    return steps.map((step, idx) => {
      let state = 'upcoming';
      if (idx < currentIndex) {
        state = 'complete';
      } else if (idx === currentIndex) {
        state = isReopened ? 'reopened' : 'active';
      }
      return { ...step, state };
    });
  };

  const totalPages = Math.ceil(total / limit) || 1;

  // Parsing consolidated description text safely
  const parseComplaintText = (fullText) => {
    if (!fullText) return { preview: '', isConsolidated: false, meta: '' };
    const descMarker = 'DESCRIPTION:\n';
    if (fullText.includes(descMarker)) {
      const idx = fullText.indexOf(descMarker);
      const rawMeta = fullText.substring(0, idx).trim();
      // Remove CITIZEN contact line to prevent PII exposure on public tracking page
      const cleanMeta = rawMeta
        .split('\n')
        .filter((line) => !line.toUpperCase().startsWith('CITIZEN:'))
        .join('\n')
        .trim();

      return {
        preview: fullText.substring(idx + descMarker.length).trim(),
        isConsolidated: true,
        meta: cleanMeta,
      };
    }
    return {
      preview: fullText.trim(),
      isConsolidated: false,
      meta: '',
    };
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-12">
      {/* Title & Portal Header */}
      <div className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-[#1E40AF]">
            <ShieldCheck size={14} /> Official Grievance Tracking Portal
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Complaint Tracking & Status History
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            Track real-time resolution progress of your grievance or inspect the transparent public redressal ledger.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#1E40AF] px-4 py-2 text-xs font-bold text-white shadow hover:bg-[#16327e] transition"
          >
            <PlusCircle size={14} />
            <span>Submit Complaint</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'track' && trackId) {
                performTrackSearch(trackId);
              } else {
                fetchComplaints();
              }
            }}
            disabled={loading || trackLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading || trackLoading ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-8 flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => {
            setActiveTab('track');
            setError('');
          }}
          className={`px-6 py-3 text-xs sm:text-sm font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'track'
              ? 'border-[#1E40AF] text-[#1E40AF] bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Track Single Grievance
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('ledger');
            setError('');
          }}
          className={`px-6 py-3 text-xs sm:text-sm font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'ledger'
              ? 'border-[#1E40AF] text-[#1E40AF] bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Public Redressal Ledger
        </button>
      </div>

      {/* TRACK TAB VIEW */}
      {activeTab === 'track' && (
        <div className="space-y-6">
          {/* Prominent Search Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 mb-1">
              Track Grievance by Reference ID
            </h2>
            <p className="text-xs text-slate-600 mb-4">
              Enter your official Grievance Reference ID below to view live resolution status, department assignment, and SLA timeline.
            </p>

            <form onSubmit={handleTrackSubmit} className="flex flex-col gap-3 sm:flex-row max-w-2xl">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="GRV-2026-000001"
                  value={trackId}
                  onChange={(e) => setTrackId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 pl-10 text-xs sm:text-sm font-mono text-slate-900 outline-none transition-all focus:border-[#1E40AF] focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
                <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              </div>
              <button
                type="submit"
                disabled={trackLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1E40AF] px-6 py-2.5 text-xs font-bold text-white shadow hover:bg-[#16327e] disabled:opacity-50 transition-all cursor-pointer"
              >
                {trackLoading ? (
                  <RefreshCw size={15} className="animate-spin" />
                ) : (
                  <Search size={15} />
                )}
                <span>{trackLoading ? 'Searching...' : 'Track Grievance'}</span>
              </button>
            </form>
          </div>

          {/* Global Error Banner */}
          {error && activeTab === 'track' && (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-rose-300 bg-rose-50 p-4 text-xs font-medium text-rose-800 shadow-sm">
              <div className="flex items-center gap-2.5">
                <AlertCircle size={16} className="shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => setError('')}
                className="text-rose-500 hover:text-rose-700 p-0.5 rounded"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Skeleton Loader during track search */}
          {trackLoading && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6 animate-pulse">
              <div className="h-20 rounded-lg bg-slate-100" />
              <div className="h-32 rounded-lg bg-slate-100" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-24 rounded-lg bg-slate-100" />
                <div className="h-24 rounded-lg bg-slate-100" />
              </div>
            </div>
          )}

          {/* Tracked Grievance Details Card */}
          {trackedGrievance && !trackLoading && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-8 shadow-sm space-y-8">
              {/* Header Details */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Grievance Reference ID
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="font-mono text-xl sm:text-2xl font-extrabold text-[#1E40AF] select-all">
                      {trackedGrievance.grievance_id || trackedGrievance.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyId(trackedGrievance.grievance_id || trackedGrievance.id)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition active:scale-95"
                    >
                      {copiedId ? (
                        <>
                          <Check size={13} className="text-emerald-600" />
                          <span className="text-emerald-700 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} className="text-slate-500" />
                          <span>Copy ID</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-lg border px-3 py-1 text-xs ${getStatusBadgeClass(trackedGrievance.status)}`}>
                    Status: {trackedGrievance.status}
                  </span>
                  <span className={`rounded-lg border px-3 py-1 text-xs ${getPriorityBadgeClass(trackedGrievance.priority)}`}>
                    {trackedGrievance.priority} Priority
                  </span>
                </div>
              </div>

              {/* Redressal Lifecycle Timeline Stepper */}
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-6 flex items-center gap-1.5">
                  <Clock size={14} className="text-[#1E40AF]" /> Redressal Lifecycle Timeline
                </h3>

                {/* Reopened Alert Banner */}
                {trackedGrievance.status === 'REOPENED' && (
                  <div className="mb-6 flex items-center gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900">
                    <ShieldAlert size={16} className="text-rose-600 shrink-0" />
                    <div>
                      <span className="font-bold">Grievance Reopened:</span> This ticket was re-opened by the citizen for further administrative review and resolution.
                    </div>
                  </div>
                )}

                {/* Desktop Stepper */}
                <div className="hidden md:grid md:grid-cols-5 gap-3 p-5 rounded-xl border border-slate-200 bg-slate-50/70">
                  {getTimelineSteps(trackedGrievance.status).map((step, idx) => (
                    <div key={step.key} className="flex flex-col items-center text-center relative">
                      {/* Step Badge Circle */}
                      <div
                        className={`h-9 w-9 rounded-full border-2 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs transition-all ${
                          step.state === 'complete'
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : step.state === 'active'
                            ? 'border-[#1E40AF] bg-[#1E40AF] text-white ring-4 ring-blue-100'
                            : step.state === 'reopened'
                            ? 'border-rose-600 bg-rose-600 text-white ring-4 ring-rose-100'
                            : 'border-slate-300 bg-white text-slate-400'
                        }`}
                      >
                        {step.state === 'complete' ? <Check size={16} /> : idx + 1}
                      </div>

                      {/* Step Labels */}
                      <span
                        className={`mt-2.5 text-xs font-extrabold ${
                          step.state === 'complete'
                            ? 'text-slate-800'
                            : step.state === 'active'
                            ? 'text-[#1E40AF]'
                            : step.state === 'reopened'
                            ? 'text-rose-700'
                            : 'text-slate-400'
                        }`}
                      >
                        {step.name}
                      </span>
                      <span className="mt-0.5 text-[10px] text-slate-500 leading-tight">
                        {step.desc}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Mobile Stepper */}
                <div className="md:hidden space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/70">
                  {getTimelineSteps(trackedGrievance.status).map((step, idx) => (
                    <div key={step.key} className="flex items-start gap-3">
                      <div
                        className={`h-7 w-7 rounded-full border-2 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                          step.state === 'complete'
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : step.state === 'active'
                            ? 'border-[#1E40AF] bg-[#1E40AF] text-white'
                            : step.state === 'reopened'
                            ? 'border-rose-600 bg-rose-600 text-white'
                            : 'border-slate-300 bg-white text-slate-400'
                        }`}
                      >
                        {step.state === 'complete' ? <Check size={14} /> : idx + 1}
                      </div>
                      <div>
                        <span
                          className={`block text-xs font-bold ${
                            step.state === 'complete'
                              ? 'text-slate-800'
                              : step.state === 'active'
                              ? 'text-[#1E40AF]'
                              : step.state === 'reopened'
                              ? 'text-rose-700'
                              : 'text-slate-400'
                          }`}
                        >
                          {step.name}
                        </span>
                        <span className="text-[11px] text-slate-500">{step.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status History Logs */}
              {statusHistory && statusHistory.length > 0 && (
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-4">
                    Official Status History & Officer Remarks
                  </h3>
                  <div className="relative border-l-2 border-slate-200 pl-4 space-y-4 ml-2">
                    {statusHistory.map((event, i) => (
                      <div key={`${event.changed_at}-${i}`} className="relative group">
                        {/* Dot on line */}
                        <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white bg-[#1E40AF] ring-2 ring-blue-100" />
                        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-1.5">
                            <span className="font-bold text-slate-900">
                              Status updated to <span className="text-[#1E40AF]">{event.new_status}</span>
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {new Date(event.changed_at).toLocaleString(undefined, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </span>
                          </div>
                          {event.changed_by && (
                            <span className="mt-1 block text-[10px] text-slate-500 font-medium">
                              Updated by: {event.changed_by}
                            </span>
                          )}
                          {event.remark && (
                            <p className="mt-1.5 text-slate-700 bg-white border border-slate-200 rounded p-2 text-xs leading-relaxed">
                              "{event.remark}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detailed Grievance Metadata Grid */}
              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-4">
                  Grievance Record Details
                </h3>

                <div className="grid gap-6 md:grid-cols-2">
                  {/* Left Column: Description & Metadata */}
                  <div className="space-y-4">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Assigned Department
                      </span>
                      <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-[#1E40AF]">
                        <Building2 size={14} />
                        {trackedGrievance.department || trackedGrievance.category}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Complaint Category
                      </span>
                      <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-800">
                        <Tag size={13} className="text-slate-500" />
                        {trackedGrievance.category || 'General'}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Grievance Description
                      </span>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-800 leading-relaxed font-medium whitespace-pre-line">
                        {parseComplaintText(trackedGrievance.complaint_text).preview}
                      </div>
                    </div>

                    {parseComplaintText(trackedGrievance.complaint_text).isConsolidated && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-[11px] text-slate-600">
                        <span className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                          Location & Contact Context
                        </span>
                        <pre className="font-sans whitespace-pre-line leading-normal text-slate-600">
                          {parseComplaintText(trackedGrievance.complaint_text).meta.trim()}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Right Column: SLA & Timestamps */}
                  <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Submission Timestamp
                      </span>
                      <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                        <Calendar size={13} className="text-slate-500" />
                        {new Date(trackedGrievance.timestamp).toLocaleString(undefined, {
                          dateStyle: 'long',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        SLA Compliance Status
                      </span>
                      <div className="mt-1 flex items-center gap-2">
                        {(() => {
                          const slaDetails = getSlaBadgeDetails(trackedGrievance.sla_status);
                          const SlaIcon = slaDetails.Icon;
                          return (
                            <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${slaDetails.className}`}>
                              <SlaIcon size={13} />
                              <span>{slaDetails.label}</span>
                            </span>
                          );
                        })()}

                        {(() => {
                          const rem = getSlaTimeRemaining(
                            trackedGrievance.sla_deadline,
                            trackedGrievance.sla_status,
                            trackedGrievance.status
                          );
                          return (
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                                rem.isBreached
                                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                                  : rem.isNear
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              }`}
                            >
                              {rem.text}
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Expected Resolution SLA Deadline
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                        <Clock size={13} className="text-[#1E40AF]" />
                        {trackedGrievance.sla_deadline
                          ? new Date(trackedGrievance.sla_deadline).toLocaleString(undefined, {
                              dateStyle: 'long',
                              timeStyle: 'short',
                            })
                          : 'Standard SLA Window (24h - 120h max target)'}
                      </span>
                    </div>

                    {trackedGrievance.resolution_info && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                        <span className="block font-bold uppercase tracking-wider text-[10px] text-emerald-800 mb-1">
                          Resolution Summary
                        </span>
                        <span>{trackedGrievance.resolution_info}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Empty Track State */}
          {!trackedGrievance && !trackLoading && !error && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 sm:p-12 text-center shadow-xs">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#1E40AF]">
                <Inbox size={24} />
              </div>
              <h3 className="text-sm font-bold text-slate-900">No Grievance Selected</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                Enter your reference ID in the search box above (e.g. <span className="font-mono font-semibold">GRV-2026-000001</span>) to inspect live status.
              </p>
              <div className="mt-5">
                <Link
                  to="/submit"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                >
                  <PlusCircle size={14} />
                  <span>Submit a New Grievance</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PUBLIC REDRESSAL LEDGER TAB VIEW */}
      {activeTab === 'ledger' && (
        <div className="space-y-6">
          {/* Filters Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="Search grievance descriptions or IDs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 pl-9 pr-4 py-2.5 text-xs text-slate-900 outline-none transition focus:border-[#1E40AF] focus:bg-white"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-[#1E40AF] px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-[#16327e] transition cursor-pointer"
                >
                  Search
                </button>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-4 text-xs text-slate-600">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Filter size={14} className="text-[#1E40AF]" /> Filters:
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-700">Category:</span>
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-[#1E40AF]"
                >
                  <option value="All">All Categories</option>
                  <option value="Water">Water</option>
                  <option value="Electricity">Electricity</option>
                  <option value="Road">Road</option>
                  <option value="Garbage">Garbage</option>
                  <option value="Others">Others</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-700">Priority:</span>
                <select
                  value={priority}
                  onChange={(e) => {
                    setPriority(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-[#1E40AF]"
                >
                  <option value="All">All Priorities</option>
                  <option value="High">High Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="Low">Low Priority</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-700">Status:</span>
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-[#1E40AF]"
                >
                  <option value="All">All Statuses</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                  <option value="REOPENED">Reopened</option>
                </select>
              </div>
            </div>
          </div>

          {/* Global Error Banner */}
          {error && activeTab === 'ledger' && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-300 bg-rose-50 p-4 text-xs font-medium text-rose-800 shadow-sm">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={fetchComplaints}
                className="rounded border border-rose-300 bg-white px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50"
              >
                Retry
              </button>
            </div>
          )}

          {/* Public Ledger Table Card */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 font-extrabold uppercase tracking-wider text-slate-500">
                    <th className="p-3.5 pl-5 w-32">Reference ID</th>
                    <th className="p-3.5 w-32">Logged Date</th>
                    <th className="p-3.5">Grievance Description</th>
                    <th className="p-3.5 w-28">Department</th>
                    <th className="p-3.5 w-24">Priority</th>
                    <th className="p-3.5 w-28">Status</th>
                    <th className="p-3.5 w-24 text-right pr-5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="bg-white">
                        <td className="p-4 pl-5"><div className="h-3.5 w-24 rounded bg-slate-200 animate-pulse" /></td>
                        <td className="p-4"><div className="h-3.5 w-20 rounded bg-slate-200 animate-pulse" /></td>
                        <td className="p-4"><div className="h-3.5 w-3/4 rounded bg-slate-200 animate-pulse" /></td>
                        <td className="p-4"><div className="h-3.5 w-16 rounded bg-slate-200 animate-pulse" /></td>
                        <td className="p-4"><div className="h-3.5 w-14 rounded bg-slate-200 animate-pulse" /></td>
                        <td className="p-4"><div className="h-3.5 w-16 rounded bg-slate-200 animate-pulse" /></td>
                        <td className="p-4 pr-5 text-right"><div className="h-3.5 w-10 rounded bg-slate-200 animate-pulse ml-auto" /></td>
                      </tr>
                    ))
                  ) : complaints.length > 0 ? (
                    complaints.map((item) => (
                      <tr key={item.id} className="transition hover:bg-blue-50/30">
                        <td className="p-3.5 pl-5 font-mono font-bold text-slate-800 select-all">
                          {item.grievance_id || `#${item.id.substring(0, 8)}`}
                        </td>
                        <td className="p-3.5 whitespace-nowrap text-slate-600">
                          {new Date(item.timestamp).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </td>
                        <td className="p-3.5 leading-relaxed text-slate-800 max-w-xs truncate">
                          {parseComplaintText(item.complaint_text).preview}
                        </td>
                        <td className="p-3.5">
                          <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-[#1E40AF]">
                            {item.department || item.category}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className={`rounded-md border px-2 py-0.5 text-[10px] ${getPriorityBadgeClass(item.priority)}`}>
                            {item.priority}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-[10px] ${getStatusBadgeClass(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="p-3.5 pr-5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              const targetId = item.grievance_id || item.id;
                              setTrackId(targetId);
                              setActiveTab('track');
                              performTrackSearch(targetId);
                            }}
                            className="inline-flex items-center gap-1 text-[#1E40AF] hover:text-[#16327e] font-bold text-xs"
                          >
                            <span>Track</span>
                            <ArrowRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-500">
                        <div className="flex flex-col items-center gap-2">
                          <Inbox size={32} className="text-slate-300" />
                          <span className="font-semibold text-slate-700">No complaints found matching criteria.</span>
                          <button
                            type="button"
                            onClick={handleResetFilters}
                            className="mt-2 text-xs font-bold text-[#1E40AF] underline"
                          >
                            Reset filters
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ledger Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-sm md:flex-row md:items-center md:justify-between">
              <div>
                Showing <strong>{(page - 1) * limit + 1}</strong> to <strong>{Math.min(page * limit, total)}</strong> of{' '}
                <strong>{total}</strong> entries
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:border-[#1E40AF] disabled:opacity-40"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="font-bold text-slate-700 px-2">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:border-[#1E40AF] disabled:opacity-40"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

