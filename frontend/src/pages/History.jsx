import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { Search, Filter, RefreshCw, ChevronLeft, ChevronRight, AlertCircle, Inbox, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function History() {
  const [activeTab, setActiveTab] = useState('track'); // 'track' or 'ledger'
  const [complaints, setComplaints] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Search for tracking
  const [trackId, setTrackId] = useState('');
  const [trackedGrievance, setTrackedGrievance] = useState(null);
  const [statusHistory, setStatusHistory] = useState([]);
  const [trackSearched, setTrackSearched] = useState(false);

  // Search & filters for ledger
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [priority, setPriority] = useState('All');
  const [status, setStatus] = useState('All');
  const [page, setPage] = useState(1);
  const limit = 10;

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        search: activeTab === 'ledger' ? search : '',
        category: activeTab === 'ledger' ? category : 'All',
        priority: activeTab === 'ledger' ? priority : 'All',
        status: activeTab === 'ledger' ? status : 'All',
        page: activeTab === 'ledger' ? page : 1,
        limit: activeTab === 'ledger' ? limit : 100 // Fetch larger set to find items during track
      };
      const response = await apiService.getComplaints(params);
      if (response.status === 'success') {
        setComplaints(response.complaints);
        setTotal(response.total);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch public complaints ledger.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, category, priority, status, page]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

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
    setPage(1);
  };

  const handleTrackSubmit = async (e) => {
    e.preventDefault();
    setTrackSearched(true);
    setError('');
    
    if (!trackId.trim()) {
      setTrackedGrievance(null);
      setStatusHistory([]);
      return;
    }

    const cleanTrackId = trackId.trim().toUpperCase();
    try {
      const response = await apiService.getComplaintByGrievanceId(cleanTrackId);
      setTrackedGrievance(response.complaint);
      setStatusHistory(response.history || []);
      return;
    } catch {
      // Keep legacy internal-ID tracking usable while public IDs roll out.
    }

    const found = complaints.find(
      (c) => c.id.toLowerCase() === cleanTrackId.toLowerCase() || c.id.toLowerCase().startsWith(cleanTrackId.toLowerCase())
    );
    if (found) {
      setTrackedGrievance(found);
      try {
        const historyResponse = await apiService.getComplaintHistory(found.id);
        setStatusHistory(historyResponse.history || []);
      } catch (err) {
        setStatusHistory([]);
        setError(err.message || 'Failed to fetch grievance history.');
      }
    } else {
      setTrackedGrievance(null);
      setStatusHistory([]);
      setError('No grievance found matching this Reference ID. Please verify the ID and try again.');
    }
  };

  const getStatusBadgeClass = (stat) => {
    const mapping = {
      SUBMITTED: 'bg-orange-50 text-[#EA580C] border-orange-200',
      ASSIGNED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      IN_PROGRESS: 'bg-blue-50 text-[#1E40AF] border-blue-200',
      RESOLVED: 'bg-green-50 text-[#16A34A] border-green-200',
      CLOSED: 'bg-slate-100 text-slate-600 border-slate-200',
      REOPENED: 'bg-amber-50 text-amber-700 border-amber-200',
    };
    return mapping[stat] || 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const getPriorityBadgeClass = (pri) => {
    const mapping = {
      High: 'bg-red-50 text-[#DC2626] border-red-200',
      Medium: 'bg-orange-50 text-[#EA580C] border-orange-200',
      Low: 'bg-green-50 text-[#16A34A] border-green-200',
    };
    return mapping[pri] || 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const getSlaLabel = (slaStatus) => ({
    WITHIN_SLA: 'Within Deadline',
    NEAR_DEADLINE: 'Near Deadline',
    SLA_BREACHED: 'SLA Breached',
    RESOLVED_WITHIN_SLA: 'Resolved Within SLA',
    RESOLVED_AFTER_SLA: 'Resolved After SLA',
  }[slaStatus] || slaStatus || 'Unavailable');

  const getEscalationLabel = (escalationStatus) => escalationStatus === 'ESCALATED'
    ? 'Escalated'
    : 'Normal';

  const getTimelineSteps = (ticketStatus) => {
    const steps = [
      { name: 'Submitted', desc: 'Grievance recorded' },
      { name: 'Assigned', desc: 'Allocated to department' },
      { name: 'In Progress', desc: 'Officers resolving issue' },
      { name: 'Resolved', desc: 'Action completed' },
      { name: 'Closed', desc: 'Grievance closed' }
    ];
    const stepIndex = {
      SUBMITTED: 0,
      ASSIGNED: 1,
      IN_PROGRESS: 2,
      REOPENED: 2,
      RESOLVED: 3,
      CLOSED: 4,
    }[ticketStatus] ?? 0;
    return steps.map((step, index) => ({
      ...step,
      state: index < stepIndex ? 'complete' : index === stepIndex ? 'active' : 'upcoming',
    }));
  };

  const totalPages = Math.ceil(total / limit) || 1;

  // Simple parsing of consolidated description text
  const parseComplaintText = (fullText) => {
    const descMarker = "DESCRIPTION:\n";
    if (fullText.includes(descMarker)) {
      const idx = fullText.indexOf(descMarker);
      return {
        preview: fullText.substring(idx + descMarker.length),
        isConsolidated: true,
        meta: fullText.substring(0, idx)
      };
    }
    return {
      preview: fullText,
      isConsolidated: false,
      meta: ''
    };
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 md:px-8">
      {/* Title */}
      <div className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">Grievance Status Portal</h2>
          <p className="mt-1.5 text-xs text-slate-600">Track current status of citizen tickets or audit public grievances ledger.</p>
        </div>
        <button
          onClick={fetchComplaints}
          disabled={loading}
          className="inline-flex items-center gap-1.5 self-start rounded border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Sync Records
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-8 flex border-b border-slate-300">
        <button
          onClick={() => { setActiveTab('track'); setError(''); }}
          className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
            activeTab === 'track'
              ? 'border-[#1E40AF] text-[#1E40AF]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Track Single Grievance
        </button>
        <button
          onClick={() => { setActiveTab('ledger'); setError(''); }}
          className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
            activeTab === 'ledger'
              ? 'border-[#1E40AF] text-[#1E40AF]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Public Redressal Ledger
        </button>
      </div>

      {/* Track Tab View */}
      {activeTab === 'track' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-300 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-2">Track Grievance By Reference ID</h3>
            <p className="text-xs text-slate-500 mb-4">Enter the reference code you received after submitting your complaint to verify resolution progress.</p>
            
            <form onSubmit={handleTrackSubmit} className="flex flex-col gap-3 sm:flex-row max-w-xl">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Enter Grievance ID (e.g. GRV-2026-000001)"
                  value={trackId}
                  onChange={(e) => setTrackId(e.target.value)}
                  className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-[#1E40AF] focus:bg-white font-mono"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 rounded bg-[#1E40AF] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#16327e] transition"
              >
                <Search size={14} /> Search Status
              </button>
            </form>
          </div>

          {/* Search Result Display */}
          {error && activeTab === 'track' && (
            <div className="flex items-center gap-3 rounded border border-rose-300 bg-rose-50 p-4 text-xs font-semibold text-rose-700 shadow-sm">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {trackedGrievance && (
            <div className="rounded-lg border border-slate-300 bg-white p-6 shadow-sm space-y-6">
              {/* Stepper horizontal status tracker */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-6">Redressal Timeline Tracker</h4>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 px-2 bg-slate-50 border border-slate-200 rounded">
                  {getTimelineSteps(trackedGrievance.status).map((step, idx, arr) => (
                    <div key={step.name} className="flex-1 flex items-center gap-3 md:flex-col md:text-center md:gap-2 relative">
                      {/* Connection Line */}
                      {idx < arr.length - 1 && (
                        <div className="hidden md:block absolute left-[calc(50%+16px)] top-[14px] w-[calc(100%-32px)] h-0.5 bg-slate-200" />
                      )}
                      
                      {/* Step Circle */}
                      <div className={`h-8 w-8 rounded-full border-2 flex items-center justify-center font-bold text-xs shrink-0 ${
                        step.state === 'complete'
                          ? 'border-[#16A34A] bg-emerald-50 text-[#16A34A]'
                          : step.state === 'active'
                          ? 'border-[#EA580C] bg-orange-50 text-[#EA580C]'
                          : 'border-slate-300 bg-white text-slate-400'
                      }`}>
                        {step.state === 'complete' ? <CheckCircle2 size={16} /> : idx + 1}
                      </div>

                      {/* Step Info */}
                      <div>
                        <span className={`block text-xs font-bold ${
                          step.state === 'complete'
                            ? 'text-slate-800 font-bold'
                            : step.state === 'active'
                            ? 'text-[#EA580C] font-extrabold'
                            : 'text-slate-500'
                        }`}>{step.name}</span>
                        <span className="block text-[10px] text-slate-400 leading-tight">{step.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Status History</h4>
                <div className="space-y-3">
                  {statusHistory.map((event) => (
                    <div key={`${event.changed_at}-${event.new_status}`} className="flex items-start gap-3 text-xs">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#1E40AF]" />
                      <div>
                        <p className="font-bold text-slate-800">{event.new_status}</p>
                        <p className="text-slate-500">
                          {new Date(event.changed_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                          {' '}by {event.changed_by}
                        </p>
                        {event.remark && <p className="mt-0.5 text-slate-600">{event.remark}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grievance Info Grid */}
              <div className="border-t border-slate-200 pt-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Grievance Information Details</h4>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Reference ID</span>
                      <span className="font-mono text-xs font-bold text-slate-900">{trackedGrievance.grievance_id || trackedGrievance.id}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Department</span>
                      <span className="text-xs font-bold text-[#1E40AF]">{trackedGrievance.department || trackedGrievance.category}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Grievance Description Details</span>
                      <div className="mt-1 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded p-3 leading-relaxed whitespace-pre-line font-medium">
                        {parseComplaintText(trackedGrievance.complaint_text).preview}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Logged Date</span>
                      <span className="text-xs font-semibold text-slate-700">
                        {new Date(trackedGrievance.timestamp).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Status</span>
                      <span className={`mt-1 inline-flex rounded border px-2.5 py-0.5 text-[10px] font-bold ${getStatusBadgeClass(trackedGrievance.status)}`}>
                        {trackedGrievance.status}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Priority Level</span>
                      <span className={`mt-1 inline-flex rounded border px-2.5 py-0.5 text-[10px] font-bold ${getPriorityBadgeClass(trackedGrievance.priority)}`}>
                        {trackedGrievance.priority} Severity
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Expected Resolution</span>
                      <span className="text-xs font-semibold text-slate-700">
                        {trackedGrievance.sla_deadline
                          ? new Date(trackedGrievance.sla_deadline).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })
                          : 'Unavailable'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">SLA Status</span>
                      <span className="text-xs font-semibold text-slate-700">{getSlaLabel(trackedGrievance.sla_status)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Escalation</span>
                      <span className="text-xs font-semibold text-slate-700">{getEscalationLabel(trackedGrievance.escalation_status)}</span>
                    </div>
                    
                    {parseComplaintText(trackedGrievance.complaint_text).isConsolidated && (
                      <div className="rounded border border-slate-200 bg-slate-50 p-3.5">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Location & Metadata</span>
                        <pre className="text-[10px] text-slate-600 font-sans leading-normal whitespace-pre-line">
                          {parseComplaintText(trackedGrievance.complaint_text).meta.trim()}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!trackedGrievance && trackSearched && !error && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500">
              <Inbox size={32} className="mx-auto mb-2 text-slate-300" />
              <span>Please enter a valid Reference ID in the tracking box above.</span>
            </div>
          )}
        </div>
      )}

      {/* Ledger Tab View */}
      {activeTab === 'ledger' && (
        <div className="space-y-6">
          {/* Ledger filters */}
          <div className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
            <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Search grievance descriptions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded border border-slate-300 bg-slate-50 pl-9 pr-4 py-2.5 text-xs text-slate-800 outline-none focus:border-[#1E40AF] focus:bg-white"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="rounded bg-[#1E40AF] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#16327e] transition">Search</button>
                <button type="button" onClick={handleResetFilters} className="rounded border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition">Clear</button>
              </div>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-4 text-xs text-slate-600">
              <div className="flex items-center gap-1.5"><Filter size={13} className="text-[#1E40AF]" /> Filter Selection</div>
              <div className="flex items-center gap-1.5">
                <span>Category:</span>
                <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="rounded border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs outline-none focus:border-[#1E40AF]">
                  <option value="All">All Categories</option>
                  <option value="Water">Water</option>
                  <option value="Electricity">Electricity</option>
                  <option value="Road">Road</option>
                  <option value="Garbage">Garbage</option>
                  <option value="Others">Others</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span>Priority:</span>
                <select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} className="rounded border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs outline-none focus:border-[#1E40AF]">
                  <option value="All">All Priorities</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span>Status:</span>
                <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs outline-none focus:border-[#1E40AF]">
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

          {error && activeTab === 'ledger' && (
            <div className="flex items-center gap-3 rounded border border-rose-300 bg-rose-50 p-4 text-xs font-semibold text-rose-700 shadow-sm">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Ledger Table */}
          <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                    <th className="p-3.5 pl-5 w-28">Ref ID</th>
                    <th className="p-3.5 w-36">Logged Date</th>
                    <th className="p-3.5">Grievance Description Summary</th>
                    <th className="p-3.5 w-28">Department</th>
                    <th className="p-3.5 w-24">Severity</th>
                    <th className="p-3.5 w-28">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? (
                    [...Array(4)].map((_, i) => (
                      <tr key={i} className="bg-white">
                        <td className="p-4 pl-5"><div className="h-3 w-16 rounded bg-slate-200 animate-pulse" /></td>
                        <td className="p-4"><div className="h-3 w-20 rounded bg-slate-200 animate-pulse" /></td>
                        <td className="p-4"><div className="h-3 w-3/4 rounded bg-slate-200 animate-pulse" /></td>
                        <td className="p-4"><div className="h-3 w-12 rounded bg-slate-200 animate-pulse" /></td>
                        <td className="p-4"><div className="h-3 w-12 rounded bg-slate-200 animate-pulse" /></td>
                        <td className="p-4"><div className="h-3.5 w-16 rounded bg-slate-200 animate-pulse" /></td>
                      </tr>
                    ))
                  ) : complaints.length > 0 ? (
                    complaints.map((item) => (
                      <tr key={item.id} className="transition hover:bg-slate-50">
                        <td className="p-3.5 pl-5 font-mono font-bold text-slate-500 select-all">
                          {item.grievance_id || `#${item.id.substring(0, 8)}`}
                        </td>
                        <td className="p-3.5 whitespace-nowrap text-slate-600">
                          {new Date(item.timestamp).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </td>
                        <td className="p-3.5 leading-relaxed text-slate-700 max-w-sm truncate">
                          {parseComplaintText(item.complaint_text).preview}
                        </td>
                        <td className="p-3.5">
                          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-[#1E40AF]">
                            {item.department || item.category}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${getPriorityBadgeClass(item.priority)}`}>
                            {item.priority}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className={`inline-flex items-center gap-1 rounded border px-2.5 py-0.5 text-[10px] font-bold ${getStatusBadgeClass(item.status)}`}>
                            {(item.status === 'RESOLVED' || item.status === 'CLOSED') && <ShieldCheck size={11} />}
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-500">
                        <div className="flex flex-col items-center gap-2">
                          <Inbox size={32} className="text-slate-300" />
                          <span>No public grievances found matching criteria.</span>
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
            <div className="mt-4 flex flex-col gap-3 rounded border border-slate-300 bg-white p-4 text-xs text-slate-600 shadow-sm md:flex-row md:items-center md:justify-between">
              <div>Showing <strong>{(page - 1) * limit + 1}</strong> to <strong>{Math.min(page * limit, total)}</strong> of <strong>{total}</strong> entries</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading} className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-[#1E40AF] disabled:opacity-40"><ChevronLeft size={14} /></button>
                <span className="font-bold text-slate-700">Page {page} of {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading} className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-[#1E40AF] disabled:opacity-40"><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
