import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import {
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Check,
  Play,
  Inbox,
  AlertCircle,
  Search,
  LayoutDashboard,
  FileText,
  Building2,
  Sparkles,
  Download,
  Users,
  Settings,
  LogOut,
  ChevronRight as ChevronRightIcon,
  Filter,
  X,
  Flame,
  ShieldCheck,
  Copy,
  Eye,
  History,
  AlertTriangle,
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');

  // Selected complaint for AI Analysis tab
  const [selectedAIComplaint, setSelectedAIComplaint] = useState(null);

  // Detail inspection modal states
  const [inspectingComplaint, setInspectingComplaint] = useState(null);
  const [inspectingHistory, setInspectingHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Status Action Modal State (Resolve, Reopen, Close)
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    complaintId: null,
    targetStatus: '',
    title: '',
    description: '',
    remark: '',
    required: false,
    confirmLabel: '',
    confirmColor: '',
  });

  // Escalation Modal State
  const [escalationModal, setEscalationModal] = useState({
    isOpen: false,
    complaintId: null,
    reason: '',
  });

  // Toast notification state
  const [toast, setToast] = useState({
    show: false,
    message: '',
    type: 'success',
  });

  // Search & filter states for Complaints Queue
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [priority, setPriority] = useState('All');
  const [status, setStatus] = useState('All');
  const [escalation, setEscalation] = useState('All');
  const [department, setDepartment] = useState('All');
  const [slaStatus, setSlaStatus] = useState('All');
  const [page, setPage] = useState(1);
  const limit = 6;

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      navigate('/admin/login');
    }
  }, [navigate]);

  // Keyboard shortcut handler (Escape key closes modals)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (actionModal.isOpen) {
          setActionModal((prev) => ({ ...prev, isOpen: false }));
        } else if (escalationModal.isOpen) {
          setEscalationModal((prev) => ({ ...prev, isOpen: false }));
        } else if (inspectingComplaint) {
          setInspectingComplaint(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actionModal.isOpen, escalationModal.isOpen, inspectingComplaint]);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 4000);
  };

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const statsRes = await apiService.getDashboardStats();
      if (statsRes && statsRes.status === 'success') {
        setStats(statsRes.stats);
      }

      const queueParams = {
        search: search.trim(),
        category,
        priority,
        status,
        escalation,
        department,
        sla_status: slaStatus,
        page,
        limit,
      };
      const queueRes = await apiService.getComplaints(queueParams);
      if (queueRes && queueRes.status === 'success') {
        setComplaints(queueRes.complaints || []);
        setTotal(queueRes.total || 0);
        if (queueRes.complaints && queueRes.complaints.length > 0 && !selectedAIComplaint) {
          setSelectedAIComplaint(queueRes.complaints[0]);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch administrative dashboard content.');
    } finally {
      setLoading(false);
    }
  }, [search, category, priority, status, escalation, department, slaStatus, page, limit, selectedAIComplaint]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchDashboardData();
  };

  const fetchComplaintHistory = async (complaintId) => {
    setLoadingHistory(true);
    try {
      const res = await apiService.getComplaintHistory(complaintId);
      if (res && res.status === 'success') {
        setInspectingHistory(res.history || []);
      } else {
        setInspectingHistory([]);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
      setInspectingHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleInspectComplaint = (complaint) => {
    setInspectingComplaint(complaint);
    fetchComplaintHistory(complaint.id);
  };

  const handleInspectRelatedGrievance = async (grievanceId) => {
    if (!grievanceId) return;
    setLoading(true);
    try {
      const res = await apiService.getComplaintByGrievanceId(grievanceId);
      if (res && res.status === 'success' && res.complaint) {
        setInspectingComplaint(res.complaint);
        fetchComplaintHistory(res.complaint.id);
        showToast(`Switched inspection to ${grievanceId}`, 'success');
      }
    } catch {
      showToast(`Could not load related complaint ${grievanceId}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDirectStatusUpdate = async (id, newStatus) => {
    setUpdatingId(id);
    setError('');
    try {
      const response = await apiService.updateComplaintStatus(id, newStatus, '');
      if (response && response.status === 'success') {
        showToast(`Complaint status updated to ${newStatus} successfully!`, 'success');
        await fetchDashboardData();
        if (inspectingComplaint && inspectingComplaint.id === id) {
          setInspectingComplaint((prev) => ({ ...prev, status: newStatus }));
          fetchComplaintHistory(id);
        }
      }
    } catch (err) {
      const msg = err.message || 'Failed to update grievance status.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const openStatusModal = (complaint, targetStatus) => {
    if (targetStatus === 'RESOLVED') {
      setActionModal({
        isOpen: true,
        complaintId: complaint.id,
        targetStatus: 'RESOLVED',
        title: 'Resolve Grievance Ticket',
        description: 'Please provide official resolution remarks detailing the corrective action taken by your department.',
        remark: '',
        required: true,
        confirmLabel: 'Confirm Resolution',
        confirmColor: 'bg-emerald-600 hover:bg-emerald-700',
      });
    } else if (targetStatus === 'REOPENED') {
      setActionModal({
        isOpen: true,
        complaintId: complaint.id,
        targetStatus: 'REOPENED',
        title: 'Reopen Grievance Ticket',
        description: 'Please state the official reason for reopening this ticket (e.g. incomplete field repair, citizen escalation).',
        remark: '',
        required: true,
        confirmLabel: 'Reopen Ticket',
        confirmColor: 'bg-amber-600 hover:bg-amber-700',
      });
    } else if (targetStatus === 'CLOSED') {
      setActionModal({
        isOpen: true,
        complaintId: complaint.id,
        targetStatus: 'CLOSED',
        title: 'Close Grievance Ticket',
        description: 'Are you sure you want to officially close this resolved grievance ticket? Closed tickets are finalized.',
        remark: '',
        required: false,
        confirmLabel: 'Close Ticket',
        confirmColor: 'bg-slate-700 hover:bg-slate-800',
      });
    }
  };

  const handleConfirmStatusAction = async () => {
    if (actionModal.required && !actionModal.remark.trim()) {
      setError('Remarks/Reason is required for this action.');
      return;
    }
    const { complaintId, targetStatus, remark } = actionModal;
    setActionModal((prev) => ({ ...prev, isOpen: false }));
    setUpdatingId(complaintId);
    setError('');
    try {
      const response = await apiService.updateComplaintStatus(complaintId, targetStatus, remark.trim());
      if (response && response.status === 'success') {
        showToast(`Complaint status updated to ${targetStatus} successfully!`, 'success');
        await fetchDashboardData();
        if (inspectingComplaint && inspectingComplaint.id === complaintId) {
          setInspectingComplaint((prev) => ({
            ...prev,
            status: targetStatus,
            resolution_remarks: remark.trim() || prev.resolution_remarks,
          }));
          fetchComplaintHistory(complaintId);
        }
      }
    } catch (err) {
      const msg = err.message || 'Failed to update grievance status.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const openEscalationModal = (complaint) => {
    setEscalationModal({
      isOpen: true,
      complaintId: complaint.id,
      reason: '',
    });
  };

  const handleConfirmEscalation = async () => {
    if (!escalationModal.reason.trim()) {
      setError('Escalation reason is required.');
      return;
    }
    const { complaintId, reason } = escalationModal;
    setEscalationModal((prev) => ({ ...prev, isOpen: false }));
    setUpdatingId(complaintId);
    setError('');
    try {
      const response = await apiService.escalateComplaint(complaintId, reason.trim());
      if (response && response.status === 'success') {
        showToast('Grievance ticket escalated successfully!', 'success');
        await fetchDashboardData();
        if (inspectingComplaint && inspectingComplaint.id === complaintId) {
          setInspectingComplaint((prev) => ({
            ...prev,
            escalation_status: 'ESCALATED',
            escalation_level: (prev.escalation_level || 0) + 1,
            escalation_reason: reason.trim(),
          }));
          fetchComplaintHistory(complaintId);
        }
      }
    } catch (err) {
      const msg = err.message || 'Failed to escalate grievance.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUpdateDepartment = async (id, newDept) => {
    setUpdatingId(id);
    setError('');
    try {
      const response = await apiService.updateComplaintDepartment(id, newDept);
      if (response && response.status === 'success') {
        showToast(`Re-assigned to ${newDept} successfully!`, 'success');
        await fetchDashboardData();
        if (inspectingComplaint && inspectingComplaint.id === id) {
          setInspectingComplaint((prev) => ({ ...prev, department: newDept }));
        }
      }
    } catch (err) {
      const msg = err.message || 'Failed to re-assign department.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    navigate('/');
  };

  const handleResetFilters = () => {
    setSearch('');
    setCategory('All');
    setPriority('All');
    setStatus('All');
    setEscalation('All');
    setDepartment('All');
    setSlaStatus('All');
    setPage(1);
  };

  const handleCopyId = (id) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  const CATEGORY_COLORS = {
    Water: '#1E40AF',
    Electricity: '#EA580C',
    Road: '#16A34A',
    Garbage: '#64748B',
    Others: '#94A3B8',
  };

  const DEPARTMENT_OPTIONS = [
    'Water Supply Department',
    'Electricity Department',
    'Public Works Department',
    'Sanitation/Waste Management Department',
    'General/Public Grievance Department',
  ];

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
          className: 'bg-rose-100 text-rose-900 border-rose-400 font-extrabold shadow-2xs ring-1 ring-rose-200',
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
      return { text: 'Deadline Exceeded (Breached)', isBreached: true, isNear: false };
    }
    if (!slaDeadline) {
      return { text: 'Standard Window (24h-120h)', isBreached: false, isNear: false };
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

  const getSimilarityInfo = (scoreVal) => {
    let score = Number(scoreVal) || 0;
    if (score > 0 && score <= 1.0) {
      score = Math.round(score * 100);
    } else {
      score = Math.round(score);
    }

    if (score >= 75) {
      return {
        percentage: score,
        label: 'Highly Similar',
        badgeClass: 'bg-rose-100 text-rose-900 border-rose-300 font-extrabold',
        barColor: 'bg-rose-600',
      };
    }
    if (score >= 50) {
      return {
        percentage: score,
        label: 'Possibly Related',
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
        barColor: 'bg-amber-500',
      };
    }
    return {
      percentage: score,
      label: 'No Likely Match',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 font-medium',
      barColor: 'bg-slate-400',
    };
  };

  const parseRelatedGrievances = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return [];
      }
    }
    return [];
  };

  const getCategoryBadgeClass = (cat) => {
    const mapping = {
      Water: 'bg-blue-50 text-[#1E40AF] border-blue-300',
      Electricity: 'bg-amber-50 text-amber-800 border-amber-300',
      Road: 'bg-emerald-50 text-emerald-800 border-emerald-300',
      Garbage: 'bg-slate-100 text-slate-700 border-slate-300',
      Others: 'bg-slate-100 text-slate-600 border-slate-300',
    };
    return mapping[cat] || 'bg-slate-100 text-slate-600 border-slate-300';
  };

  // Safe analytical data formatters
  const safeNumber = (val, fallback = 0) => {
    const num = Number(val);
    return Number.isFinite(num) ? num : fallback;
  };

  const formatPercent = (val, fallback = '0%') => {
    if (val === null || val === undefined) return fallback;
    const num = Number(val);
    if (!Number.isFinite(num)) return fallback;
    const bounded = Math.max(0, Math.min(100, Math.round(num)));
    return `${bounded}%`;
  };

  const formatHours = (val, fallback = '0h') => {
    if (val === null || val === undefined) return fallback;
    const num = Number(val);
    if (!Number.isFinite(num)) return fallback;
    const bounded = Math.max(0, num);
    const formatted = Number.isInteger(bounded) ? bounded.toString() : bounded.toFixed(1);
    return `${formatted}h`;
  };

  const formatHoursDetailed = (val, fallback = '0 hours') => {
    if (val === null || val === undefined) return fallback;
    const num = Number(val);
    if (!Number.isFinite(num)) return fallback;
    const bounded = Math.max(0, num);
    const formatted = Number.isInteger(bounded) ? bounded.toString() : bounded.toFixed(1);
    return `${formatted} hours`;
  };

  const getPieChartData = () => {
    if (!stats || !stats.category_distribution || typeof stats.category_distribution !== 'object') return [];
    return Object.entries(stats.category_distribution)
      .map(([name, value]) => ({
        name: String(name || 'Others'),
        value: safeNumber(value, 0),
      }))
      .filter((item) => item.value > 0);
  };

  const totalPages = Math.ceil(total / limit) || 1;

  const getResolutionRate = () => {
    if (!stats || !stats.total_complaints || safeNumber(stats.total_complaints) === 0) return 0;
    const resolved = safeNumber(stats.resolved_complaints);
    const totalComplaints = safeNumber(stats.total_complaints);
    const rate = (resolved / totalComplaints) * 100;
    if (!Number.isFinite(rate)) return 0;
    return Math.max(0, Math.min(100, Math.round(rate)));
  };

  const getSlaChartData = () => {
    if (!stats || !stats.sla_analytics || typeof stats.sla_analytics !== 'object') return [];
    const sla = stats.sla_analytics;
    return [
      { name: 'Within SLA', value: safeNumber(sla.within_sla), color: '#16A34A' },
      { name: 'Near Deadline', value: safeNumber(sla.near_deadline), color: '#EA580C' },
      { name: 'Breached (Active)', value: safeNumber(sla.currently_breached), color: '#DC2626' },
      { name: 'Resolved (In SLA)', value: safeNumber(sla.resolved_within_sla), color: '#059669' },
      { name: 'Resolved (After SLA)', value: safeNumber(sla.resolved_after_sla), color: '#B91C1C' },
    ].filter((item) => item.value > 0);
  };

  const getDeptResTimeChartData = () => {
    if (!stats || !stats.resolution_analytics?.avg_resolution_time_by_department || typeof stats.resolution_analytics.avg_resolution_time_by_department !== 'object') return [];
    return Object.entries(stats.resolution_analytics.avg_resolution_time_by_department).map(
      ([name, hours]) => ({
        name: String(name || '').replace(' Department', '').replace(' Board', ''),
        hours: safeNumber(hours, 0),
      })
    );
  };

  const parseComplaintText = (fullText) => {
    if (!fullText) return { preview: '', meta: '' };
    const descMarker = 'DESCRIPTION:\n';
    if (fullText.includes(descMarker)) {
      const idx = fullText.indexOf(descMarker);
      return {
        preview: fullText.substring(idx + descMarker.length).trim(),
        meta: fullText.substring(0, idx).trim(),
      };
    }
    return {
      preview: fullText.trim(),
      meta: '',
    };
  };

  const getFrustrationPercentage = (score) => {
    if (score === undefined || score === null) return 0;
    if (score >= 0) {
      return Math.round((1 - score) * 30);
    }
    return Math.round(30 + Math.abs(score) * 70);
  };

  const activeFiltersCount =
    (search ? 1 : 0) +
    (category !== 'All' ? 1 : 0) +
    (priority !== 'All' ? 1 : 0) +
    (status !== 'All' ? 1 : 0) +
    (escalation !== 'All' ? 1 : 0) +
    (department !== 'All' ? 1 : 0) +
    (slaStatus !== 'All' ? 1 : 0);

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-[85vh] bg-slate-100 border-b border-slate-200">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-[#0f172a] text-slate-300 border-r border-slate-800 shrink-0">
        <div className="p-3 sm:p-4 border-b border-slate-800 bg-[#020617] flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={18} className="text-blue-400" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-white">
              Officer Console
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="md:hidden flex items-center gap-1 text-[11px] font-bold text-rose-400 hover:text-rose-300 p-1"
            title="Exit System"
          >
            <LogOut size={14} /> Exit
          </button>
        </div>
        <nav className="p-2 md:p-3 flex md:flex-col overflow-x-auto gap-1 text-slate-400">
          {[
            { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
            { id: 'complaints', name: 'Complaints Queue', icon: FileText },
            { id: 'departments', name: 'Departments', icon: Building2 },
            { id: 'ai_analysis', name: 'AI NLP Classifier', icon: Sparkles },
            { id: 'reports', name: 'Governance Reports', icon: Download },
            { id: 'users', name: 'Officer Accounts', icon: Users },
            { id: 'settings', name: 'Console Settings', icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === item.id
                    ? 'bg-[#1E40AF] text-white shadow-xs'
                    : 'hover:bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={15} /> {item.name}
              </button>
            );
          })}

          <div className="hidden md:block border-t border-slate-800/80 pt-3 mt-4">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 transition cursor-pointer"
            >
              <LogOut size={15} /> Exit System
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content Dashboard Area */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 space-y-6 overflow-y-auto">
        {/* Top Header Toolbar */}
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-[#1E40AF] border border-blue-200 mb-1">
              <Building2 size={12} /> Official Municipal Grievance Administration Console
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {activeTab === 'dashboard' && 'Grievance Administration Dashboard'}
              {activeTab === 'complaints' && 'Redressal Backlog & Resolution Queue'}
              {activeTab === 'departments' && 'Operational Municipal Departments'}
              {activeTab === 'ai_analysis' && 'AI Natural Language Classifier Inspection'}
              {activeTab === 'reports' && 'Governance & SLA Performance Reports'}
              {activeTab === 'users' && 'Officer Accounts Management'}
              {activeTab === 'settings' && 'Console Administration Settings'}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Monitor SLA compliance, review auto-routed categories, assign departments, and process citizen tickets.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchDashboardData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Sync Database</span>
          </button>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-300 bg-rose-50 p-4 text-xs font-medium text-rose-800 shadow-sm">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={fetchDashboardData}
              className="rounded-md border border-rose-300 bg-white px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50"
            >
              Retry
            </button>
          </div>
        )}

        {/* TAB 1: DASHBOARD OVERVIEW */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Top KPI Cards Grid */}
            {stats ? (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                {/* Total */}
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow">
                  <div className="rounded-lg bg-blue-50 p-2.5 text-[#1E40AF] border border-blue-200">
                    <Inbox size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      Total Complaints
                    </span>
                    <strong className="text-xl font-extrabold text-slate-900">
                      {safeNumber(stats.total_complaints)}
                    </strong>
                  </div>
                </div>

                {/* Resolution Rate */}
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow">
                  <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-600 border border-emerald-200">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      Resolution Rate
                    </span>
                    <strong className="text-xl font-extrabold text-emerald-700">
                      {getResolutionRate()}%
                    </strong>
                  </div>
                </div>

                {/* SLA Compliance */}
                <div
                  onClick={() => {
                    setSlaStatus('WITHIN_SLA');
                    setPage(1);
                    setActiveTab('complaints');
                  }}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow cursor-pointer hover:border-emerald-400"
                  title="Filter complaints within SLA"
                >
                  <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-700 border border-emerald-200">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      SLA Compliance
                    </span>
                    <strong className="text-xl font-extrabold text-emerald-700">
                      {formatPercent(stats.sla_analytics?.sla_compliance_rate, '100%')}
                    </strong>
                  </div>
                </div>

                {/* SLA Breach Rate */}
                <div
                  onClick={() => {
                    setSlaStatus('SLA_BREACHED');
                    setPage(1);
                    setActiveTab('complaints');
                  }}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow cursor-pointer hover:border-rose-400"
                  title="Filter breached SLA complaints"
                >
                  <div className="rounded-lg bg-rose-50 p-2.5 text-rose-600 border border-rose-200">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      SLA Breach Rate
                    </span>
                    <strong className="text-xl font-extrabold text-rose-600">
                      {formatPercent(stats.sla_analytics?.sla_breach_rate, '0%')}
                    </strong>
                  </div>
                </div>

                {/* Escalations */}
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow">
                  <div className="rounded-lg bg-rose-50 p-2.5 text-rose-700 border border-rose-200">
                    <Flame size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      Escalated
                    </span>
                    <strong className="text-xl font-extrabold text-rose-700">
                      {safeNumber(stats.escalation_analytics?.total_escalated)}
                    </strong>
                  </div>
                </div>

                {/* Reopened */}
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow">
                  <div className="rounded-lg bg-amber-50 p-2.5 text-amber-700 border border-amber-200">
                    <RefreshCw size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      Reopened
                    </span>
                    <strong className="text-xl font-extrabold text-amber-700">
                      {safeNumber(stats.reopen_analytics?.total_reopened)}
                    </strong>
                  </div>
                </div>

                {/* Avg Resolution Duration */}
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow">
                  <div className="rounded-lg bg-slate-100 p-2.5 text-slate-700 border border-slate-200">
                    <Clock size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      Avg Res Time
                    </span>
                    <strong className="text-xl font-extrabold text-slate-800">
                      {formatHours(stats.resolution_analytics?.avg_resolution_time_hours)}
                    </strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-white" />
                ))}
              </div>
            )}

            {/* Analytics Charts Row */}
            {stats && (
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Department Load Pie Chart */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm h-[330px] flex flex-col">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 pb-3 border-b border-slate-100">
                    Department Intake Load
                  </h3>
                  <div className="flex-1 min-h-0 pt-2">
                    {getPieChartData().length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={getPieChartData()}
                            cx="50%"
                            cy="45%"
                            innerRadius={50}
                            outerRadius={75}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {getPieChartData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name] || '#94a3b8'} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px' }} />
                          <Legend verticalAlign="bottom" align="center" iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-400">
                        No grievance data to display.
                      </div>
                    )}
                  </div>
                </div>

                {/* SLA Status Distribution */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm h-[330px] flex flex-col">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 pb-3 border-b border-slate-100">
                    SLA Status Distribution
                  </h3>
                  <div className="flex-1 min-h-0 pt-2">
                    {getSlaChartData().length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={getSlaChartData()}
                            cx="50%"
                            cy="45%"
                            innerRadius={50}
                            outerRadius={75}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {getSlaChartData().map((entry, index) => (
                              <Cell key={`sla-cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px' }} />
                          <Legend verticalAlign="bottom" align="center" iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-400">
                        No SLA records to display.
                      </div>
                    )}
                  </div>
                </div>

                {/* Incoming Trend Line Chart */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm h-[330px] flex flex-col">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 pb-3 border-b border-slate-100">
                    Grievance Submission Trend
                  </h3>
                  <div className="flex-1 min-h-0 pt-2">
                    {stats.trend_data && stats.trend_data.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={stats.trend_data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" stroke="#64748b" fontSize={9} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px' }} />
                          <Line type="monotone" dataKey="complaints" stroke="#1E40AF" strokeWidth={2.5} dot={{ r: 3, fill: '#1E40AF' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-400">
                        No trend data available.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Tables: Recent Complaints & Department Overview */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Recent Complaints */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                    Recent Grievances
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('complaints')}
                    className="text-[11px] font-bold text-[#1E40AF] hover:underline flex items-center gap-1"
                  >
                    <span>View all queue</span>
                    <ChevronRightIcon size={12} />
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {complaints.length > 0 ? (
                    complaints.slice(0, 4).map((item) => (
                      <div key={item.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                        <div className="min-w-0">
                          <span className="font-mono font-bold text-slate-900 select-all">
                            {item.grievance_id || `#${item.id.substring(0, 8)}`}
                          </span>
                          <p className="font-medium text-slate-700 truncate">{parseComplaintText(item.complaint_text).preview}</p>
                        </div>
                        <span className={`rounded-md border px-2.5 py-0.5 text-[10px] shrink-0 ${getStatusBadgeClass(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="block text-center text-xs text-slate-400 py-6">No grievances logged.</span>
                  )}
                </div>
              </div>

              {/* Department Overview Table */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2.5">
                  Department Backlog Breakdown
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="text-slate-500 font-extrabold uppercase tracking-wider border-b border-slate-200">
                        <th className="pb-2">Department</th>
                        <th className="pb-2 text-center">Active Load</th>
                        <th className="pb-2 text-right">Indicator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stats && stats.category_distribution ? (
                        Object.entries(stats.category_distribution).map(([dept, count]) => (
                          <tr key={dept} className="hover:bg-slate-50">
                            <td className="py-2.5 font-bold text-slate-800">{dept}</td>
                            <td className="py-2.5 text-center font-extrabold text-slate-900">{count}</td>
                            <td className="py-2.5 text-right">
                              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[dept] || '#cbd5e1' }} />
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="text-center py-6 text-slate-400">Loading department stats...</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: COMPLAINTS QUEUE & ADVANCED FILTERING */}
        {activeTab === 'complaints' && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
            {/* Header & Search */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900">
                  Grievance Redressal Resolution Queue
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Search, filter, assign departments, and update ticket lifecycle status.
                </p>
              </div>

              <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search GRV-ID or description..."
                    className="w-full sm:w-64 rounded-lg border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-xs outline-none transition focus:border-[#1E40AF] focus:bg-white"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-lg bg-[#1E40AF] px-4 py-2 text-xs font-bold text-white hover:bg-[#16327e] shadow-xs cursor-pointer"
                >
                  Search
                </button>
              </form>
            </div>

            {/* Comprehensive Filter Controls */}
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
                  <Filter size={14} className="text-[#1E40AF]" />
                  <span>Filter Criteria ({activeFiltersCount} active)</span>
                </div>
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
                  >
                    <X size={13} /> Clear All Filters
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Department</label>
                  <select
                    value={department}
                    onChange={(e) => { setDepartment(e.target.value); setPage(1); }}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-[#1E40AF]"
                  >
                    <option value="All">All Departments</option>
                    <option value="Water Supply">Water Supply</option>
                    <option value="Electricity">Electricity</option>
                    <option value="Public Works (Roads)">Public Works (Roads)</option>
                    <option value="Solid Waste Management">Solid Waste Management</option>
                    <option value="Civic Support Cell">Civic Support Cell</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => { setCategory(e.target.value); setPage(1); }}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-[#1E40AF]"
                  >
                    <option value="All">All Categories</option>
                    <option value="Water">Water</option>
                    <option value="Electricity">Electricity</option>
                    <option value="Road">Road</option>
                    <option value="Garbage">Garbage</option>
                    <option value="Others">Others</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => { setPriority(e.target.value); setPage(1); }}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-[#1E40AF]"
                  >
                    <option value="All">All Priorities</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-[#1E40AF]"
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

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">SLA Status</label>
                  <select
                    value={slaStatus}
                    onChange={(e) => { setSlaStatus(e.target.value); setPage(1); }}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-[#1E40AF]"
                  >
                    <option value="All">All SLA Statuses</option>
                    <option value="WITHIN_SLA">Within SLA</option>
                    <option value="NEAR_DEADLINE">Near Deadline</option>
                    <option value="SLA_BREACHED">SLA Breached</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Escalation</label>
                  <select
                    value={escalation}
                    onChange={(e) => { setEscalation(e.target.value); setPage(1); }}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-[#1E40AF]"
                  >
                    <option value="All">All Escalations</option>
                    <option value="NOT_ESCALATED">Normal</option>
                    <option value="ESCALATED">Escalated</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Complaints Queue Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 font-extrabold uppercase tracking-wider text-slate-500">
                      <th className="p-3.5 pl-4 w-32">Grievance ID</th>
                      <th className="p-3.5 w-28">Logged Date</th>
                      <th className="p-3.5">Description</th>
                      <th className="p-3.5 w-36">Department</th>
                      <th className="p-3.5 w-24">Priority</th>
                      <th className="p-3.5 w-28">SLA Status</th>
                      <th className="p-3.5 w-24">Escalation</th>
                      <th className="p-3.5 w-28">Status</th>
                      <th className="p-3.5 w-40 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loading ? (
                      [...Array(4)].map((_, i) => (
                        <tr key={i} className="bg-white">
                          <td className="p-3.5 pl-4"><div className="h-3.5 w-24 rounded bg-slate-200 animate-pulse" /></td>
                          <td className="p-3.5"><div className="h-3.5 w-16 rounded bg-slate-200 animate-pulse" /></td>
                          <td className="p-3.5"><div className="h-3.5 w-3/4 rounded bg-slate-200 animate-pulse" /></td>
                          <td className="p-3.5"><div className="h-3.5 w-20 rounded bg-slate-200 animate-pulse" /></td>
                          <td className="p-3.5"><div className="h-3.5 w-14 rounded bg-slate-200 animate-pulse" /></td>
                          <td className="p-3.5"><div className="h-3.5 w-16 rounded bg-slate-200 animate-pulse" /></td>
                          <td className="p-3.5"><div className="h-3.5 w-12 rounded bg-slate-200 animate-pulse" /></td>
                          <td className="p-3.5"><div className="h-3.5 w-16 rounded bg-slate-200 animate-pulse" /></td>
                          <td className="p-3.5 text-center"><div className="h-6 w-24 rounded bg-slate-200 animate-pulse mx-auto" /></td>
                        </tr>
                      ))
                    ) : complaints.length > 0 ? (
                      complaints.map((item) => {
                        const targetGrievanceId = item.grievance_id || `#${item.id.substring(0, 8)}`;
                        const isCopied = copiedId === targetGrievanceId;

                        return (
                          <tr key={item.id} className="hover:bg-blue-50/20 bg-white transition">
                            <td className="p-3.5 pl-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="select-all">{targetGrievanceId}</span>
                                {item.possible_duplicate && (
                                  <span className="rounded bg-amber-100 text-amber-900 border border-amber-300 px-1 py-0.5 text-[9px] font-extrabold" title="Potential duplicate detected by AI">
                                    DUP
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleCopyId(targetGrievanceId)}
                                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                                  title="Copy ID"
                                >
                                  {isCopied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                                </button>
                              </div>
                            </td>
                            <td className="p-3.5 text-slate-600 whitespace-nowrap">
                              {new Date(item.timestamp).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                            </td>
                            <td className="p-3.5 leading-relaxed text-slate-800 max-w-xs truncate">
                              {parseComplaintText(item.complaint_text).preview}
                            </td>
                            <td className="p-3.5">
                              <select
                                value={item.department || ''}
                                onChange={(event) => handleUpdateDepartment(item.id, event.target.value)}
                                disabled={updatingId === item.id}
                                className="max-w-[170px] rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-[#1E40AF] outline-none disabled:opacity-50 cursor-pointer"
                                aria-label={`Department for complaint ${item.id}`}
                              >
                                {DEPARTMENT_OPTIONS.map((deptOpt) => (
                                  <option key={deptOpt} value={deptOpt}>
                                    {deptOpt}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-3.5">
                              <span className={`rounded-md border px-2 py-0.5 text-[10px] ${getPriorityBadgeClass(item.priority)}`}>
                                {item.priority}
                              </span>
                            </td>
                            <td className="p-3.5 whitespace-nowrap">
                              {(() => {
                                const slaDetails = getSlaBadgeDetails(item.sla_status);
                                const SlaIcon = slaDetails.Icon;
                                return (
                                  <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] ${slaDetails.className}`}>
                                    <SlaIcon size={10} />
                                    <span>{slaDetails.label}</span>
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="p-3.5 whitespace-nowrap">
                              {item.sla_status === 'SLA_BREACHED' && item.escalation_status === 'ESCALATED' ? (
                                <span className="inline-flex items-center gap-1 rounded-md border border-rose-400 bg-rose-900 text-white font-extrabold px-2 py-0.5 text-[9px] shadow-2xs">
                                  <Flame size={10} className="text-amber-300 animate-pulse" />
                                  <span>BREACHED · L{item.escalation_level || 1}</span>
                                </span>
                              ) : item.escalation_status === 'ESCALATED' ? (
                                <span className="inline-flex items-center gap-1 rounded-md border border-rose-400 bg-rose-100 text-rose-900 font-extrabold px-2 py-0.5 text-[9px] shadow-2xs">
                                  <Flame size={10} className="text-rose-600" />
                                  <span>ESCALATED L{item.escalation_level || 1}</span>
                                </span>
                              ) : (
                                <span className="rounded-md border border-slate-200 bg-slate-100 text-slate-600 px-2 py-0.5 text-[9px] font-medium">
                                  Normal
                                </span>
                              )}
                            </td>
                            <td className="p-3.5">
                              <span className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-[10px] ${getStatusBadgeClass(item.status)}`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="p-3.5 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleInspectComplaint(item)}
                                  className="flex items-center gap-1 rounded border border-slate-300 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-100 shadow-2xs cursor-pointer"
                                  title="View full complaint details & history"
                                >
                                  <Eye size={11} className="text-[#1E40AF]" /> Inspect
                                </button>

                                {item.status === 'SUBMITTED' && (
                                  <button
                                    type="button"
                                    onClick={() => handleDirectStatusUpdate(item.id, 'ASSIGNED')}
                                    disabled={updatingId === item.id}
                                    className="flex items-center gap-1 rounded bg-[#1E40AF] px-2.5 py-1 text-[10px] font-bold text-white hover:bg-[#16327e] disabled:opacity-40 shadow-xs cursor-pointer"
                                  >
                                    <Play size={10} /> Assign
                                  </button>
                                )}
                                {item.status === 'ASSIGNED' && (
                                  <button
                                    type="button"
                                    onClick={() => handleDirectStatusUpdate(item.id, 'IN_PROGRESS')}
                                    disabled={updatingId === item.id}
                                    className="flex items-center gap-1 rounded bg-[#1E40AF] px-2.5 py-1 text-[10px] font-bold text-white hover:bg-[#16327e] disabled:opacity-40 shadow-xs cursor-pointer"
                                  >
                                    <Play size={10} /> Start Work
                                  </button>
                                )}
                                {item.status === 'IN_PROGRESS' && (
                                  <button
                                    type="button"
                                    onClick={() => openStatusModal(item, 'RESOLVED')}
                                    disabled={updatingId === item.id}
                                    className="flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-40 shadow-xs cursor-pointer"
                                  >
                                    <Check size={10} /> Resolve
                                  </button>
                                )}
                                {item.status === 'RESOLVED' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => openStatusModal(item, 'CLOSED')}
                                      disabled={updatingId === item.id}
                                      className="flex items-center gap-1 rounded bg-slate-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                                    >
                                      Close
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openStatusModal(item, 'REOPENED')}
                                      disabled={updatingId === item.id}
                                      className="flex items-center gap-1 rounded bg-amber-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-amber-700 disabled:opacity-40 cursor-pointer"
                                    >
                                      Reopen
                                    </button>
                                  </>
                                )}
                                {item.status === 'CLOSED' && (
                                  <span className="flex items-center gap-1 text-[10px] font-bold italic text-slate-400">
                                    <CheckCircle2 size={11} className="text-slate-400" /> Closed
                                  </span>
                                )}
                                {item.status === 'REOPENED' && (
                                  <button
                                    type="button"
                                    onClick={() => handleDirectStatusUpdate(item.id, 'IN_PROGRESS')}
                                    disabled={updatingId === item.id}
                                    className="flex items-center gap-1 rounded bg-[#1E40AF] px-2.5 py-1 text-[10px] font-bold text-white hover:bg-[#16327e] disabled:opacity-40 shadow-xs cursor-pointer"
                                  >
                                    Resume
                                  </button>
                                )}
                                {item.escalation_status !== 'ESCALATED' && item.status !== 'RESOLVED' && item.status !== 'CLOSED' && (
                                  <button
                                    type="button"
                                    onClick={() => openEscalationModal(item)}
                                    disabled={updatingId === item.id}
                                    className="flex items-center gap-1 rounded bg-rose-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-rose-700 disabled:opacity-40 cursor-pointer"
                                  >
                                    Escalate
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="p-12 text-center text-slate-500">
                          <div className="flex flex-col items-center gap-2">
                            <Inbox size={32} className="text-slate-300" />
                            <span className="font-bold text-slate-800">No grievances match your current filters.</span>
                            {activeFiltersCount > 0 && (
                              <button
                                type="button"
                                onClick={handleResetFilters}
                                className="mt-1 text-xs font-bold text-[#1E40AF] underline cursor-pointer"
                              >
                                Reset filters
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-sm md:flex-row md:items-center md:justify-between">
                <div>
                  Showing <strong>{(page - 1) * limit + 1}</strong> to <strong>{Math.min(page * limit, total)}</strong> of{' '}
                  <strong>{total}</strong> entries
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:border-[#1E40AF] disabled:opacity-40 cursor-pointer"
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
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:border-[#1E40AF] disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DEPARTMENTS VIEW */}
        {activeTab === 'departments' && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: 'Water Department', code: 'Water', manager: 'Ir. Rajesh Kumar', staff: '8 Active Engineers' },
              { name: 'Electricity Board', code: 'Electricity', manager: 'Ir. Sunita Rao', staff: '6 Technicians' },
              { name: 'Roads & Infrastructure', code: 'Road', manager: 'Ir. Harish Patel', staff: '12 Inspectors' },
              { name: 'Garbage & Sanitation', code: 'Garbage', manager: 'Mr. Devendra Sah', staff: '14 Field Crew' },
              { name: 'General Municipal Administration', code: 'Others', manager: 'Ms. Meena Gupta', staff: '4 Admin Clerks' },
            ].map((dept) => {
              const activeCount = stats && stats.category_distribution ? stats.category_distribution[dept.code] || 0 : 0;
              return (
                <div key={dept.code} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1E40AF]">{dept.name}</h3>
                    <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">
                      {dept.code}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Manager</span>
                      <span className="font-bold text-slate-800">{dept.manager}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Staff</span>
                      <span className="font-medium text-slate-700">{dept.staff}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Backlog</span>
                      <span className={`font-extrabold ${activeCount > 5 ? 'text-rose-600' : 'text-slate-800'}`}>
                        {activeCount} grievances pending
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setCategory(dept.code);
                        setActiveTab('complaints');
                      }}
                      className="text-[11px] font-bold text-[#1E40AF] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>View complaints queue</span>
                      <ChevronRightIcon size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 4: AI NLP CLASSIFIER DETAILS */}
        {activeTab === 'ai_analysis' && (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
            {/* Left Column: Complaints List */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2.5">
                Grievance Tickets
              </h3>
              <div className="divide-y divide-slate-100 max-h-[450px] overflow-y-auto pr-1">
                {complaints.length > 0 ? (
                  complaints.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedAIComplaint(item)}
                      className={`w-full py-3 px-3 text-left rounded-lg transition flex items-center justify-between gap-3 text-xs cursor-pointer ${
                        selectedAIComplaint && selectedAIComplaint.id === item.id
                          ? 'bg-blue-50/80 border-l-4 border-[#1E40AF] shadow-2xs'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="font-mono font-bold text-slate-900">{item.grievance_id || `#${item.id.substring(0, 8)}`}</span>
                        <p className="font-medium text-slate-700 truncate">{parseComplaintText(item.complaint_text).preview}</p>
                      </div>
                      <span className={`text-[9px] font-bold rounded border px-2 py-0.5 shrink-0 ${getPriorityBadgeClass(item.priority)}`}>
                        {item.priority}
                      </span>
                    </button>
                  ))
                ) : (
                  <span className="block text-center text-xs text-slate-400 py-8">No grievance tickets available.</span>
                )}
              </div>
            </div>

            {/* Right Column: AI Parameters */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <Sparkles size={15} className="text-[#1E40AF]" /> NLP Model Prediction Parameters
              </h3>

              {selectedAIComplaint ? (
                <div className="mt-4 space-y-5 text-xs">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Reference ID</span>
                    <span className="font-mono text-sm font-extrabold text-[#1E40AF]">{selectedAIComplaint.grievance_id || selectedAIComplaint.id}</span>
                  </div>

                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Original Grievance Text</span>
                    <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 font-medium whitespace-pre-line leading-relaxed max-h-[160px] overflow-y-auto">
                      {selectedAIComplaint.complaint_text}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Predicted Category</span>
                      <span className={`mt-1.5 inline-flex rounded-md border px-2.5 py-0.5 text-xs font-bold ${getCategoryBadgeClass(selectedAIComplaint.category)}`}>
                        {selectedAIComplaint.category}
                      </span>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Detected Priority</span>
                      <span className={`mt-1.5 inline-flex rounded-md border px-2.5 py-0.5 text-xs ${getPriorityBadgeClass(selectedAIComplaint.priority)}`}>
                        {selectedAIComplaint.priority} Priority
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <span>Sentiment Score Analysis</span>
                      <span className="text-[#1E40AF] font-mono">{getFrustrationPercentage(selectedAIComplaint.sentiment_score)}% Urgency</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-[#1E40AF]"
                        style={{ width: `${getFrustrationPercentage(selectedAIComplaint.sentiment_score)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      VADER sentiment compound index: <strong className="text-slate-900 font-mono">{typeof selectedAIComplaint.sentiment_score === 'number' ? selectedAIComplaint.sentiment_score.toFixed(4) : selectedAIComplaint.sentiment_score}</strong> (Scores below -0.15 indicate high frustration).
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-8 text-center text-xs text-slate-400 py-12">
                  <Inbox size={32} className="mx-auto mb-2 text-slate-300" />
                  <span>Select a grievance ticket from the left queue to inspect AI classification parameters.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: GOVERNANCE & SLA PERFORMANCE REPORTS */}
        {activeTab === 'reports' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900">
                  Governance & SLA Performance Reports
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Comprehensive audit analytics across SLA compliance, resolution times, escalations, and department performance.
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E40AF] px-4 py-2 text-xs font-bold text-white shadow hover:bg-[#16327e] transition cursor-pointer"
              >
                <Download size={14} /> Print Report
              </button>
            </div>

            {/* Summary KPI Grid */}
            {loading || !stats ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                  <span className="block font-extrabold text-slate-500 text-[10px] uppercase tracking-wider">
                    SLA Compliance Rate
                  </span>
                  <strong className="text-2xl text-emerald-700 block mt-1">
                    {formatPercent(stats.sla_analytics?.sla_compliance_rate, '100%')}
                  </strong>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Breach Rate: {formatPercent(stats.sla_analytics?.sla_breach_rate, '0%')} (
                    {safeNumber(stats.sla_analytics?.currently_breached) + safeNumber(stats.sla_analytics?.resolved_after_sla)} breaches)
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                  <span className="block font-extrabold text-slate-500 text-[10px] uppercase tracking-wider">
                    Avg Resolution Time
                  </span>
                  <strong className="text-2xl text-slate-900 block mt-1">
                    {formatHoursDetailed(stats.resolution_analytics?.avg_resolution_time_hours)}
                  </strong>
                  <p className="text-[10px] text-slate-500 mt-1">Average duration from intake to resolution.</p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                  <span className="block font-extrabold text-slate-500 text-[10px] uppercase tracking-wider">
                    Total Escalations
                  </span>
                  <strong className="text-2xl text-rose-600 block mt-1">
                    {safeNumber(stats.escalation_analytics?.total_escalated)}
                  </strong>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Rate: {formatPercent(stats.escalation_analytics?.escalation_rate, '0%')} of total complaints
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                  <span className="block font-extrabold text-slate-500 text-[10px] uppercase tracking-wider">
                    Reopen Rate
                  </span>
                  <strong className="text-2xl text-amber-700 block mt-1">
                    {formatPercent(stats.reopen_analytics?.reopen_rate, '0%')}
                  </strong>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Total Reopened: {safeNumber(stats.reopen_analytics?.total_reopened)}
                  </p>
                </div>
              </div>
            )}

            {/* Department Performance Matrix Table */}
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                Department Performance Matrix
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 font-extrabold uppercase tracking-wider text-slate-500">
                      <th className="p-3 pl-4">Department</th>
                      <th className="p-3 text-center">Total</th>
                      <th className="p-3 text-center">Active</th>
                      <th className="p-3 text-center">Resolved</th>
                      <th className="p-3 text-center">Res Rate (%)</th>
                      <th className="p-3 text-center">Avg Duration (hrs)</th>
                      <th className="p-3 text-center">SLA Breaches</th>
                      <th className="p-3 text-center">Breach Rate (%)</th>
                      <th className="p-3 text-center">Escalations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading || !stats ? (
                      <tr>
                        <td colSpan={9} className="text-center py-6 text-slate-400 font-bold">
                          Loading department performance data...
                        </td>
                      </tr>
                    ) : stats.department_performance && stats.department_performance.length > 0 ? (
                      stats.department_performance.map((dp) => (
                        <tr key={dp.department} className="hover:bg-slate-50">
                          <td className="p-3 pl-4 font-bold text-slate-900">{dp.department || 'Unknown Department'}</td>
                          <td className="p-3 text-center font-bold text-slate-700">{safeNumber(dp.total_complaints)}</td>
                          <td className="p-3 text-center font-bold text-amber-700">{safeNumber(dp.active_complaints)}</td>
                          <td className="p-3 text-center font-bold text-emerald-700">{safeNumber(dp.resolved_complaints)}</td>
                          <td className="p-3 text-center font-extrabold text-slate-900">{formatPercent(dp.resolution_rate, '0%')}</td>
                          <td className="p-3 text-center font-mono text-slate-700">{formatHours(dp.avg_resolution_time)}</td>
                          <td className="p-3 text-center font-bold text-rose-600">{safeNumber(dp.sla_breach_count)}</td>
                          <td className="p-3 text-center font-bold text-rose-600">{formatPercent(dp.sla_breach_rate, '0%')}</td>
                          <td className="p-3 text-center font-bold text-purple-700">{safeNumber(dp.escalation_count)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="text-center py-6 text-slate-400 font-bold">
                          No department performance records available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Resolution Time & SLA Charts */}
            <div className="grid gap-6 md:grid-cols-2 pt-2">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm h-[320px] flex flex-col">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 pb-3 border-b border-slate-100">
                  Avg Resolution Time by Department (Hours)
                </h4>
                <div className="flex-1 min-h-0 pt-2">
                  {stats && getDeptResTimeChartData().length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getDeptResTimeChartData()} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={8} tickLine={false} interval={0} angle={-15} textAnchor="end" />
                        <YAxis stroke="#64748b" fontSize={9} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px' }} />
                        <Bar dataKey="hours" fill="#1E40AF" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-400">
                      No department resolution duration records to display.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm h-[320px] flex flex-col">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 pb-3 border-b border-slate-100">
                  SLA Compliance Analytics
                </h4>
                <div className="flex-1 min-h-0 pt-2">
                  {stats && getSlaChartData().length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={getSlaChartData()} cx="50%" cy="45%" innerRadius={45} outerRadius={65} paddingAngle={4} dataKey="value">
                          {getSlaChartData().map((entry, index) => (
                            <Cell key={`sla-rep-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px' }} />
                        <Legend verticalAlign="bottom" align="center" iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-400">
                      No SLA records to display.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Escalation & Reopen Detailed Analytics Section */}
            {stats && (
              <div className="grid gap-6 md:grid-cols-2 pt-2 border-t border-slate-100">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
                    <Flame size={14} className="text-rose-600" /> Escalation Audit & Reasons
                  </h4>
                  <div className="text-xs space-y-2">
                    <div className="flex items-center justify-between text-slate-700">
                      <span>Total Escalated Tickets:</span>
                      <strong className="font-mono text-rose-700">{safeNumber(stats.escalation_analytics?.total_escalated)}</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-700">
                      <span>Overall Escalation Rate:</span>
                      <strong className="font-mono text-rose-700">{formatPercent(stats.escalation_analytics?.escalation_rate, '0%')}</strong>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Recorded Escalation Reasons
                    </span>
                    {stats.escalation_analytics?.escalation_reasons && Object.keys(stats.escalation_analytics.escalation_reasons).length > 0 ? (
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {Object.entries(stats.escalation_analytics.escalation_reasons).map(([reasonKey, countVal], idx) => (
                          <div key={idx} className="flex items-center justify-between text-[11px] bg-white p-2 rounded border border-slate-200">
                            <span className="text-slate-800 font-medium truncate max-w-[200px]">
                              {reasonKey || 'Generic Escalation'}
                            </span>
                            <span className="font-bold text-rose-600 font-mono">{safeNumber(countVal)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 italic bg-white p-2.5 rounded border border-slate-200 text-center">
                        No custom escalation reasons recorded.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <RefreshCw size={14} className="text-amber-600" /> Reopen & Resolution Duration Audit
                  </h4>
                  <div className="text-xs space-y-2">
                    <div className="flex items-center justify-between text-slate-700">
                      <span>Total Reopened Tickets:</span>
                      <strong className="font-mono text-amber-700">{safeNumber(stats.reopen_analytics?.total_reopened)}</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-700">
                      <span>Reopen Rate:</span>
                      <strong className="font-mono text-amber-700">{formatPercent(stats.reopen_analytics?.reopen_rate, '0%')}</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-700">
                      <span>Average Resolution Time:</span>
                      <strong className="font-mono text-slate-800">{formatHoursDetailed(stats.resolution_analytics?.avg_resolution_time_hours)}</strong>
                    </div>
                    {stats.resolution_analytics?.avg_reopen_resolution_time_hours !== undefined && (
                      <div className="flex items-center justify-between text-slate-700">
                        <span>Avg Reopen Resolution Duration:</span>
                        <strong className="font-mono text-slate-800">{formatHoursDetailed(stats.resolution_analytics.avg_reopen_resolution_time_hours)}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: OFFICER ACCOUNTS */}
        {activeTab === 'users' && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2.5">
              Active Officer & Reviewer Accounts
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 font-extrabold uppercase tracking-wider text-slate-500">
                    <th className="p-3.5 pl-4">Account ID</th>
                    <th className="p-3.5">Officer Name</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Department Domain</th>
                    <th className="p-3.5 text-right">Security Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { id: 'usr-001', name: 'Admin Manager', role: 'System Administrator', domain: 'All Domains', security: 'Two-Factor Enabled' },
                    { id: 'usr-002', name: 'Officer Rajesh Kumar', role: 'Department Manager', domain: 'Water Supply', security: 'Active (Password set)' },
                    { id: 'usr-003', name: 'Officer Sunita Rao', role: 'Grievance Reviewer', domain: 'Electricity Board', security: 'Active (Password set)' },
                    { id: 'usr-004', name: 'Inspector Harish Patel', role: 'Field Inspector', domain: 'Infrastructure / Roads', security: 'Two-Factor Enabled' },
                  ].map((usr) => (
                    <tr key={usr.id} className="hover:bg-slate-50 bg-white">
                      <td className="p-3.5 pl-4 font-mono font-bold text-slate-800">{usr.id}</td>
                      <td className="p-3.5 font-bold text-slate-900">{usr.name}</td>
                      <td className="p-3.5 text-slate-600">{usr.role}</td>
                      <td className="p-3.5 font-bold text-[#1E40AF]">{usr.domain}</td>
                      <td className="p-3.5 text-right text-slate-500 text-[11px]">{usr.security}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 7: CONSOLE SETTINGS */}
        {activeTab === 'settings' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6 text-xs">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-3">
              Administrative Console Settings
            </h3>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <span className="block font-extrabold text-slate-800 uppercase tracking-wider text-[10px]">
                  AI Auto-routing Confidence Cutoff
                </span>
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Classification Threshold</label>
                    <input type="range" min="0" max="100" defaultValue="75" className="w-full accent-[#1E40AF]" />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                      <span>Manual review threshold</span>
                      <span className="font-bold text-[#1E40AF]">75% confidence</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Frustration Score Escalation Trigger</label>
                    <input type="range" min="0" max="100" defaultValue="60" className="w-full accent-[#1E40AF]" />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                      <span>Escalate to High Priority if frustration exceeds</span>
                      <span className="font-bold text-[#1E40AF]">60%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <span className="block font-extrabold text-slate-800 uppercase tracking-wider text-[10px]">
                  SLA Timers & Resolution Targets
                </span>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">High Priority</label>
                    <input type="number" defaultValue="24" className="w-full rounded-md border border-slate-300 px-3 py-1.5 outline-none text-slate-800" />
                    <span className="text-[10px] text-slate-400">hours limit</span>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Medium Priority</label>
                    <input type="number" defaultValue="72" className="w-full rounded-md border border-slate-300 px-3 py-1.5 outline-none text-slate-800" />
                    <span className="text-[10px] text-slate-400">hours limit</span>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Low Priority</label>
                    <input type="number" defaultValue="120" className="w-full rounded-md border border-slate-300 px-3 py-1.5 outline-none text-slate-800" />
                    <span className="text-[10px] text-slate-400">hours limit</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => showToast('Console configurations saved successfully.', 'success')}
                className="rounded-lg bg-[#1E40AF] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#16327e] shadow-xs cursor-pointer"
              >
                Save Settings
              </button>
            </div>
          </div>
        )}

        {/* COMPLAINT DETAIL INSPECTION MODAL */}
        {inspectingComplaint && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
            onClick={() => setInspectingComplaint(null)}
          >
            <div
              className="relative w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-extrabold text-[#1E40AF]">
                      {inspectingComplaint.grievance_id || `#${inspectingComplaint.id.substring(0, 8)}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyId(inspectingComplaint.grievance_id || inspectingComplaint.id)}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded cursor-pointer"
                      title="Copy Grievance ID"
                    >
                      {copiedId === (inspectingComplaint.grievance_id || inspectingComplaint.id) ? (
                        <Check size={14} className="text-emerald-600" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Logged on {new Date(inspectingComplaint.timestamp).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`rounded-md border px-2.5 py-1 text-xs ${getPriorityBadgeClass(inspectingComplaint.priority)}`}>
                    {inspectingComplaint.priority} Priority
                  </span>
                  <span className={`rounded-md border px-2.5 py-1 text-xs ${getStatusBadgeClass(inspectingComplaint.status)}`}>
                    {inspectingComplaint.status}
                  </span>

                  {(() => {
                    const slaDetails = getSlaBadgeDetails(inspectingComplaint.sla_status);
                    const SlaIcon = slaDetails.Icon;
                    return (
                      <span className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs ${slaDetails.className}`}>
                        <SlaIcon size={12} />
                        <span>{slaDetails.label}</span>
                      </span>
                    );
                  })()}

                  {inspectingComplaint.escalation_status === 'ESCALATED' && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-rose-400 bg-rose-900 text-white font-extrabold px-2.5 py-1 text-xs shadow-2xs">
                      <Flame size={12} className="text-amber-300 animate-pulse" />
                      <span>ESCALATED L{inspectingComplaint.escalation_level || 1}</span>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setInspectingComplaint(null)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                    aria-label="Close modal"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Combined SLA Breach + Escalation Alert Banner */}
              {inspectingComplaint.sla_status === 'SLA_BREACHED' && inspectingComplaint.escalation_status === 'ESCALATED' && (
                <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-rose-500 bg-rose-900 text-white p-4 shadow-lg animate-pulse">
                  <div className="flex items-center gap-3">
                    <AlertCircle size={22} className="text-rose-200 shrink-0" />
                    <div>
                      <span className="font-extrabold uppercase tracking-wider text-xs block text-rose-200">
                        CRITICAL AUDIT ALERT: BREACHED & ESCALATED
                      </span>
                      <p className="text-xs font-semibold text-rose-100 mt-0.5">
                        This grievance has exceeded its SLA resolution deadline AND has been escalated to Level {inspectingComplaint.escalation_level || 1} senior management.
                      </p>
                    </div>
                  </div>
                  <span className="rounded-lg bg-rose-800 px-3 py-1 text-xs font-extrabold border border-rose-400 shrink-0">
                    High Priority Action
                  </span>
                </div>
              )}

              {/* Grid Overview */}
              <div className="grid gap-6 md:grid-cols-3">
                {/* Left Column: Complaint Details (2 cols) */}
                <div className="md:col-span-2 space-y-5">
                  {/* Full Description */}
                  <div className="space-y-1.5">
                    <span className="block text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      Grievance Description
                    </span>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs font-medium text-slate-800 leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto">
                      {inspectingComplaint.complaint_text}
                    </div>
                  </div>

                  {/* Department & Urgency Grid */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Department</span>
                      <select
                        value={inspectingComplaint.department || ''}
                        onChange={(e) => handleUpdateDepartment(inspectingComplaint.id, e.target.value)}
                        disabled={updatingId === inspectingComplaint.id}
                        className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-[#1E40AF] outline-none cursor-pointer"
                        aria-label="Reassign department"
                      >
                        {DEPARTMENT_OPTIONS.map((deptOpt) => (
                          <option key={deptOpt} value={deptOpt}>
                            {deptOpt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Predicted Category & Urgency</span>
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className={`rounded-md border px-2.5 py-0.5 ${getCategoryBadgeClass(inspectingComplaint.category)}`}>
                          {inspectingComplaint.category}
                        </span>
                        <span className="text-[#1E40AF] font-mono">
                          {getFrustrationPercentage(inspectingComplaint.sentiment_score)}% Urgency
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* SLA & Escalation Details */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* SLA Details Card */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          SLA Target & Deadline
                        </span>
                        {(() => {
                          const rem = getSlaTimeRemaining(
                            inspectingComplaint.sla_deadline,
                            inspectingComplaint.sla_status,
                            inspectingComplaint.status
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
                      <div className="text-xs font-bold text-slate-900">
                        {inspectingComplaint.sla_deadline
                          ? new Date(inspectingComplaint.sla_deadline).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                          : `Target SLA Window: ${inspectingComplaint.priority === 'High' ? '24 Hours' : inspectingComplaint.priority === 'Medium' ? '72 Hours' : '120 Hours'}`}
                      </div>
                      <div className="pt-1">
                        {(() => {
                          const slaDetails = getSlaBadgeDetails(inspectingComplaint.sla_status);
                          const SlaIcon = slaDetails.Icon;
                          return (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold rounded border px-2 py-0.5 ${slaDetails.className}`}>
                              <SlaIcon size={11} />
                              <span>{slaDetails.label}</span>
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Escalation Details Card */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Escalation Status & Reason
                      </span>
                      <div className="text-xs font-bold text-slate-800">
                        {inspectingComplaint.escalation_status === 'ESCALATED' ? (
                          <span className="inline-flex items-center gap-1 text-rose-700 font-extrabold">
                            <Flame size={13} className="text-rose-600" />
                            <span>Escalated (Level {inspectingComplaint.escalation_level || 1})</span>
                          </span>
                        ) : (
                          <span className="text-slate-600">Normal Priority Queue</span>
                        )}
                      </div>
                      {inspectingComplaint.escalation_reason ? (
                        <p className="text-[11px] text-rose-800 italic mt-1 bg-rose-50 border border-rose-200 rounded p-2 leading-relaxed">
                          Reason: "{inspectingComplaint.escalation_reason}"
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400 italic">No escalation recorded.</p>
                      )}
                    </div>
                  </div>

                  {/* Resolution & Reopen Information if available */}
                  {(inspectingComplaint.resolution_remarks || inspectingComplaint.reopened_reason) && (
                    <div className="rounded-xl border border-slate-200 bg-blue-50/40 p-4 space-y-3">
                      {inspectingComplaint.resolution_remarks && (
                        <div>
                          <span className="block text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                            Official Resolution Remarks ({inspectingComplaint.resolved_by || 'Officer'})
                          </span>
                          <p className="text-xs font-medium text-slate-800 mt-1 bg-white border border-emerald-200 rounded-lg p-2.5">
                            {inspectingComplaint.resolution_remarks}
                          </p>
                        </div>
                      )}

                      {inspectingComplaint.reopened_reason && (
                        <div>
                          <span className="block text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
                            Reopening Reason ({inspectingComplaint.reopened_by || 'Citizen / Officer'})
                          </span>
                          <p className="text-xs font-medium text-slate-800 mt-1 bg-white border border-amber-200 rounded-lg p-2.5">
                            {inspectingComplaint.reopened_reason}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Potential Duplicate Detected Warning Card */}
                  {inspectingComplaint.possible_duplicate && (
                    <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-2xs">
                      <AlertTriangle size={20} className="text-amber-600 shrink-0" />
                      <div>
                        <span className="font-extrabold uppercase tracking-wider text-[11px] block text-amber-900">
                          Potential Duplicate Detected
                        </span>
                        <p className="text-slate-700 mt-0.5 font-medium">
                          This grievance is highly similar to one or more existing complaints in the municipal database. Please inspect the related tickets below before taking administrative action.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Related / Similar Grievances Section */}
                  <div className="space-y-3 pt-4 border-t border-slate-200">
                    <div>
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                        <Sparkles size={14} className="text-[#1E40AF]" /> Related / Similar Grievances
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        AI detected complaints that may be related to this grievance.
                      </p>
                    </div>

                    {/* Advisory Notice */}
                    <div className="rounded-lg bg-blue-50/70 border border-blue-200 p-2.5 text-[11px] text-blue-900 font-medium">
                      <strong>Advisory Notice:</strong> AI-generated suggestion — review before marking complaints as duplicates or taking action.
                    </div>

                    {parseRelatedGrievances(inspectingComplaint.related_grievances).length > 0 ? (
                      <div className="space-y-3">
                        {parseRelatedGrievances(inspectingComplaint.related_grievances).map((rel, idx) => {
                          const relId = rel.related_grievance_id || rel.grievance_id || rel.id;
                          const simInfo = getSimilarityInfo(rel.similarity_score);
                          return (
                            <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2.5">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => handleInspectRelatedGrievance(relId)}
                                    className="font-mono text-xs font-extrabold text-[#1E40AF] hover:underline flex items-center gap-1 cursor-pointer"
                                    title="Click to inspect this related grievance"
                                  >
                                    <Eye size={12} />
                                    <span>{relId}</span>
                                  </button>
                                  {rel.category && (
                                    <span className={`rounded border px-2 py-0.5 text-[10px] ${getCategoryBadgeClass(rel.category)}`}>
                                      {rel.category}
                                    </span>
                                  )}
                                  {rel.status && (
                                    <span className={`rounded border px-2 py-0.5 text-[10px] ${getStatusBadgeClass(rel.status)}`}>
                                      {rel.status}
                                    </span>
                                  )}
                                </div>

                                <span className={`rounded-md border px-2.5 py-0.5 text-[10px] ${simInfo.badgeClass}`}>
                                  {simInfo.label} ({simInfo.percentage}%)
                                </span>
                              </div>

                              {/* Similarity Progress Fill Bar */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px] font-bold text-slate-500">
                                  <span>AI Similarity Score</span>
                                  <span className="font-mono text-slate-800">{simInfo.percentage}% Match</span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${simInfo.barColor}`}
                                    style={{ width: `${simInfo.percentage}%` }}
                                  />
                                </div>
                              </div>

                              {rel.department && (
                                <div className="text-[11px] text-slate-600 font-medium">
                                  <span className="text-slate-400">Department:</span> {rel.department}
                                </div>
                              )}

                              {rel.match_reason && (
                                <div className="text-[10px] text-slate-500 italic bg-slate-50 p-2 rounded border border-slate-200">
                                  Match Criteria: {rel.match_reason}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500 space-y-1">
                        <Inbox size={22} className="mx-auto text-slate-300" />
                        <span className="font-bold text-slate-700 block">No related grievances detected.</span>
                        <p className="text-[11px] text-slate-500">
                          This complaint does not currently have a strong similarity match in the system database.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Status History Timeline (1 col) */}
                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                        <History size={14} className="text-[#1E40AF]" /> Status History Timeline
                      </span>
                    </div>

                    <div className="max-h-[350px] overflow-y-auto space-y-3 pr-1">
                      {loadingHistory ? (
                        <div className="space-y-2 py-4">
                          <div className="h-10 animate-pulse bg-slate-200 rounded-lg" />
                          <div className="h-10 animate-pulse bg-slate-200 rounded-lg" />
                        </div>
                      ) : inspectingHistory.length > 0 ? (
                        inspectingHistory.map((hist, index) => (
                          <div key={index} className="relative pl-5 border-l-2 border-blue-400 pb-3 text-xs space-y-1">
                            <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-[#1E40AF]" />
                            <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                              <span>{new Date(hist.changed_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>
                              <span className="font-bold text-slate-700">{hist.changed_by || 'Officer'}</span>
                            </div>
                            <div className="flex items-center gap-1 font-bold text-slate-900 text-[11px]">
                              <span className="text-slate-500">{hist.previous_status || 'INITIAL'}</span>
                              <span>→</span>
                              <span className={`px-1.5 py-0.5 rounded ${getStatusBadgeClass(hist.new_status)}`}>
                                {hist.new_status}
                              </span>
                            </div>
                            {hist.remark && (
                              <p className="text-[10px] text-slate-600 italic bg-white p-1.5 rounded border border-slate-200 mt-1">
                                "{hist.remark}"
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-slate-400 text-xs py-8">
                          No history records logged for this grievance.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions Footer */}
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
                {inspectingComplaint.status === 'SUBMITTED' && (
                  <button
                    type="button"
                    onClick={() => handleDirectStatusUpdate(inspectingComplaint.id, 'ASSIGNED')}
                    disabled={updatingId === inspectingComplaint.id}
                    className="flex items-center gap-1.5 rounded-lg bg-[#1E40AF] px-4 py-2 text-xs font-bold text-white hover:bg-[#16327e] disabled:opacity-50 cursor-pointer"
                  >
                    <Play size={13} /> Assign to Department
                  </button>
                )}

                {inspectingComplaint.status === 'ASSIGNED' && (
                  <button
                    type="button"
                    onClick={() => handleDirectStatusUpdate(inspectingComplaint.id, 'IN_PROGRESS')}
                    disabled={updatingId === inspectingComplaint.id}
                    className="flex items-center gap-1.5 rounded-lg bg-[#1E40AF] px-4 py-2 text-xs font-bold text-white hover:bg-[#16327e] disabled:opacity-50 cursor-pointer"
                  >
                    <Play size={13} /> Start Work
                  </button>
                )}

                {inspectingComplaint.status === 'IN_PROGRESS' && (
                  <button
                    type="button"
                    onClick={() => openStatusModal(inspectingComplaint, 'RESOLVED')}
                    disabled={updatingId === inspectingComplaint.id}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                  >
                    <Check size={13} /> Resolve Ticket
                  </button>
                )}

                {inspectingComplaint.status === 'RESOLVED' && (
                  <>
                    <button
                      type="button"
                      onClick={() => openStatusModal(inspectingComplaint, 'CLOSED')}
                      disabled={updatingId === inspectingComplaint.id}
                      className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                    >
                      <CheckCircle2 size={13} /> Close Ticket
                    </button>

                    <button
                      type="button"
                      onClick={() => openStatusModal(inspectingComplaint, 'REOPENED')}
                      disabled={updatingId === inspectingComplaint.id}
                      className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw size={13} /> Reopen Ticket
                    </button>
                  </>
                )}

                {inspectingComplaint.status === 'REOPENED' && (
                  <button
                    type="button"
                    onClick={() => handleDirectStatusUpdate(inspectingComplaint.id, 'IN_PROGRESS')}
                    disabled={updatingId === inspectingComplaint.id}
                    className="flex items-center gap-1.5 rounded-lg bg-[#1E40AF] px-4 py-2 text-xs font-bold text-white hover:bg-[#16327e] disabled:opacity-50 cursor-pointer"
                  >
                    <Play size={13} /> Resume Work
                  </button>
                )}

                {inspectingComplaint.escalation_status !== 'ESCALATED' && inspectingComplaint.status !== 'RESOLVED' && inspectingComplaint.status !== 'CLOSED' && (
                  <button
                    type="button"
                    onClick={() => openEscalationModal(inspectingComplaint)}
                    disabled={updatingId === inspectingComplaint.id}
                    className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                  >
                    <Flame size={13} /> Escalate Ticket
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setInspectingComplaint(null)}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Close Window
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ACTION REMARKS MODAL */}
        {actionModal.isOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
            onClick={() => setActionModal((prev) => ({ ...prev, isOpen: false }))}
          >
            <div
              className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-extrabold text-slate-900">{actionModal.title}</h3>
                <button
                  type="button"
                  onClick={() => setActionModal((prev) => ({ ...prev, isOpen: false }))}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{actionModal.description}</p>

              {actionModal.required && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    {actionModal.targetStatus === 'RESOLVED' ? 'Resolution Remarks *' : 'Reopening Reason *'}
                  </label>
                  <textarea
                    value={actionModal.remark}
                    onChange={(e) => setActionModal((prev) => ({ ...prev, remark: e.target.value }))}
                    placeholder={
                      actionModal.targetStatus === 'RESOLVED'
                        ? 'Describe corrective actions taken (e.g. replaced pipe fitting, restored power connection)...'
                        : 'State reason for reopening...'
                    }
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 p-3 text-xs outline-none focus:border-[#1E40AF]"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActionModal((prev) => ({ ...prev, isOpen: false }))}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmStatusAction}
                  disabled={actionModal.required && !actionModal.remark.trim()}
                  className={`rounded-lg px-4 py-2 text-xs font-bold text-white shadow-xs disabled:opacity-40 cursor-pointer ${actionModal.confirmColor}`}
                >
                  {actionModal.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ESCALATION REASON MODAL */}
        {escalationModal.isOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
            onClick={() => setEscalationModal((prev) => ({ ...prev, isOpen: false }))}
          >
            <div
              className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-extrabold text-rose-800 flex items-center gap-1.5">
                  <Flame size={18} className="text-rose-600" /> Escalate Grievance Ticket
                </h3>
                <button
                  type="button"
                  onClick={() => setEscalationModal((prev) => ({ ...prev, isOpen: false }))}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Escalating a complaint flags it for senior municipal officers and increases urgency level. Please provide a clear justification for escalation.
              </p>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Escalation Reason *</label>
                <textarea
                  value={escalationModal.reason}
                  onChange={(e) => setEscalationModal((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="State reason for escalation (e.g. SLA breach, unaddressed public safety hazard)..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 p-3 text-xs outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEscalationModal((prev) => ({ ...prev, isOpen: false }))}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEscalation}
                  disabled={!escalationModal.reason.trim()}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 shadow-xs disabled:opacity-40 cursor-pointer"
                >
                  Confirm Escalation
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TOAST NOTIFICATION BANNER */}
        {toast.show && (
          <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl border border-slate-800 bg-[#0f172a] px-4 py-3 text-xs font-bold text-white shadow-2xl">
            {toast.type === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle size={18} className="text-rose-400 shrink-0" />
            )}
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast({ show: false, message: '', type: 'success' })}
              className="ml-2 rounded p-1 text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

