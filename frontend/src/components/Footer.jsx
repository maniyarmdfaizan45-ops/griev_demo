import React from 'react';
import { Building2, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer id="contact" className="border-t border-slate-300 bg-slate-900 text-slate-300">
      {/* Decorative top strip */}
      <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 via-white to-green-600"></div>

      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 md:px-8 lg:grid-cols-[1.5fr_0.8fr_0.8fr]">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded bg-[#1E40AF] p-2 text-white">
              <Building2 size={20} />
            </div>
            <span className="text-base font-bold text-white">
              AI Smart Public Grievance Portal
            </span>
          </div>
          <p className="max-w-md text-xs leading-5 text-slate-400">
            This is the official Public Grievance Redressal Portal of the Municipal Corporation. Citizens can report civic issues, route them to appropriate departments, and track redressal progress online. Designed for transparency and citizen satisfaction.
          </p>
          <div className="text-[11px] text-slate-500">
            Website Content Managed by Municipal Corporation IT Department.
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-white border-b border-slate-800 pb-2">
            Citizen Corner
          </h3>
          <ul className="space-y-2.5 text-xs text-slate-400">
            <li>
              <a href="/" className="hover:text-white transition">About Municipal System</a>
            </li>
            <li>
              <a href="/submit" className="hover:text-white transition">Submit New Grievance</a>
            </li>
            <li>
              <a href="/history" className="hover:text-white transition">Track Grievance Status</a>
            </li>
            <li>
              <a href="/admin/login" className="hover:text-white transition">Department Employee Login</a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-white border-b border-slate-800 pb-2">
            Contact & Support
          </h3>
          <ul className="space-y-3 text-xs text-slate-400">
            <li className="flex items-center gap-2">
              <Phone size={14} className="text-[#1E40AF]" />
              <span>Toll Free: 1800-345-5555 (9 AM - 6 PM)</span>
            </li>
            <li className="flex items-center gap-2">
              <Mail size={14} className="text-[#1E40AF]" />
              <span>pg-support@grievance.gov.in</span>
            </li>
            <li className="flex items-center gap-2">
              <MapPin size={14} className="text-[#1E40AF]" />
              <span>Municipal Headquarters, 4th Floor, City Center</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Policy and Copyright Links */}
      <div className="border-t border-slate-800 bg-[#0f172a] px-6 py-6 md:px-8 text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-[#16A34A]" />
            <span>© {currentYear} Municipal Corporation. All Rights Reserved.</span>
          </div>
          <div className="flex flex-wrap gap-4 text-[11px]">
            <a href="#" className="hover:underline hover:text-white">Help & FAQs</a>
            <span className="text-slate-700">|</span>
            <a href="#" className="hover:underline hover:text-white">Privacy Policy</a>
            <span className="text-slate-700">|</span>
            <a href="#" className="hover:underline hover:text-white">Terms of Use</a>
            <span className="text-slate-700">|</span>
            <a href="#" className="hover:underline hover:text-white">Hyperlinking Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
