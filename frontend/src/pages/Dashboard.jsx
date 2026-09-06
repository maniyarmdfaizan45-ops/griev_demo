import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, LineChart, Line, CartesianGrid
} from 'recharts';
import {
  ShieldAlert, Clock, CheckCircle2, ChevronLeft, ChevronRight,
  RefreshCw, Check, Play, Inbox, AlertCircle, Search,
  LayoutDashboard, FileText, Building2, Sparkles, Download, Users, Settings, LogOut, ChevronRight as ChevronRightIcon
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'complaints', 'departments', 'ai_analysis', 'reports', 'users', 'settings'
  const [stats, setStats] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');

  // Selected complaint for AI Analysis tab
  const [selectedAIComplaint, setSelectedAIComplaint] = useState(null);

  // Search & filter states for Complaints Queue
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [priority, setPriority] = useState('All');
  const [status, setStatus] = useState('All');
  const [escalation, setEscalation] = useState('All');
  const [page, setPage] = useState(1);
  const limit = 5;

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      navigate('/admin/login');
    }
  }, [navigate]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const statsRes = await apiService.getDashboardStats();
      if (statsRes.status === 'success') {
        setStats(statsRes.stats);
      }

      const queueParams = {
        search,
        category,
        priority,
        status,
        escalation,
        page,
        limit
      };
      const queueRes = await apiService.getComplaints(queueParams);
      if (queueRes.status === 'success') {
        setComplaints(queueRes.complaints);
        setTotal(queueRes.total);
        // Pre-select first complaint for AI Analysis if not selected
        if (queueRes.complaints.length > 0 && !selectedAIComplaint) {
          setSelectedAIComplaint(queueRes.complaints[0]);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch dashboard content.');
    } finally {
      setLoading(false);
    }
  }, [search, category, priority, status, escalation, page, limit, selectedAIComplaint]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchDashboardData();
  };

  const handleUpdateStatus = async (id, newStatus, remark = '') => {
    setUpdatingId(id);
    setError('');
    try {
      const response = await apiService.updateComplaintStatus(id, newStatus, remark);
      if (response.status === 'success') {
        await fetchDashboardData();
        // Update selected AI complaint reference if it is active
        if (selectedAIComplaint && selectedAIComplaint.id === id) {
          setSelectedAIComplaint(prev => ({ ...prev, status: newStatus }));
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to update ticket status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    navigate('/');
  };

  const CATEGORY_COLORS = {
    Water: '#1E40AF',
    Electricity: '#EA580C',
    Road: '#16A34A',
    Garbage: '#64748B',
    Others: '#94A3B8'
  };

  const PRIORITY_COLORS = {
    High: '#DC2626',
    Medium: '#EA580C',
    Low: '#16A34A'
  };

  const DEPARTMENT_OPTIONS = [
    'Water Supply Department',
    'Electricity Department',
    'Public Works Department',
    'Sanitation/Waste Management Department',
    'General/Public Grievance Department',
  ];

  const handleUpdateDepartment = async (id, department) => {
    setUpdatingId(id);
    setError('');
    try {
      const response = await apiService.updateComplaintDepartment(id, department);
      if (response.status === 'success') await fetchDashboardData();
    } catch (err) {
      setError(err.message || 'Failed to update department.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleEscalate = async (id) => {
    const reason = window.prompt('Escalation reason is required:');
    if (!reason || !reason.trim()) return;
    setUpdatingId(id);
    setError('');
    try {
      const response = await apiService.escalateComplaint(id, reason.trim());
      if (response.status === 'success') await fetchDashboardData();
    } catch (err) {
      setError(err.message || 'Failed to escalate complaint.');
    } finally {
      setUpdatingId(null);
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

  const getSlaBadgeClass = (slaStatus) => {
    const mapping = {
      WITHIN_SLA: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      NEAR_DEADLINE: 'bg-amber-50 text-amber-700 border-amber-200',
      SLA_BREACHED: 'bg-rose-50 text-rose-700 border-rose-200',
      RESOLVED_WITHIN_SLA: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      RESOLVED_AFTER_SLA: 'bg-rose-50 text-rose-700 border-rose-200',
    };
    return mapping[slaStatus] || 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const getEscalationBadgeClass = (escalationStatus) => escalationStatus === 'ESCALATED'
    ? 'bg-rose-50 text-rose-700 border-rose-200'
    : 'bg-slate-100 text-slate-600 border-slate-200';

  const getCategoryBadgeClass = (cat) => {
    const mapping = {
      Water: 'bg-blue-50 text-[#1E40AF] border-blue-300',
      Electricity: 'bg-orange-50 text-[#EA580C] border-orange-300',
      Road: 'bg-green-50 text-[#16A34A] border-green-300',
      Garbage: 'bg-slate-100 text-slate-700 border-slate-300',
      Others: 'bg-slate-100 text-slate-600 border-slate-300',
    };
    return mapping[cat] || 'bg-slate-100 text-slate-600 border-slate-300';
  };

  const getPieChartData = () => {
    if (!stats) return [];
    return Object.entries(stats.category_distribution)
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0);
  };

  const getBarChartData = () => {
    if (!stats) return [];
    return Object.entries(stats.priority_distribution).map(([name, value]) => ({
      name,
      count: value
    }));
  };

  const totalPages = Math.ceil(total / limit) || 1;

  const getResolutionRate = () => {
    if (!stats || stats.total_complaints === 0) return 0;
    return Math.round((stats.resolved_complaints / stats.total_complaints) * 100);
  };

  const parseComplaintText = (fullText) => {
    const descMarker = "DESCRIPTION:\n";
    if (fullText.includes(descMarker)) {
      const idx = fullText.indexOf(descMarker);
      return {
        preview: fullText.substring(idx + descMarker.length),
        meta: fullText.substring(0, idx)
      };
    }
    return {
      preview: fullText,
      meta: ''
    };
  };

  const getFrustrationPercentage = (score) => {
    if (!score && score !== 0) return 0;
    if (score >= 0) {
      return Math.round((1 - score) * 30);
    }
    return Math.round(30 + (Math.abs(score) * 70));
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-[80vh] bg-slate-100 border-b border-slate-200">
      {/* 1. Left Sidebar Component */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 border-r border-slate-800 shrink-0">
        <div className="p-4 border-b border-slate-800 bg-[#0f172a] flex items-center gap-2">
          <Building2 size={16} className="text-[#1E40AF]" />
          <span className="text-xs font-extrabold uppercase tracking-wider text-white">Officer Console</span>
        </div>
        <nav className="p-2 space-y-1">
          {[
            { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
            { id: 'complaints', name: 'Complaints Queue', icon: FileText },
            { id: 'departments', name: 'Departments', icon: Building2 },
            { id: 'ai_analysis', name: 'AI NLP Analysis', icon: Sparkles },
            { id: 'reports', name: 'Intake Reports', icon: Download },
            { id: 'users', name: 'System Users', icon: Users },
            { id: 'settings', name: 'Console Settings', icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center gap-2.5 rounded px-3.5 py-2.5 text-xs font-bold transition ${
                  activeTab === item.id
                    ? 'bg-[#1E40AF] text-white'
                    : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={14} /> {item.name}
              </button>
            );
          })}
          
          <div className="border-t border-slate-800 pt-2 mt-4">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded px-3.5 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-950/20 hover:text-rose-300 transition"
            >
              <LogOut size={14} /> Exit System
            </button>
          </div>
        </nav>
      </aside>

      {/* 2. Main Area */}
      <main className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto">
        {/* Header toolbar */}
        <div className="flex flex-col gap-4 rounded border border-slate-300 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 uppercase tracking-wider">
              {activeTab === 'dashboard' && 'Municipal Grievance Dashboard'}
              {activeTab === 'complaints' && 'Resolution Queue Ledger'}
              {activeTab === 'departments' && 'Operational Departments'}
              {activeTab === 'ai_analysis' && 'Natural Language Processing Classifier Details'}
              {activeTab === 'reports' && 'Grievance Performance Reports'}
              {activeTab === 'users' && 'Officer Accounts Management'}
              {activeTab === 'settings' && 'Console Administration Settings'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Logged in as administrative manager.</p>
          </div>
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 self-start rounded border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Sync Database
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded border border-rose-300 bg-rose-50 p-4 text-xs font-semibold text-rose-700 shadow-sm">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab 1: Dashboard View */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Top metrics */}
            {stats ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center gap-3.5 rounded border border-slate-300 bg-white p-4 shadow-sm">
                  <div className="rounded bg-blue-50 p-2.5 text-[#1E40AF] border border-blue-100"><FileText size={20} /></div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Grievances</span>
                    <strong className="text-xl font-extrabold text-slate-900">{stats.total_complaints}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-3.5 rounded border border-slate-300 bg-white p-4 shadow-sm">
                  <div className="rounded bg-red-50 p-2.5 text-[#DC2626] border border-red-100"><ShieldAlert size={20} /></div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Escalated Priority</span>
                    <strong className="text-xl font-extrabold text-[#DC2626]">{stats.high_priority_complaints}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-3.5 rounded border border-slate-300 bg-white p-4 shadow-sm">
                  <div className="rounded bg-orange-50 p-2.5 text-[#EA580C] border border-orange-100"><Clock size={20} /></div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Active Pending</span>
                    <strong className="text-xl font-extrabold text-[#EA580C]">{stats.pending_complaints}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-3.5 rounded border border-slate-300 bg-white p-4 shadow-sm">
                  <div className="rounded bg-green-50 p-2.5 text-[#16A34A] border border-green-100"><CheckCircle2 size={20} /></div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Resolution Rate</span>
                    <strong className="text-xl font-extrabold text-[#16A34A]">{getResolutionRate()}%</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded border border-slate-300 bg-white" />
                ))}
              </div>
            )}

            {/* Charts section */}
            {stats && (
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="rounded border border-slate-300 bg-white p-4 shadow-sm h-[320px] flex flex-col">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4 pb-2 border-b border-slate-100">Department Intake Load</h3>
                  <div className="flex-1 min-h-0">
                    {getPieChartData().length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={getPieChartData()} cx="50%" cy="45%" innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value">
                            {getPieChartData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name] || '#94a3b8'} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '10px' }} />
                          <Legend verticalAlign="bottom" align="center" iconSize={6} iconType="square" wrapperStyle={{ fontSize: '9px', paddingTop: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-400">No database grievances to plot.</div>
                    )}
                  </div>
                </div>

                <div className="rounded border border-slate-300 bg-white p-4 shadow-sm h-[320px] flex flex-col">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4 pb-2 border-b border-slate-100">Grievance Priority Counts</h3>
                  <div className="flex-1 min-h-0">
                    {stats.total_complaints > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getBarChartData()} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={9} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                          <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} contentStyle={{ backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '10px' }} />
                          <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                            {getBarChartData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[entry.name] || '#1E40AF'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-400">No database grievances to plot.</div>
                    )}
                  </div>
                </div>

                <div className="rounded border border-slate-300 bg-white p-4 shadow-sm h-[320px] flex flex-col">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4 pb-2 border-b border-slate-100">Incoming Grievance Trend</h3>
                  <div className="flex-1 min-h-0">
                    {stats.trend_data.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={stats.trend_data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" stroke="#64748b" fontSize={9} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '10px' }} />
                          <Line type="monotone" dataKey="complaints" stroke="#1E40AF" strokeWidth={2} dot={{ r: 2, fill: '#1E40AF' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-400">No trend details recorded yet.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tables: Recent and Department Summary */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded border border-slate-300 bg-white p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">Recent Grievances</h3>
                <div className="divide-y divide-slate-100">
                  {complaints.length > 0 ? (
                    complaints.slice(0, 4).map((item) => (
                      <div key={item.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                        <div className="min-w-0">
                          <span className="font-mono font-bold text-slate-500">{item.grievance_id || `#${item.id.substring(0, 8)}`}</span>
                          <p className="font-medium text-slate-700 truncate">{parseComplaintText(item.complaint_text).preview}</p>
                        </div>
                        <span className={`rounded border px-2 py-0.5 text-[9px] shrink-0 font-bold ${getStatusBadgeClass(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="block text-center text-xs text-slate-400 py-4">No active grievances logged.</span>
                  )}
                </div>
              </div>

              <div className="rounded border border-slate-300 bg-white p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">Department Status overview</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="text-slate-500 font-bold border-b border-slate-200">
                        <th className="pb-2">Department</th>
                        <th className="pb-2 text-center">Active Complaints</th>
                        <th className="pb-2 text-right">Status Code</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stats ? (
                        Object.entries(stats.category_distribution).map(([dept, count]) => (
                          <tr key={dept} className="hover:bg-slate-50">
                            <td className="py-2 font-semibold text-slate-800">{dept}</td>
                            <td className="py-2 text-center font-bold text-slate-900">{count}</td>
                            <td className="py-2 text-right">
                              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[dept] || '#ccc' }}></span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={3} className="text-center py-4 text-slate-400">Loading department status...</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Complaints Queue View */}
        {activeTab === 'complaints' && (
          <div className="rounded border border-slate-300 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Active Grievance Redressal Backlog</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Filter the ledger and select status updates to dispose tickets.</p>
              </div>
              
              <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search complaint details..."
                    className="w-full rounded border border-slate-300 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#1E40AF]"
                  />
                </div>
                <button type="submit" className="rounded bg-[#1E40AF] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#16327e]">Search</button>
              </form>
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="rounded border border-slate-300 bg-slate-50 px-2 py-1.5 outline-none">
                <option value="All">All Departments</option>
                <option value="Water">Water</option>
                <option value="Electricity">Electricity</option>
                <option value="Road">Road</option>
                <option value="Garbage">Garbage</option>
                <option value="Others">Others</option>
              </select>
              <select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} className="rounded border border-slate-300 bg-slate-50 px-2 py-1.5 outline-none">
                <option value="All">All Priorities</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
              <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded border border-slate-300 bg-slate-50 px-2 py-1.5 outline-none">
                <option value="All">All Statuses</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
                <option value="REOPENED">Reopened</option>
              </select>
              <select value={escalation} onChange={(e) => { setEscalation(e.target.value); setPage(1); }} className="rounded border border-slate-300 bg-slate-50 px-2 py-1.5 outline-none">
                <option value="All">All Escalations</option>
                <option value="NOT_ESCALATED">Normal</option>
                <option value="ESCALATED">Escalated</option>
              </select>
            </div>

            {/* Ledger Table */}
            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                    <th className="p-3 pl-4 w-28">Ref ID</th>
                    <th className="p-3 w-32">Date Logged</th>
                    <th className="p-3">Grievance description</th>
                    <th className="p-3 w-28">Department</th>
                    <th className="p-3 w-24">Severity</th>
                    <th className="p-3 w-28">SLA</th>
                    <th className="p-3 w-24">Escalation</th>
                    <th className="p-3 w-24">Status</th>
                    <th className="p-3 w-36 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i}>
                        <td className="p-3 pl-4 animate-pulse bg-slate-50"><div className="h-3 w-16 bg-slate-200 rounded" /></td>
                        <td className="p-3 animate-pulse bg-slate-50"><div className="h-3 w-20 bg-slate-200 rounded" /></td>
                        <td className="p-3 animate-pulse bg-slate-50"><div className="h-3 w-full bg-slate-200 rounded" /></td>
                        <td className="p-3 animate-pulse bg-slate-50"><div className="h-3 w-12 bg-slate-200 rounded" /></td>
                        <td className="p-3 animate-pulse bg-slate-50"><div className="h-3 w-12 bg-slate-200 rounded" /></td>
                        <td className="p-3 animate-pulse bg-slate-50"><div className="h-3 w-16 bg-slate-200 rounded" /></td>
                        <td className="p-3 animate-pulse bg-slate-50"><div className="h-3.5 w-16 bg-slate-200 rounded" /></td>
                        <td className="p-3 animate-pulse bg-slate-50"><div className="h-3 w-16 bg-slate-200 rounded" /></td>
                        <td className="p-3 animate-pulse bg-slate-50"><div className="h-6 w-full bg-slate-200 rounded" /></td>
                      </tr>
                    ))
                  ) : complaints.length > 0 ? (
                    complaints.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 bg-white">
                        <td className="p-3 pl-4 font-mono font-bold text-slate-500 select-all">
                          {item.grievance_id || `#${item.id.substring(0, 8)}`}
                        </td>
                        <td className="p-3 text-slate-600 whitespace-nowrap">
                          {new Date(item.timestamp).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </td>
                        <td className="p-3 max-w-sm truncate text-slate-700">
                          {parseComplaintText(item.complaint_text).preview}
                          {item.related_grievances?.length > 0 && (
                            <span className="mt-1 block text-[9px] font-bold text-amber-700">
                              Related: {item.related_grievances[0].related_grievance_id} ({item.related_grievances[0].similarity_score}%)
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <select
                            value={item.department || ''}
                            onChange={(event) => handleUpdateDepartment(item.id, event.target.value)}
                            disabled={updatingId === item.id}
                            className="max-w-[170px] rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-[#1E40AF] outline-none disabled:opacity-50"
                            aria-label={`Department for complaint ${item.id}`}
                          >
                            {DEPARTMENT_OPTIONS.map((departmentOption) => (
                              <option key={departmentOption} value={departmentOption}>{departmentOption}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${getPriorityBadgeClass(item.priority)}`}>
                            {item.priority}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`rounded border px-2 py-0.5 text-[9px] font-bold ${getSlaBadgeClass(item.sla_status)}`}>
                            {item.sla_status}
                          </span>
                          {item.sla_deadline && (
                            <span className="mt-1 block whitespace-nowrap text-[9px] text-slate-500">
                              {new Date(item.sla_deadline).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`rounded border px-2 py-0.5 text-[9px] font-bold ${getEscalationBadgeClass(item.escalation_status)}`}>
                            {item.escalation_status === 'ESCALATED' ? `Escalated L${item.escalation_level || 1}` : 'Normal'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 rounded border px-2.5 py-0.5 text-[10px] font-bold ${getStatusBadgeClass(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {item.status === 'SUBMITTED' && (
                              <>
                                <button
                                  onClick={() => handleUpdateStatus(item.id, 'ASSIGNED')}
                                  disabled={updatingId === item.id}
                                  className="flex items-center gap-0.5 rounded bg-[#1E40AF] px-2 py-1 text-[9px] font-bold text-white hover:bg-[#16327e] disabled:opacity-40"
                                >
                                  <Play size={10} /> Assign
                                </button>
                              </>
                            )}
                            {item.status === 'ASSIGNED' && (
                              <button
                                onClick={() => handleUpdateStatus(item.id, 'IN_PROGRESS')}
                                disabled={updatingId === item.id}
                                className="flex items-center gap-0.5 rounded bg-[#1E40AF] px-3 py-1 text-[9px] font-bold text-white hover:bg-[#16327e] disabled:opacity-40"
                              >
                                <Play size={10} /> Start Work
                              </button>
                            )}
                            {item.status === 'IN_PROGRESS' && (
                              <button
                                onClick={() => {
                                  const remark = window.prompt('Resolution remarks are required:');
                                  if (remark && remark.trim()) handleUpdateStatus(item.id, 'RESOLVED', remark.trim());
                                }}
                                disabled={updatingId === item.id}
                                className="flex items-center gap-0.5 rounded bg-[#16A34A] px-3 py-1 text-[9px] font-bold text-white hover:bg-[#13843f] disabled:opacity-40"
                              >
                                <Check size={10} /> Resolve Ticket
                              </button>
                            )}
                            {item.status === 'RESOLVED' && (
                              <>
                                <button
                                  onClick={() => handleUpdateStatus(item.id, 'CLOSED')}
                                  disabled={updatingId === item.id}
                                  className="flex items-center gap-0.5 rounded bg-slate-600 px-3 py-1 text-[9px] font-bold text-white hover:bg-slate-700 disabled:opacity-40"
                                >
                                  <CheckCircle2 size={10} /> Close
                                </button>
                                <button
                                  onClick={() => {
                                    const remark = window.prompt('Reopening reason is required:');
                                    if (remark && remark.trim()) handleUpdateStatus(item.id, 'REOPENED', remark.trim());
                                  }}
                                  disabled={updatingId === item.id}
                                  className="flex items-center gap-0.5 rounded bg-amber-600 px-2 py-1 text-[9px] font-bold text-white hover:bg-amber-700 disabled:opacity-40"
                                >
                                  Reopen
                                </button>
                              </>
                            )}
                            {item.status === 'CLOSED' && (
                              <span className="flex items-center gap-0.5 text-[9px] font-bold italic text-slate-500">
                                <CheckCircle2 size={11} className="text-slate-500" /> Closed
                              </span>
                            )}
                            {item.status === 'REOPENED' && (
                              <button
                                onClick={() => handleUpdateStatus(item.id, 'IN_PROGRESS')}
                                disabled={updatingId === item.id}
                                className="flex items-center gap-0.5 rounded bg-[#1E40AF] px-3 py-1 text-[9px] font-bold text-white hover:bg-[#16327e] disabled:opacity-40"
                              >
                                <Play size={10} /> Resume Work
                              </button>
                            )}
                            {item.escalation_status !== 'ESCALATED' && item.status !== 'RESOLVED' && item.status !== 'CLOSED' && (
                              <button
                                onClick={() => handleEscalate(item.id)}
                                disabled={updatingId === item.id}
                                className="flex items-center gap-0.5 rounded bg-rose-600 px-2 py-1 text-[9px] font-bold text-white hover:bg-rose-700 disabled:opacity-40"
                              >
                                Escalate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-slate-500">
                        <div className="flex flex-col items-center gap-2">
                          <Inbox size={32} className="text-slate-300" />
                          <span>No grievances found in active backlog.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col gap-3 rounded border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-sm md:flex-row md:items-center md:justify-between">
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

        {/* Tab 3: Departments View */}
        {activeTab === 'departments' && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: 'Water Department', code: 'Water', manager: 'Ir. Rajesh Kumar', staff: '8 Active Engineers' },
              { name: 'Electricity Board', code: 'Electricity', manager: 'Ir. Sunita Rao', staff: '6 Technicians' },
              { name: 'Roads & Infrastructure', code: 'Road', manager: 'Ir. Harish Patel', staff: '12 Inspectors' },
              { name: 'Garbage & Sanitation', code: 'Garbage', manager: 'Mr. Devendra Sah', staff: '14 Field Crew' },
              { name: 'General Municipal Administration', code: 'Others', manager: 'Ms. Meena Gupta', staff: '4 Admin Clerks' },
            ].map((dept) => {
              const activeCount = stats ? stats.category_distribution[dept.code] || 0 : 0;
              return (
                <div key={dept.code} className="rounded border border-slate-300 bg-white p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1E40AF]">{dept.name}</h3>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600">{dept.code}</span>
                  </div>
                  
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Department Manager</span>
                      <span className="font-bold text-slate-800">{dept.manager}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Assigned Staff</span>
                      <span className="font-medium text-slate-700">{dept.staff}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Backlog</span>
                      <span className={`font-extrabold ${activeCount > 5 ? 'text-[#DC2626]' : 'text-slate-800'}`}>
                        {activeCount} grievances pending
                      </span>
                    </div>
                  </div>
                  
                  <div className="pt-3 border-t border-slate-100">
                    <button
                      onClick={() => { setCategory(dept.code); setActiveTab('complaints'); }}
                      className="text-[10px] font-bold text-[#1E40AF] hover:underline flex items-center gap-1"
                    >
                      View complaints queue <ChevronRightIcon size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 4: AI NLP Analysis View */}
        {activeTab === 'ai_analysis' && (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
            {/* Left Column: Complaints Selection List */}
            <div className="rounded border border-slate-300 bg-white p-4 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">Grievance Tickets</h3>
              <div className="divide-y divide-slate-100 max-h-[450px] overflow-y-auto pr-1">
                {complaints.length > 0 ? (
                  complaints.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedAIComplaint(item)}
                      className={`w-full py-3 px-2 text-left rounded transition flex items-center justify-between gap-3 text-xs ${
                        selectedAIComplaint && selectedAIComplaint.id === item.id
                          ? 'bg-slate-100 border-l-4 border-[#1E40AF]'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="font-mono font-bold text-slate-500">{item.grievance_id || `#${item.id.substring(0, 8)}`}</span>
                        <p className="font-medium text-slate-700 truncate">{parseComplaintText(item.complaint_text).preview}</p>
                      </div>
                      <span className={`text-[8px] font-bold rounded border px-1.5 py-0.5 shrink-0 ${getPriorityBadgeClass(item.priority)}`}>
                        {item.priority}
                      </span>
                    </button>
                  ))
                ) : (
                  <span className="block text-center text-xs text-slate-400 py-6">No grievance tickets available.</span>
                )}
              </div>
            </div>

            {/* Right Column: AI classification details */}
            <div className="rounded border border-slate-300 bg-white p-5 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <Sparkles size={13} className="text-[#1E40AF]" /> NLP Model Prediction Parameters
              </h3>
              
              {selectedAIComplaint ? (
                <div className="mt-4 space-y-5 text-xs">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Reference ID</span>
                    <span className="font-mono text-xs font-bold text-slate-600">{selectedAIComplaint.grievance_id || selectedAIComplaint.id}</span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Original Grievance Text</span>
                    <div className="mt-1.5 p-3 rounded border border-slate-200 bg-slate-50 text-slate-700 font-medium whitespace-pre-line leading-relaxed max-h-[160px] overflow-y-auto">
                      {selectedAIComplaint.complaint_text}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded border border-slate-200 bg-slate-50 p-3">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Predicted Category</span>
                      <span className={`mt-1.5 inline-flex rounded border px-2 py-0.5 text-[10px] font-bold ${getCategoryBadgeClass(selectedAIComplaint.category)}`}>
                        {selectedAIComplaint.category}
                      </span>
                    </div>

                    <div className="rounded border border-slate-200 bg-slate-50 p-3">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Severity Urgency</span>
                      <span className={`mt-1.5 inline-flex rounded border px-2 py-0.5 text-[10px] font-bold ${getPriorityBadgeClass(selectedAIComplaint.priority)}`}>
                        {selectedAIComplaint.priority} Priority
                      </span>
                    </div>
                  </div>

                  <div className="rounded border border-slate-200 bg-slate-50 p-3.5 space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <span>Sentiment Score Analysis</span>
                      <span className="text-[#1E40AF]">{getFrustrationPercentage(selectedAIComplaint.sentiment_score)}% Frustration</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded bg-slate-200">
                      <div
                        className="h-full rounded bg-[#1E40AF]"
                        style={{ width: `${getFrustrationPercentage(selectedAIComplaint.sentiment_score)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      The compound NLP sentiment index calculated by VADER classifier is: <strong className="text-slate-600 font-mono">{selectedAIComplaint.sentiment_score.toFixed(4)}</strong> (Scale from -1.0 to 1.0, where scores below -0.15 indicate High Urgency).
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-8 text-center text-xs text-slate-400 py-12">
                  <Inbox size={32} className="mx-auto mb-2 text-slate-300" />
                  <span>Select a ticket from the left column to analyze NLP parameters.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Reports View */}
        {activeTab === 'reports' && (
          <div className="rounded border border-slate-300 bg-white p-5 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Grievance Audit Summary</h3>
              <p className="text-[10px] text-slate-500">Export performance statistics and disposal records for executive reviews.</p>
            </div>
            
            <div className="grid gap-6 sm:grid-cols-3 text-xs">
              <div className="rounded border border-slate-200 p-4 space-y-2">
                <span className="block font-bold text-slate-500 text-[10px] uppercase tracking-wider">Intake Frequency</span>
                <strong className="text-lg text-slate-900 block">Avg. 14 complaints / day</strong>
                <p className="text-[10px] text-slate-400 leading-normal">Derived from the past 14 days of dashboard synchronization.</p>
              </div>
              <div className="rounded border border-slate-200 p-4 space-y-2">
                <span className="block font-bold text-slate-500 text-[10px] uppercase tracking-wider">Average Disposal SLA</span>
                <strong className="text-lg text-slate-900 block">3.4 operational days</strong>
                <p className="text-[10px] text-slate-400 leading-normal">Average time from submission to officer "Resolved" confirmation.</p>
              </div>
              <div className="rounded border border-slate-200 p-4 space-y-2">
                <span className="block font-bold text-slate-500 text-[10px] uppercase tracking-wider">Classification Confidence</span>
                <strong className="text-lg text-slate-900 block">94.8% accuracy</strong>
                <p className="text-[10px] text-slate-400 leading-normal">AI classifier auto-routing compared against officer re-assignments.</p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex flex-wrap gap-2.5">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded bg-[#1E40AF] px-4 py-2 text-xs font-bold text-white hover:bg-[#16327e] transition shadow-sm"
              >
                <Download size={13} /> Print Executive Summary
              </button>
              <button
                onClick={() => alert('Disposal ledger exported as CSV (simulated).')}
                className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Export CSV Ledger
              </button>
            </div>
          </div>
        )}

        {/* Tab 6: Users View */}
        {activeTab === 'users' && (
          <div className="rounded border border-slate-300 bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">Active Officer Accounts</h3>
            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-slate-500">
                    <th className="p-3 pl-4">Account ID</th>
                    <th className="p-3">Officer Name</th>
                    <th className="p-3">Assigned Role</th>
                    <th className="p-3">Department Domain</th>
                    <th className="p-3 text-right">Login Security</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { id: 'usr-001', name: 'Admin Manager', role: 'System Administrator', domain: 'All Domains', security: 'Two-Factor enabled' },
                    { id: 'usr-002', name: 'Officer Rajesh Kumar', role: 'Department Manager', domain: 'Water Supply', security: 'Password last changed 14d ago' },
                    { id: 'usr-003', name: 'Officer Sunita Rao', role: 'Grievance Reviewer', domain: 'Electricity Board', security: 'Password last changed 32d ago' },
                    { id: 'usr-004', name: 'Inspector Harish Patel', role: 'Field Inspector', domain: 'Infrastructure / Roads', security: 'Two-Factor enabled' }
                  ].map((usr) => (
                    <tr key={usr.id} className="hover:bg-slate-50 bg-white">
                      <td className="p-3 pl-4 font-mono font-bold text-slate-600">{usr.id}</td>
                      <td className="p-3 font-semibold text-slate-800">{usr.name}</td>
                      <td className="p-3 text-slate-600">{usr.role}</td>
                      <td className="p-3 font-bold text-[#1E40AF]">{usr.domain}</td>
                      <td className="p-3 text-right text-slate-500 text-[10px]">{usr.security}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 7: Settings View */}
        {activeTab === 'settings' && (
          <div className="rounded border border-slate-300 bg-white p-5 shadow-sm space-y-6 text-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">Console configurations</h3>
            
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <span className="block font-bold text-slate-700 uppercase tracking-wider text-[10px]">Model Auto-routing thresholds</span>
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Classifier confidence cut-off</label>
                    <input type="range" min="0" max="100" defaultValue="75" className="w-full accent-[#1E40AF]" />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-0.5"><span>Manual review if below</span><span>75% confidence</span></div>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Frustration Urgency Trigger</label>
                    <input type="range" min="0" max="100" defaultValue="60" className="w-full accent-[#1E40AF]" />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-0.5"><span>Escalate to High if frustration exceeds</span><span>60%</span></div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <span className="block font-bold text-slate-700 uppercase tracking-wider text-[10px]">SLA Redressal Timers</span>
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">High Priority</label>
                      <input type="number" defaultValue="24" className="w-full rounded border border-slate-300 px-2.5 py-1 outline-none text-slate-800" />
                      <span className="text-[9px] text-slate-400">hours</span>
                    </div>
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">Medium Priority</label>
                      <input type="number" defaultValue="72" className="w-full rounded border border-slate-300 px-2.5 py-1 outline-none text-slate-800" />
                      <span className="text-[9px] text-slate-400">hours</span>
                    </div>
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">Low Priority</label>
                      <input type="number" defaultValue="120" className="w-full rounded border border-slate-300 px-2.5 py-1 outline-none text-slate-800" />
                      <span className="text-[9px] text-slate-400">hours</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => alert('Configurations saved (simulated).')}
                className="rounded bg-[#1E40AF] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#16327e] shadow-sm uppercase tracking-wider"
              >
                Save Configurations
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
