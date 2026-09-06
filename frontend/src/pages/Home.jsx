import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Droplets,
  MapPinned,
  ShieldCheck,
  Trash2,
  Zap,
  Cpu,
  Clock,
  SearchCheck,
  FileText,
  CheckCircle2,
  Building2,
  AlertTriangle,
  Sparkles,
  Layers,
  Search,
  Activity,
  ChevronRight
} from 'lucide-react';

const serviceCards = [
  {
    title: 'Water Issues',
    description: 'Leaks, supply pressure, burst pipelines, water quality, and sewer drainage overflows.',
    icon: Droplets,
    color: 'text-[#1E40AF] bg-blue-50 border-blue-200',
  },
  {
    title: 'Electricity Issues',
    description: 'Faulty streetlights, wire hazards, transformer failure, and regular power cuts.',
    icon: Zap,
    color: 'text-[#EA580C] bg-orange-50 border-orange-200',
  },
  {
    title: 'Road Problems',
    description: 'Potholes, broken pavements, road blockage, and damaged speed dividers/signage.',
    icon: MapPinned,
    color: 'text-[#16A34A] bg-green-50 border-green-200',
  },
  {
    title: 'Waste Management',
    description: 'Uncollected garbage piles, public littering, and general sanitation requests.',
    icon: Trash2,
    color: 'text-slate-700 bg-slate-100 border-slate-200',
  },
];

const stats = [
  { label: 'Total Complaints Received', value: '3,482', description: 'Grievances registered on portal' },
  { label: 'Resolved Complaints', value: '2,106', description: 'Disposed within standard SLA' },
  { label: 'Pending Grievances', value: '1,146', description: 'Under active department review' },
  { label: 'Departments Connected', value: '12', description: 'Municipal offices synced' },
];

const capabilityBadges = [
  {
    title: 'AI-Powered Classification',
    desc: 'Multinomial Naive Bayes NLP model automatically categorizes complaints.',
    icon: Cpu,
    color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  },
  {
    title: '5 Complaint Categories',
    desc: 'Water, Electricity, Road, Waste Management, and General Civic Support.',
    icon: Layers,
    color: 'text-blue-700 bg-blue-50 border-blue-200',
  },
  {
    title: 'SLA Monitoring',
    desc: 'Automated 24h, 48h, and 72h resolution deadline tracking with escalation triggers.',
    icon: Clock,
    color: 'text-amber-700 bg-amber-50 border-amber-200',
  },
  {
    title: 'Real-Time Complaint Tracking',
    desc: 'Human-friendly Grievance IDs & transparent public status timelines.',
    icon: SearchCheck,
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  },
];

const workflowSteps = [
  { step: '01', title: 'Submit Complaint', desc: 'Citizen files complaint details with location & description.', icon: FileText },
  { step: '02', title: 'AI Classification', desc: 'NLP model analyzes text and identifies category.', icon: Cpu },
  { step: '03', title: 'Priority Detection', desc: 'Sentiment intensity determines High, Medium, or Low priority.', icon: Activity },
  { step: '04', title: 'Department Assignment', desc: 'Routed directly to relevant municipal department.', icon: Building2 },
  { step: '05', title: 'SLA Monitoring', desc: 'Active resolution countdown with automatic warning alerts.', icon: Clock },
  { step: '06', title: 'Resolution', desc: 'Officer disposes ticket with verification & remarks.', icon: CheckCircle2 },
];

