import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Droplets,
  MapPinned,
  ShieldCheck,
  Trash2,
  Zap,
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

export default function Home() {
  return (
    <div className="pb-16">
      {/* Official State Banner / Hero Section */}
      <section className="border-b border-slate-300 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:py-16 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded bg-slate-100 border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">
              <ShieldCheck size={14} className="text-[#16A34A]" />
              Official Grievance Registration & Monitoring Portal
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl md:text-5xl leading-tight">
              Lodge Public Complaints Directly with Municipal Authorities
            </h2>
            <p className="text-sm leading-6 text-slate-600">
              The AI Smart Public Grievance Management System enables citizens to report local municipal issues. Using automated machine learning classifier models, the system instantly identifies the relevant department and prioritizes resolving grievances to maintain city services.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                to="/submit"
                className="inline-flex items-center justify-center gap-2 rounded bg-[#1E40AF] px-5 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#16327e] transition shadow-sm"
              >
                Submit Complaint <ArrowRight size={14} />
              </Link>
              <Link
                to="/history"
                className="inline-flex items-center justify-center gap-2 rounded border border-slate-300 bg-white px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 transition"
              >
                Track Status
              </Link>
            </div>
          </div>

          {/* Official Illustration Container */}
          <div className="flex justify-center lg:justify-end">
            <div className="overflow-hidden rounded-lg border border-slate-300 bg-slate-50 p-2.5 shadow-sm max-w-md w-full">
              <img
                src="/hero-illustration.png"
                alt="Government Citizen Services Illustration"
                className="rounded border border-slate-200 bg-white w-full h-auto object-cover"
              />
              <div className="mt-2 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Civic Services Grievance Dashboard Panel
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Service Cards Section */}
      <section className="mx-auto max-w-7xl px-6 py-12 md:px-8">
        <div className="mb-8 border-b border-slate-200 pb-4">
          <span className="text-xs font-bold uppercase tracking-widest text-[#1E40AF]">
            Department Classification
          </span>
          <h3 className="mt-1 text-xl font-bold text-slate-900">
            Select issue categories to register a complaint
          </h3>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {serviceCards.map(({ title, description, icon: Icon, color }) => (
            <div
              key={title}
              className="flex flex-col justify-between rounded border border-slate-300 bg-white p-6 transition duration-150 hover:border-[#1E40AF] hover:shadow-sm"
            >
              <div>
                <div className={`mb-4 inline-flex rounded border p-2.5 ${color}`}>
                  <Icon size={20} />
                </div>
                <h4 className="text-base font-bold text-slate-900">{title}</h4>
                <p className="mt-2.5 text-xs leading-5 text-slate-600">{description}</p>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-100">
                <Link
                  to={`/submit?dept=${title}`}
                  className="text-xs font-bold text-[#1E40AF] hover:underline flex items-center gap-1"
                >
                  File Complaint <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Statistics Section */}
      <section className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="rounded-lg border border-slate-300 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-2 border-b border-slate-200 pb-3">
            <BarChart3 size={18} className="text-[#1E40AF]" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Portal Redressal Performance Ledger
            </h3>
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
