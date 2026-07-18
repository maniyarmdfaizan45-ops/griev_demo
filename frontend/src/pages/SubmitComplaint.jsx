import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { apiService } from '../services/api';
import { Sparkles, Send, ShieldAlert, BadgeInfo, AlertCircle, CheckCircle2, RefreshCw, Upload, Image as ImageIcon } from 'lucide-react';

export default function SubmitComplaint() {
  const routeLocation = useLocation();
  
  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [complaintText, setComplaintText] = useState('');
  const [department, setDepartment] = useState('Others');
  const [location, setLocation] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');

  // Status states
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  // Auto-fill department if query param exists
  useEffect(() => {
    const params = new URLSearchParams(routeLocation.search);
    const deptParam = params.get('dept');
    if (deptParam) {
      const validDepts = ['Water', 'Electricity', 'Road', 'Garbage', 'Others'];
      if (validDepts.includes(deptParam)) {
        setDepartment(deptParam);
      }
    }
  }, [routeLocation]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    if (!name.trim()) {
      setError('Citizen Name is required.');
      return false;
    }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit phone number.');
      return false;
    }
    if (!title.trim()) {
      setError('Complaint Title is required.');
      return false;
    }
    if (!complaintText.trim()) {
      setError('Please describe your grievance.');
      return false;
    }
    if (complaintText.trim().length < 15) {
      setError('Please provide a more detailed description (at least 15 characters).');
      return false;
    }
    if (!location.trim()) {
      setError('Grievance Location/Address is required.');
      return false;
    }
    setError('');
    return true;
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!complaintText.trim() || complaintText.trim().length < 15) {
      setError('Please enter detailed description (at least 15 characters) before analyzing.');
      return;
    }

    setAnalyzing(true);
    setPrediction(null);
    setSuccess(null);
    try {
      const response = await apiService.predict(complaintText);
      if (response.status === 'success') {
        setPrediction(response.data);
        // Pre-select the predicted department if matches
        if (response.data.category) {
          setDepartment(response.data.category);
        }
      } else {
        setError('Prediction model returned an invalid response.');
      }
    } catch (err) {
      setError(err.message || 'Failed to communicate with AI prediction server.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setError('');
    
    // Consolidate the form fields into complaint_text column to prevent backend schema breaking
    const consolidatedText = `TITLE: ${title.trim()}\n` +
                             `LOCATION: ${location.trim()}\n` +
                             `CITIZEN: ${name.trim()} (Phone: ${phone.trim()}, Email: ${email.trim()})\n` +
                             `ATTACHMENT: ${imageFile ? imageFile.name : 'None'}\n\n` +
                             `DESCRIPTION:\n${complaintText.trim()}`;

    const payload = {
      complaint_text: consolidatedText,
      category: department,
    };

    if (prediction) {
      payload.priority = prediction.priority;
      payload.sentiment_score = prediction.sentiment_score;
    }

    try {
      const response = await apiService.submitComplaint(payload);
      if (response.status === 'success') {
        setSuccess(response.complaint);
        // Clear all fields
        setName('');
        setEmail('');
        setPhone('');
        setTitle('');
        setComplaintText('');
        setLocation('');
        setImageFile(null);
        setImagePreview('');
        setPrediction(null);
      } else {
        setError('Grievance submission failed.');
      }
    } catch (err) {
      setError(err.message || 'Failed to submit grievance to the database.');
    } finally {
      setSubmitting(false);
    }
  };

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

  const getPriorityBadgeClass = (pri) => {
    const mapping = {
      High: 'bg-red-50 text-[#DC2626] border-red-300',
      Medium: 'bg-orange-50 text-[#EA580C] border-orange-300',
      Low: 'bg-green-50 text-[#16A34A] border-green-300',
    };
    return mapping[pri] || 'bg-slate-100 text-slate-600 border-slate-300';
  };

  const getFrustrationPercentage = (score) => {
    if (score >= 0) {
      return Math.round((1 - score) * 30);
    }
    return Math.round(30 + (Math.abs(score) * 70));
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 md:px-8">
      {/* Title */}
      <div className="mb-8 border-b border-slate-300 pb-4 text-center">
        <h2 className="text-2xl font-extrabold text-slate-900 md:text-3xl">Lodge New Public Grievance</h2>
        <p className="mx-auto mt-2 max-w-2xl text-xs text-slate-600">
          Please fill out the form below. The system automatically processes the description to suggest routing, and routes it directly to municipal officers.
        </p>
      </div>

      {/* Success Banner */}
      {success && (
        <div className="mb-8 rounded border border-emerald-300 bg-emerald-50 p-6 shadow-sm">
          <div className="flex gap-3">
            <CheckCircle2 size={24} className="text-[#16A34A] shrink-0" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-emerald-800">Grievance Submitted Successfully</h4>
              <p className="mt-1 text-xs text-emerald-700 leading-normal">
                Your ticket has been logged into the public ledger database. Keep your Reference ID to track progress.
              </p>
              <div className="mt-4 grid gap-4 rounded border border-emerald-200 bg-white p-4 text-xs md:grid-cols-3">
                <div>
                  <span className="block text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Reference ID</span>
                  <span className="font-mono font-bold text-slate-900 select-all">{success.id}</span>
                </div>
                <div>
                  <span className="block text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Assigned Department</span>
                  <span className="font-bold text-[#1E40AF]">{success.category}</span>
                </div>
                <div>
                  <span className="block text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Initial Priority</span>
                  <span className="font-bold text-[#DC2626]">{success.priority}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="mb-6 flex items-center gap-3 rounded border border-rose-300 bg-rose-50 p-4 text-xs font-semibold text-rose-700 shadow-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grievance Form */}
      <form onSubmit={handleSubmit} className="rounded-lg border border-slate-300 bg-white p-6 shadow-sm">
        {/* Step 1: Citizen details */}
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E40AF] mb-3">1. Citizen Contact Information</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-xs font-bold text-slate-700">Citizen Full Name *</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#1E40AF] focus:bg-white"
              />
            </div>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-bold text-slate-700">Email Address *</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rahul@example.com"
                className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#1E40AF] focus:bg-white"
              />
            </div>
            <div>
              <label htmlFor="phone" className="mb-1.5 block text-xs font-bold text-slate-700">Mobile Number *</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#1E40AF] focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Step 2: Grievance details */}
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E40AF] mb-3">2. Grievance Details</h3>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label htmlFor="title" className="mb-1.5 block text-xs font-bold text-slate-700">Complaint Title *</label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Summarize the issue (e.g. Water shortage in Block C)"
                  className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#1E40AF] focus:bg-white"
                />
              </div>
              <div>
                <label htmlFor="department" className="mb-1.5 block text-xs font-bold text-slate-700">Department Selection *</label>
                <select
                  id="department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#1E40AF] focus:bg-white"
                >
                  <option value="Water">Water Department</option>
                  <option value="Electricity">Electricity Board</option>
                  <option value="Road">Roads & Infrastructure</option>
                  <option value="Garbage">Garbage / Sanitation</option>
                  <option value="Others">Others / Admin</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="complaint" className="mb-1.5 block text-xs font-bold text-slate-700">Detailed Description *</label>
              <textarea
                id="complaint"
                rows={6}
                value={complaintText}
                onChange={(e) => setComplaintText(e.target.value)}
                placeholder="Please explain the problem clearly. Mention duration, impact, and other helpful context."
                className="w-full resize-none rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#1E40AF] focus:bg-white"
              />
              <span className="mt-1.5 block text-[10px] text-slate-500 leading-normal">
                Include street landmarks, block numbers, or specific points of reference. Minimum 15 characters.
              </span>
            </div>
          </div>
        </div>

        {/* Step 3: Location and Image upload */}
        <div className="mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E40AF] mb-3">3. Location & Supporting Image</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="location" className="mb-1.5 block text-xs font-bold text-slate-700">Grievance Location/Address *</label>
              <input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Flat 402, Sunshine Apts, Sector 12"
                className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#1E40AF] focus:bg-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">Upload Photo (Optional)</label>
              <div className="flex gap-3">
                <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600 hover:bg-slate-100">
                  <Upload size={14} className="text-slate-400" />
                  <span>Choose file...</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
                {imagePreview && (
                  <div className="h-9 w-9 overflow-hidden rounded border border-slate-300">
                    <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                  </div>
                )}
              </div>
              {imageFile && (
                <span className="mt-1 block text-[10px] text-slate-500 truncate">
                  Selected: {imageFile.name} ({(imageFile.size / 1024).toFixed(1)} KB)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Button Actions */}
        <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing || submitting}
            className="inline-flex items-center justify-center gap-1.5 rounded border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {analyzing ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} className="text-[#1E40AF]" />}
            Analyze with AI
          </button>
          <button
            type="submit"
            disabled={analyzing || submitting}
            className="inline-flex items-center justify-center gap-1.5 rounded bg-[#1E40AF] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#16327e] disabled:opacity-50"
          >
            {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
            Submit Grievance
          </button>
        </div>
      </form>

      {/* AI Prediction Result Box Below Form */}
      <div className="mt-6">
        {analyzing ? (
          <div className="rounded border border-blue-200 bg-blue-50 p-6 text-center animate-pulse">
            <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-[#1E40AF]" />
            <span className="text-xs font-bold text-[#1E40AF]">Processing grievance with NLP Classifier...</span>
          </div>
        ) : prediction ? (
          <div className="rounded border border-blue-300 bg-blue-50 p-5 shadow-sm">
            <h4 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#1E40AF]">
              <Sparkles size={14} /> Automated Routing Prediction
            </h4>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
              The embedded natural language AI classifier has analyzed the description text. The findings are compiled below:
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded border border-slate-200 bg-white p-3">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Predicted Department</span>
                <span className={`mt-1.5 inline-flex rounded border px-2 py-0.5 text-[10px] font-bold ${getCategoryBadgeClass(prediction.category)}`}>
                  {prediction.category}
                </span>
              </div>
              <div className="rounded border border-slate-200 bg-white p-3">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Suggested Severity Priority</span>
                <span className={`mt-1.5 inline-flex rounded border px-2 py-0.5 text-[10px] font-bold ${getPriorityBadgeClass(prediction.priority)}`}>
                  {prediction.priority} Priority
                </span>
              </div>
              <div className="rounded border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <span>Citizen Frustration Score</span>
                  <span className="text-[#1E40AF]">{getFrustrationPercentage(prediction.sentiment_score)}%</span>
                </div>
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded bg-slate-200">
                  <div className="h-full rounded bg-[#1E40AF]" style={{ width: `${getFrustrationPercentage(prediction.sentiment_score)}%` }} />
                </div>
                <span className="mt-1 block text-[8px] text-slate-400">Compound NLP Score: {prediction.sentiment_score.toFixed(3)}</span>
              </div>
            </div>
            <div className="mt-4 flex items-start gap-1.5 border-t border-blue-200 pt-3 text-[10px] text-slate-500 leading-normal">
              <ShieldAlert size={12} className="shrink-0 text-slate-400 mt-0.5" />
              <span>Grievances are auto-assigned to these departments on submission unless overridden. You can change the department in Step 2 above if needed.</span>
            </div>
          </div>
        ) : (
          <div className="rounded border border-slate-200 bg-slate-100 p-5 text-center text-xs text-slate-500">
            <BadgeInfo size={24} className="mx-auto mb-2 text-slate-400" />
            No analysis results available. Fill in the grievance description and click <strong>"Analyze with AI"</strong> to view classification preview.
          </div>
        )}
      </div>
    </div>
  );
}