const intelligentFeatures = [
  {
    title: 'Automated NLP Categorization',
    desc: 'Eliminates manual triage delays using TF-IDF feature weighting to classify intake descriptions in real time.',
    icon: Sparkles,
  },
  {
    title: 'Sentiment-Based Priority Index',
    desc: 'Measures urgency and emotional intensity to flag hazardous public safety grievances for high-priority handling.',
    icon: Activity,
  },
  {
    title: 'Smart Department Routing',
    desc: 'Directly maps submitted complaints to official municipal departments including Water, Power, and Public Works.',
    icon: Building2,
  },
  {
    title: 'Duplicate Grievance Detection',
    desc: 'Scans active records for text similarity and geographical overlap to prevent duplicate ticket buildup.',
    icon: Layers,
  },
  {
    title: 'SLA Escalation Engine',
    desc: 'Continuously monitors resolution windows and triggers alerts or escalation when deadlines approach breach.',
    icon: AlertTriangle,
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [quickTrackId, setQuickTrackId] = useState('');

  const handleQuickTrackSubmit = (e) => {
    e.preventDefault();
    if (quickTrackId.trim()) {
      navigate(`/history?id=${encodeURIComponent(quickTrackId.trim().toUpperCase())}`);
    } else {
      navigate('/history');
    }
  };

  return (
    <div className="pb-16 space-y-12">
      {/* Official State Banner / Hero Section */}
      <section className="border-b border-slate-300 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:py-16 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded bg-slate-100 border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs">
              <ShieldCheck size={16} className="text-[#16A34A] shrink-0" />
              <span>Official Grievance Registration & Monitoring Portal</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl md:text-5xl leading-tight">
              Lodge Public Complaints Directly with Municipal Authorities
            </h1>
            <p className="text-sm leading-7 text-slate-600 max-w-2xl">
              The AI Smart Public Grievance Management System enables citizens to report civic infrastructure issues. Using automated machine learning classifier models, the system instantly identifies the relevant department and prioritizes resolving grievances to maintain city services.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 pt-2">
              <Link
                to="/submit"
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded bg-[#1E40AF] px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#16327e] transition-all shadow-sm hover:shadow"
              >
                Submit Complaint <ArrowRight size={15} />
              </Link>
              <Link
                to="/history"
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded border border-slate-300 bg-white px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all"
              >
                Track Status
              </Link>
            </div>
          </div>

          {/* Official Illustration Container */}
          <div className="flex justify-center lg:justify-end">
            <div className="overflow-hidden rounded-lg border border-slate-300 bg-slate-50 p-3 shadow-sm max-w-md w-full">
              <img
                src="/hero-illustration.png"
                alt="Government Citizen Services Illustration"
                className="rounded border border-slate-200 bg-white w-full h-auto object-cover"
              />
              <div className="mt-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Civic Services Grievance Dashboard Panel
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capability / Trust Badges Section */}
      <section className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {capabilityBadges.map(({ title, desc, icon: Icon, color }) => (
            <div
              key={title}
              className="flex items-start gap-3.5 rounded-lg border border-slate-300 bg-white p-4 shadow-2xs hover:border-slate-400 transition"
            >
              <div className={`shrink-0 rounded border p-2.5 ${color}`}>
                <Icon size={20} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{title}</h4>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Department Category Cards Section */}
      <section className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="mb-8 border-b border-slate-200 pb-4">
          <span className="text-xs font-bold uppercase tracking-widest text-[#1E40AF]">
            Department Classification
          </span>
          <h2 className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">
            Select Issue Categories to Register a Complaint
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {serviceCards.map(({ title, description, icon: Icon, color }) => (
            <div
              key={title}
              className="flex flex-col justify-between rounded-lg border border-slate-300 bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#1E40AF] hover:shadow-md"
            >
              <div>
                <div className={`mb-4 inline-flex rounded border p-2.5 ${color}`}>
                  <Icon size={20} />
                </div>
                <h3 className="text-base font-bold text-slate-900">{title}</h3>
                <p className="mt-2.5 text-xs leading-relaxed text-slate-600">{description}</p>
              </div>
              <div className="mt-6 pt-3.5 border-t border-slate-100">
                <Link
                  to={`/submit?dept=${encodeURIComponent(title)}`}
                  className="text-xs font-bold text-[#1E40AF] hover:underline flex items-center justify-between group"
                >
                  <span>File Complaint</span>
                  <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="rounded-lg border border-slate-300 bg-white p-6 md:p-8 shadow-sm">
          <div className="mb-8 border-b border-slate-200 pb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[#1E40AF]">
              Automated Process Pipeline
            </span>
            <h2 className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">
              How It Works: End-to-End System Workflow
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Every complaint moves through a structured, automated intelligence pipeline from submission to resolution.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 relative">
            {workflowSteps.map(({ step, title, desc, icon: Icon }, index) => (
              <div
                key={step}
                className="flex flex-col justify-between rounded border border-slate-200 bg-slate-50/70 p-4 relative hover:border-slate-300 transition"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#1E40AF] bg-blue-100/80 px-2 py-0.5 rounded">
                      Step {step}
                    </span>
                    <Icon size={18} className="text-slate-700" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">{title}</h3>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">{desc}</p>
                </div>
                {index < workflowSteps.length - 1 && (
                  <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-slate-400">
                    <ChevronRight size={16} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Intelligent Grievance Processing Section */}
      <section className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="rounded-lg border border-slate-300 bg-white p-6 md:p-8 shadow-sm">
          <div className="mb-8 border-b border-slate-200 pb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[#1E40AF]">
              Machine Intelligence Engine
            </span>
            <h2 className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">
              Intelligent Grievance Processing Capabilities
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              The portal integrates machine learning algorithms to streamline intake triage, routing, and resolution oversight.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {intelligentFeatures.map(({ title, desc, icon: Icon }) => (
              <div
                key={title}
                className="rounded border border-slate-200 bg-slate-50/50 p-5 hover:border-slate-300 transition"
              >
                <div className="mb-3 inline-flex rounded border border-blue-200 bg-blue-50 p-2.5 text-[#1E40AF]">
                  <Icon size={20} />
                </div>
                <h3 className="text-sm font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Track Your Grievance CTA Section */}
      <section className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50/80 via-white to-slate-50 p-6 md:p-8 shadow-sm">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded bg-blue-100/80 px-3 py-1 text-[11px] font-bold text-[#1E40AF] uppercase tracking-wider">
              <SearchCheck size={14} /> Quick Status Lookup
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
              Already Registered a Grievance? Track Real-Time Progress
            </h2>
            <p className="text-xs leading-relaxed text-slate-600">
              Enter your official Grievance Reference ID (e.g., <code className="font-mono text-[#1E40AF] bg-white px-1.5 py-0.5 rounded border border-blue-200">GRV-20260907-000001</code>) to inspect live department processing, assigned officers, and status updates.
            </p>

            <form onSubmit={handleQuickTrackSubmit} className="flex flex-col sm:flex-row gap-3 pt-2 max-w-xl">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Enter Grievance ID (e.g. GRV-20260907-000001)"
                  value={quickTrackId}
                  onChange={(e) => setQuickTrackId(e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white py-3 pl-10 pr-4 text-xs font-semibold text-slate-800 outline-none focus:border-[#1E40AF] focus:ring-1 focus:ring-[#1E40AF]"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded bg-[#1E40AF] px-6 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#16327e] transition shrink-0 shadow-xs"
              >
                Track Status <ArrowRight size={14} />
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="rounded-lg border border-slate-300 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-2 border-b border-slate-200 pb-3">
            <BarChart3 size={18} className="text-[#1E40AF]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Portal Redressal Performance Ledger
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded border border-slate-200 bg-slate-50 p-4">
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {stat.label}
                </span>
                <strong className="mt-2 block text-3xl font-extrabold text-slate-900">
                  {stat.value}
                </strong>
                <p className="mt-1 text-[11px] text-slate-500 leading-normal">
                  {stat.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
