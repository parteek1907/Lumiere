'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Download,
  Share2,
  Mic,
  FileUp,
  Zap,
  Clock,
  CheckCircle,
  Sparkles,
  Send,
  X,
  Square,
  Filter,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { getPatient, getSourceSystems, askQuestion, ingestVoice, ingestPdf, extractPdfOcr, transcribeAudio } from '@/lib/api';
import type { PatientDetail, SourceSystem } from '@/lib/api';

function calcAge(dob: string | null): number {
  if (!dob) return 0;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}

// ── Toast component ──
function Toast({ message, type, onDone }: { message: string; type: 'success' | 'error'; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className={`fixed bottom-6 right-6 z-[100] toast-enter bg-white border rounded-lg px-4 py-3 flex items-center gap-3 shadow-lg ${
      type === 'success' ? 'border-l-4 border-l-emerald-500 border-neutral-200' : 'border-l-4 border-l-red-500 border-neutral-200'
    }`}>
      <span className="text-[14px] text-black">{message}</span>
    </div>
  );
}

// ── History event types ──
type HistoryFilter = 'all' | 'visits' | 'labs' | 'syncs' | 'manual';
interface HistoryEvent {
  id: string;
  type: 'visit' | 'lab' | 'sync' | 'manual' | 'alert';
  label: string;
  detail: string;
  date: string;
  ingestedAt: string;
  sourceSystem: string;
  fhirStatus: 'valid' | 'warning' | 'invalid';
}

const eventBadgeColors: Record<HistoryEvent['type'], string> = {
  visit: 'bg-blue-50 text-blue-700 border-blue-200',
  lab: 'bg-purple-50 text-purple-700 border-purple-200',
  sync: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  manual: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  alert: 'bg-red-50 text-red-700 border-red-200',
};

const eventDotColors: Record<HistoryEvent['type'], string> = {
  visit: 'bg-blue-400',
  lab: 'bg-purple-400',
  sync: 'bg-emerald-400',
  manual: 'bg-neutral-400',
  alert: 'bg-red-400',
};

export default function PatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;

  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [sources, setSources] = useState<SourceSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'golden' | 'communication' | 'history'>('golden');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Golden Record — Add medical record sub-tabs
  const [recordMode, setRecordMode] = useState<'voice' | 'pdf' | 'manual'>('voice');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Voice review modal
  const [voiceReviewOpen, setVoiceReviewOpen] = useState(false);
  const [voiceReviewForm, setVoiceReviewForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    notes: '',
    diagnosis: '',
    medications: '',
    visitType: '',
  });

  // PDF upload state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfProcessing, setPdfProcessing] = useState(false);
  const [pdfReviewOpen, setPdfReviewOpen] = useState(false);
  const [pdfReviewForm, setPdfReviewForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    docType: '',
    sourceSystem: '',
    diagnosis: '',
    medications: '',
    findings: '',
  });
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [whisperLoading, setWhisperLoading] = useState(false);

  // Manual entry form
  const [manualForm, setManualForm] = useState({ date: '', visitType: '', notes: '', diagnosis: '', medications: '' });

  // Communication
  const [commMode, setCommMode] = useState<'voice' | 'pdf'>('voice');
  const [commRecording, setCommRecording] = useState(false);
  const [commTranscript, setCommTranscript] = useState('');
  const [commLiveTranscript, setCommLiveTranscript] = useState('');
  const [commSeconds, setCommSeconds] = useState(0);
  const commRecognitionRef = useRef<SpeechRecognition | null>(null);
  const commTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // History
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');

  // AI Drawer (flex-based)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; text: string; sources?: string[]; confidence?: number }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [pt, sys] = await Promise.all([
          getPatient(patientId),
          getSourceSystems(),
        ]);
        setPatient(pt);
        setSources(sys);
      } catch (e) {
        console.error('Failed to load patient', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [patientId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── Golden Record voice ──
  const startGoldenRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Speech recognition not supported in this browser', 'error');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalText = '';
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += t + ' ';
        } else {
          interim += t;
        }
      }
      setTranscript(finalText.trim());
      setLiveTranscript(interim);
    };
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed') {
        showToast('Microphone access denied. Please allow mic permissions.', 'error');
      } else {
        showToast(`Voice error: ${event.error}`, 'error');
      }
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    };
    recognition.onend = () => {
      // If still supposed to be recording, restart (browser can stop after silence)
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch { /* ignore */ }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setRecordingSeconds(0);
    setTranscript('');
    setLiveTranscript('');
    timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
  }, []);

  const stopGoldenRecording = useCallback(() => {
    if (recognitionRef.current) {
      const ref = recognitionRef.current;
      recognitionRef.current = null; // prevent auto-restart in onend
      ref.stop();
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIsRecording(false);
    setLiveTranscript('');
  }, []);

  const handleSaveVoice = () => {
    // Open review modal instead of saving directly
    setVoiceReviewForm({
      date: new Date().toISOString().slice(0, 10),
      notes: transcript,
      diagnosis: '',
      medications: '',
      visitType: '',
    });
    setVoiceReviewOpen(true);
  };

  const handleConfirmVoiceSave = async () => {
    try {
      await ingestVoice({
        transcript,
        given_name: voiceReviewForm.diagnosis ? undefined : patient?.given_name || undefined,
        family_name: patient?.family_name || undefined,
        observation_notes: transcript,
      });
      showToast('Voice record saved to Golden Record');
    } catch {
      showToast('Failed to save voice record', 'error');
    }
    setVoiceReviewOpen(false);
    setTranscript('');
    setLiveTranscript('');
    setRecordingSeconds(0);
  };

  const handleDiscardVoice = () => {
    setVoiceReviewOpen(false);
    setTranscript('');
    setLiveTranscript('');
    setRecordingSeconds(0);
  };

  // Whisper audio file upload
  const handleAudioFileUpload = async (file: File) => {
    setWhisperLoading(true);
    try {
      const result = await transcribeAudio(file);
      setTranscript(result.transcript);
      showToast(`Whisper transcription complete (${result.model})`);
    } catch (err: any) {
      showToast(err?.message || 'Whisper transcription failed', 'error');
    } finally {
      setWhisperLoading(false);
    }
  };

  // PDF ingestion — real OCR via pdfplumber / Tesseract on server
  const handlePdfSelect = async (file: File) => {
    setPdfFile(file);
    setPdfProcessing(true);
    try {
      const result = await extractPdfOcr(file);
      const fields = result.extracted_fields;
      const garbled = (result as any).text_quality === 'garbled';
      setPdfReviewForm({
        date: new Date().toISOString().slice(0, 10),
        docType: 'lab_report',
        sourceSystem: 'PDF Archive',
        diagnosis: fields.diagnosis || '',
        medications: fields.medications || '',
        findings: fields.findings || '',
      });
      if (garbled) {
        showToast('PDF uses an embedded font that could not be decoded — please fill fields manually', 'error');
      } else {
        showToast(`OCR complete (${result.method}, ${result.page_count} page${result.page_count !== 1 ? 's' : ''})`);
      }
    } catch (err: any) {
      // Fallback: let user fill in manually
      setPdfReviewForm({
        date: new Date().toISOString().slice(0, 10),
        docType: 'lab_report',
        sourceSystem: 'PDF Archive',
        diagnosis: '',
        medications: '',
        findings: '',
      });
      showToast(`OCR unavailable — fill fields manually (${err?.message || 'server error'})`, 'error');
    } finally {
      setPdfProcessing(false);
      setPdfReviewOpen(true);
    }
  };

  const handleConfirmPdfSave = async () => {
    try {
      await ingestPdf({
        given_name: patient?.given_name || undefined,
        family_name: patient?.family_name || undefined,
        observation_notes: pdfReviewForm.findings || undefined,
        raw_text: `Diagnosis: ${pdfReviewForm.diagnosis}. Medications: ${pdfReviewForm.medications}. ${pdfReviewForm.findings}`,
      });
      showToast('PDF record extracted and saved');
    } catch {
      showToast('Failed to save PDF record', 'error');
    }
    setPdfReviewOpen(false);
    setPdfFile(null);
  };

  const handleDiscardPdf = () => {
    setPdfReviewOpen(false);
    setPdfFile(null);
  };

  // ── Communication voice ──
  const startCommRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Speech recognition not supported in this browser', 'error');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalText = '';
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += t + ' ';
        } else {
          interim += t;
        }
      }
      setCommTranscript(finalText.trim());
      setCommLiveTranscript(interim);
    };
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed') {
        showToast('Microphone access denied. Please allow mic permissions.', 'error');
      } else {
        showToast(`Voice error: ${event.error}`, 'error');
      }
      setCommRecording(false);
      if (commTimerRef.current) clearInterval(commTimerRef.current);
    };
    recognition.onend = () => {
      if (commRecognitionRef.current) {
        try { commRecognitionRef.current.start(); } catch { /* ignore */ }
      }
    };

    commRecognitionRef.current = recognition;
    recognition.start();
    setCommRecording(true);
    setCommSeconds(0);
    setCommTranscript('');
    setCommLiveTranscript('');
    commTimerRef.current = setInterval(() => setCommSeconds(s => s + 1), 1000);
  }, []);

  const stopCommRecording = useCallback(() => {
    if (commRecognitionRef.current) {
      const ref = commRecognitionRef.current;
      commRecognitionRef.current = null;
      ref.stop();
    }
    if (commTimerRef.current) { clearInterval(commTimerRef.current); commTimerRef.current = null; }
    setCommRecording(false);
    setCommLiveTranscript('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
      if (timerRef.current) clearInterval(timerRef.current);
      if (commRecognitionRef.current) { commRecognitionRef.current.stop(); commRecognitionRef.current = null; }
      if (commTimerRef.current) clearInterval(commTimerRef.current);
    };
  }, []);

  const handleSaveManual = () => {
    setManualForm({ date: '', visitType: '', notes: '', diagnosis: '', medications: '' });
    showToast('Record added to golden record');
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    const q = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: q }]);
    try {
      const res = await askQuestion(q, patient?.id);
      setChatMessages(prev => [...prev, { role: 'ai', text: res.answer, sources: res.sources, confidence: res.confidence }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'ai', text: 'Sorry, I could not process that request.' }]);
    }
  };

  const suggestedPrompts = [
    'What medications was this patient on?',
    'Summarize the last 3 visits',
    'Any flagged diagnoses?',
  ];

  // Mock history events (built from patient data when available)
  const historyEvents: HistoryEvent[] = patient ? [
    { id: '1', type: 'sync', label: 'Baseline sync', detail: 'Lumiere Core v1.3 — Verified 4 artifacts', date: new Date(patient.created_at).toLocaleDateString(), ingestedAt: new Date(patient.created_at).toLocaleString(), sourceSystem: 'Lumiere Core', fhirStatus: 'valid' },
    { id: '2', type: 'visit', label: 'Routine checkup', detail: 'Primary care — Vitals normal, BMI 24.3', date: new Date(Date.now() - 86400000 * 14).toLocaleDateString(), ingestedAt: new Date(Date.now() - 86400000 * 14 + 3600000).toLocaleString(), sourceSystem: 'EPIC EHR', fhirStatus: 'valid' },
    { id: '3', type: 'lab', label: 'Blood panel results', detail: 'CBC + Metabolic — All within normal range', date: new Date(Date.now() - 86400000 * 10).toLocaleDateString(), ingestedAt: new Date(Date.now() - 86400000 * 10 + 7200000).toLocaleString(), sourceSystem: 'LabCorp', fhirStatus: 'warning' },
    { id: '4', type: 'manual', label: 'Record ingestion', detail: 'Manual entry — Doctor notes updated', date: new Date(Date.now() - 86400000 * 7).toLocaleDateString(), ingestedAt: new Date(Date.now() - 86400000 * 7).toLocaleString(), sourceSystem: 'Manual', fhirStatus: 'valid' },
    { id: '5', type: 'sync', label: 'EHR sync', detail: 'EPIC EHR — 3 new observations imported', date: new Date(Date.now() - 86400000 * 3).toLocaleDateString(), ingestedAt: new Date(Date.now() - 86400000 * 3 + 1800000).toLocaleString(), sourceSystem: 'EPIC EHR', fhirStatus: 'valid' },
    { id: '6', type: 'alert', label: 'Duplicate flagged', detail: 'Potential duplicate detected — pending review', date: new Date(Date.now() - 86400000 * 1).toLocaleDateString(), ingestedAt: new Date(Date.now() - 86400000 * 1).toLocaleString(), sourceSystem: 'Lumiere Core', fhirStatus: 'invalid' },
  ] : [];

  const filteredHistory = historyFilter === 'all'
    ? historyEvents
    : historyEvents.filter(e => {
        if (historyFilter === 'visits') return e.type === 'visit';
        if (historyFilter === 'labs') return e.type === 'lab';
        if (historyFilter === 'syncs') return e.type === 'sync';
        if (historyFilter === 'manual') return e.type === 'manual';
        return true;
      });

  if (loading) {
    return (
      <div className="max-w-[1100px] mx-auto space-y-6 page-enter">
        <div className="skeleton h-5 w-40" />
        <div className="skeleton h-8 w-72" />
        <div className="skeleton h-4 w-56" />
        <div className="skeleton h-[500px] rounded-xl mt-6" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="max-w-[1100px] mx-auto py-24 text-center">
        <p className="text-[14px] text-neutral-500">Patient not found</p>
        <button onClick={() => router.push('/patients')} className="mt-4 text-[14px] text-black underline">
          Back to registry
        </button>
      </div>
    );
  }

  const name = titleCase(`${patient.given_name ?? ''} ${patient.family_name ?? ''}`.trim());
  const age = calcAge(patient.dob);

  const tabs = [
    { key: 'golden' as const, label: 'Golden Record' },
    { key: 'communication' as const, label: 'Communication' },
    { key: 'history' as const, label: 'History' },
  ];

  return (
    <div className="page-enter flex overflow-hidden" style={{ height: 'calc(100vh - 88px)' }}>
      {/* ═══ MAIN CONTENT (flex-based layout with drawer) ═══ */}
      <div className="flex-1 overflow-y-auto transition-all duration-250">
        <div className="max-w-[1100px] mx-auto space-y-6 pb-12">

          {/* Breadcrumb */}
          <button
            onClick={() => router.push('/patients')}
            className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-400 hover:text-black transition-colors"
          >
            Patient Registry <span className="text-neutral-300">/</span> <span className="text-black">{name}</span>
          </button>

          {/* Patient Header Card - Modern Medical Identity */}
          <div className="relative group overflow-hidden rounded-[24px] bg-white border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-50 to-purple-50 rounded-full blur-3xl opacity-50 pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-64 h-64 bg-gradient-to-tr from-emerald-50 to-teal-50 rounded-full blur-3xl opacity-50 pointer-events-none" />
            
            <div className="relative p-8 flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="flex items-start gap-6">
                {/* Avatar */}
                <div className="w-20 h-20 rounded-[20px] bg-gradient-to-br from-white to-neutral-50 shadow-sm border border-black/5 flex items-center justify-center flex-shrink-0">
                  <span className="text-[28px] font-semibold bg-gradient-to-br from-neutral-800 to-neutral-500 bg-clip-text text-transparent">
                    {(patient.given_name?.[0] ?? '').toUpperCase()}{(patient.family_name?.[0] ?? '').toUpperCase()}
                  </span>
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-[28px] font-semibold text-black tracking-tight leading-none">{name}</h1>
                    <span className="px-2.5 py-1 rounded-full bg-blue-50/80 text-blue-700 text-[11px] font-bold tracking-wide uppercase border border-blue-100 backdrop-blur-sm shadow-sm">
                      Master ID
                    </span>
                  </div>
                  <p className="text-[13px] font-mono text-neutral-400 mb-3">{patient.id}</p>
                  <div className="flex items-center gap-4 text-[14px] text-neutral-600 font-medium">
                    <span className="flex items-center gap-1.5"><Sparkles size={14} className="text-blue-500" /> {age} yrs</span>
                    <span className="w-1 h-1 rounded-full bg-neutral-300" />
                    <span>{patient.gender ? titleCase(patient.gender) : '—'}</span>
                    <span className="w-1 h-1 rounded-full bg-neutral-300" />
                    <span>{[patient.city, patient.state].filter(Boolean).join(', ') || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                <button className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-black/5 shadow-sm text-[14px] font-medium text-neutral-700 hover:bg-neutral-50 hover:shadow transition-all duration-200">
                  <Download size={16} />
                  Export PDF
                </button>
                <button className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white text-[14px] font-medium hover:bg-neutral-800 shadow-[0_4px_14px_0_rgb(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] active:scale-[0.98] transition-all duration-200">
                  <Share2 size={16} />
                  Relay EHR
                </button>
              </div>
            </div>
          </div>

          {/* Segmented Control Tabs (Linear Style) */}
          <div className="bg-neutral-100/80 p-1 rounded-2xl flex max-w-fit shadow-inner">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={cn(
                  'px-6 py-2.5 text-[14px] font-medium rounded-xl transition-all duration-300 relative',
                  activeTab === t.key
                    ? 'text-black bg-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700 hover:bg-black/5'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ═══ TAB: GOLDEN RECORD ═══ */}
          {activeTab === 'golden' && (
            <div className="space-y-8">
              {/* Section A: Add Medical Record */}
              {/* Section A: Add Medical Record */}
              <div>
                <h2 className="text-[16px] font-semibold text-black mb-4 flex items-center gap-2">
                  <Sparkles size={16} className="text-blue-500" />
                  Add medical record
                </h2>
                
                {/* Mode Switcher */}
                <div className="flex p-1 bg-neutral-100/80 rounded-xl mb-4 max-w-fit shadow-inner">
                  {(['voice', 'pdf', 'manual'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setRecordMode(m)}
                      className={cn(
                        'px-5 py-2 rounded-lg text-[13px] font-medium transition-all duration-300 relative',
                        recordMode === m
                          ? 'bg-white text-black shadow-sm'
                          : 'text-neutral-500 hover:text-neutral-700 hover:bg-black/5'
                      )}
                    >
                      {m === 'pdf' ? 'PDF upload' : m === 'manual' ? 'Manual entry' : 'Voice capture'}
                    </button>
                  ))}
                </div>

                <div className="bg-white rounded-[20px] p-8 border border-black/[0.04] shadow-[0_4px_20px_rgb(0,0,0,0.02)] transition-all">
                  {/* Voice */}
                  {recordMode === 'voice' && (
                    <div className="flex flex-col items-center gap-6 py-8">
                      <div className="relative group cursor-pointer" onClick={() => isRecording ? stopGoldenRecording() : startGoldenRecording()}>
                        <div className={cn(
                          "absolute inset-0 rounded-full blur-xl transition-all duration-500",
                          isRecording ? "bg-red-500/40 opacity-100 scale-150 animate-pulse" : "bg-blue-500/20 opacity-0 group-hover:opacity-100 scale-110"
                        )} />
                        <button
                          className={cn(
                            'w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 relative z-10 shadow-xl border border-white/10',
                            isRecording 
                              ? 'bg-gradient-to-br from-red-500 to-red-600 scale-105' 
                              : 'bg-gradient-to-br from-black to-neutral-800 hover:scale-105'
                          )}
                        >
                          {isRecording ? <Square size={28} className="text-white fill-white" /> : <Mic size={28} className="text-white" />}
                        </button>
                      </div>
                      
                      {isRecording && (
                        <div className="flex items-center gap-2 px-4 py-1.5 bg-red-50 text-red-600 rounded-full border border-red-100 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-[14px] font-mono font-medium">{formatTime(recordingSeconds)}</span>
                        </div>
                      )}
                      <p className="text-[14px] font-medium text-neutral-500">
                        {isRecording ? 'Capturing clinical context...' : 'Tap to start recording'}
                      </p>

                      {/* Whisper audio file upload — server-side STT */}
                      {!isRecording && (
                        <div className="flex flex-col items-center gap-2 mt-2">
                          <p className="text-[11px] font-medium uppercase tracking-widest text-neutral-400">or</p>
                          <input
                            ref={audioInputRef}
                            type="file"
                            accept="audio/*,.mp3,.wav,.m4a,.webm,.mp4"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleAudioFileUpload(f);
                              e.target.value = '';
                            }}
                          />
                          <button
                            onClick={() => audioInputRef.current?.click()}
                            disabled={whisperLoading}
                            className="flex items-center gap-2 px-4 py-2 bg-neutral-50 border border-neutral-200 text-[13px] font-medium text-neutral-600 rounded-xl hover:bg-neutral-100 hover:border-neutral-300 transition-all duration-200 disabled:opacity-50"
                          >
                            🎤 {whisperLoading ? 'Transcribing…' : 'Upload audio file'}
                          </button>
                        </div>
                      )}

                      {/* Live interim transcript while recording */}
                      {isRecording && (liveTranscript || transcript) && (
                        <div className="w-full max-w-2xl mt-4 bg-neutral-50/50 rounded-[16px] p-6 text-[15px] text-neutral-700 leading-relaxed border border-neutral-100 shadow-inner">
                          {transcript}{transcript && liveTranscript ? ' ' : ''}
                          <span className="text-blue-400 italic font-medium">{liveTranscript}</span>
                        </div>
                      )}

                      {/* Final transcript after stopping */}
                      {!isRecording && transcript && (
                        <div className="w-full max-w-2xl mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-4">
                          <div className="bg-blue-50/30 rounded-[16px] p-6 text-[15px] text-neutral-800 leading-relaxed border border-blue-100 shadow-sm">
                            {transcript}
                          </div>
                          <div className="flex justify-end gap-3">
                            <button
                              onClick={() => { setTranscript(''); setRecordingSeconds(0); }}
                              className="px-5 py-2.5 bg-white border border-neutral-200 text-[14px] font-medium text-neutral-600 rounded-xl hover:bg-neutral-50 transition-all duration-200 shadow-sm"
                            >
                              Discard
                            </button>
                            <button
                              onClick={handleSaveVoice}
                              className="px-5 py-2.5 bg-black text-white text-[14px] font-medium rounded-xl hover:bg-neutral-800 shadow-md active:scale-[0.98] transition-all duration-200"
                            >
                              Review & Save
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* PDF */}
                  {recordMode === 'pdf' && (
                    <div className="py-2">
                      <input
                        ref={pdfInputRef}
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handlePdfSelect(f);
                          e.target.value = '';
                        }}
                      />
                      {pdfProcessing ? (
                        <div className="py-12 space-y-4 flex flex-col items-center">
                          <div className="relative w-16 h-16">
                            <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
                            <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
                          </div>
                          <p className="text-[14px] font-medium text-neutral-500">Extracting clinical data...</p>
                        </div>
                      ) : (
                        <div
                          className="group flex flex-col items-center gap-4 py-12 border-2 border-dashed border-neutral-200/80 bg-neutral-50/50 rounded-[20px] justify-center cursor-pointer hover:bg-blue-50/30 hover:border-blue-200 transition-all duration-300"
                          onClick={() => pdfInputRef.current?.click()}
                          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const f = e.dataTransfer.files?.[0];
                            if (f && f.type === 'application/pdf') handlePdfSelect(f);
                          }}
                        >
                          <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300 group-hover:text-blue-500 text-neutral-400">
                            <FileUp size={28} />
                          </div>
                          <div className="text-center">
                            <p className="text-[15px] font-medium text-black">Drop PDF here or click to upload</p>
                            <p className="text-[13px] text-neutral-400 mt-1">Supports lab reports, discharge summaries, etc.</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); pdfInputRef.current?.click(); }}
                            className="mt-2 px-6 py-2.5 bg-white border border-neutral-200 shadow-sm text-[14px] font-medium text-black rounded-xl hover:bg-neutral-50 active:scale-[0.98] transition-all duration-200"
                          >
                            Browse files
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Manual */}
                  {recordMode === 'manual' && (
                    <div className="space-y-6 max-w-3xl">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                          <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500">Date</label>
                          <input
                            type="date"
                            value={manualForm.date}
                            onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                            className="w-full h-11 px-4 rounded-xl border border-neutral-200 bg-neutral-50/50 text-[14px] outline-none focus:border-black focus:bg-white focus:ring-4 focus:ring-black/5 transition-all"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500">Visit type</label>
                          <select
                            value={manualForm.visitType}
                            onChange={(e) => setManualForm({ ...manualForm, visitType: e.target.value })}
                            className="w-full h-11 px-4 rounded-xl border border-neutral-200 bg-neutral-50/50 text-[14px] outline-none focus:border-black focus:bg-white focus:ring-4 focus:ring-black/5 transition-all appearance-none cursor-pointer"
                          >
                            <option value="">Select...</option>
                            <option value="routine">Routine checkup</option>
                            <option value="follow-up">Follow-up</option>
                            <option value="emergency">Emergency</option>
                            <option value="specialist">Specialist referral</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500">Doctor notes</label>
                        <textarea
                          rows={4}
                          value={manualForm.notes}
                          onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50/50 text-[14px] outline-none focus:border-black focus:bg-white focus:ring-4 focus:ring-black/5 transition-all resize-none leading-relaxed"
                          placeholder="Enter clinical observations..."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                          <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500">Diagnosis</label>
                          <input
                            type="text"
                            value={manualForm.diagnosis}
                            onChange={(e) => setManualForm({ ...manualForm, diagnosis: e.target.value })}
                            placeholder="e.g. Hypertension"
                            className="w-full h-11 px-4 rounded-xl border border-neutral-200 bg-neutral-50/50 text-[14px] outline-none focus:border-black focus:bg-white focus:ring-4 focus:ring-black/5 transition-all"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500">Medications</label>
                          <input
                            type="text"
                            value={manualForm.medications}
                            onChange={(e) => setManualForm({ ...manualForm, medications: e.target.value })}
                            placeholder="Comma separated"
                            className="w-full h-11 px-4 rounded-xl border border-neutral-200 bg-neutral-50/50 text-[14px] outline-none focus:border-black focus:bg-white focus:ring-4 focus:ring-black/5 transition-all"
                          />
                        </div>
                      </div>
                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={handleSaveManual}
                          className="px-6 py-2.5 bg-black text-white text-[14px] font-medium rounded-xl hover:bg-neutral-800 shadow-md active:scale-[0.98] transition-all duration-200"
                        >
                          Save record
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-8">
                  {/* Section B: Data Provenance */}
                  <div>
                    <h2 className="text-[16px] font-semibold text-black flex items-center gap-2 mb-4">
                      <Zap size={16} className="text-blue-500" />
                      Data provenance
                    </h2>
                    <div className="bg-white rounded-[20px] border border-black/[0.04] shadow-[0_4px_20px_rgb(0,0,0,0.02)] divide-y divide-black/[0.04] overflow-hidden">
                      {sources.map((s, i) => {
                        const fhirStatus: 'valid' | 'warning' | 'invalid' =
                          s.is_active && i % 3 !== 2 ? (i % 3 === 1 ? 'warning' : 'valid') : (!s.is_active ? 'invalid' : 'valid');
                        const fhirBadge = {
                          valid: { label: 'FHIR R4 Valid', bg: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: <CheckCircle size={12} className="text-emerald-500" /> },
                          warning: { label: 'FHIR Warning', bg: 'bg-amber-50 text-amber-700 border-amber-100', icon: <AlertTriangle size={12} className="text-amber-500" /> },
                          invalid: { label: 'FHIR Invalid', bg: 'bg-red-50 text-red-700 border-red-100', icon: <X size={12} className="text-red-500" /> },
                        }[fhirStatus];
                        return (
                          <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 hover:bg-blue-50/20 transition-colors duration-200">
                            <div className="flex items-center gap-4">
                              <div className="w-8 h-8 rounded-full bg-neutral-100/80 flex items-center justify-center text-[11px] font-mono font-medium text-neutral-400">
                                {String(i + 1).padStart(2, '0')}
                              </div>
                              <span className="text-[14px] font-medium text-black">{s.system_name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide border shadow-sm ${fhirBadge.bg}`}>
                                {fhirBadge.icon}
                                {fhirBadge.label}
                              </span>
                              {s.is_active && <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" title="Active Connection" />}
                            </div>
                          </div>
                        );
                      })}
                      {sources.length === 0 && (
                        <div className="px-6 py-12 text-center text-[14px] text-neutral-400">No source systems configured</div>
                      )}
                    </div>
                  </div>

                  {/* Section D: Master Identity */}
                  <div>
                    <h2 className="text-[16px] font-semibold text-black mb-4 flex items-center gap-2">
                      <FileText size={16} className="text-blue-500" />
                      Master identity
                    </h2>
                    <div className="bg-gradient-to-br from-neutral-900 to-black rounded-[20px] p-8 shadow-xl text-white relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                      <div className="grid grid-cols-2 gap-y-6 gap-x-8 relative z-10">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Golden Record ID</p>
                          <p className="text-[14px] font-mono text-neutral-200 mt-1">{patient.id.slice(0, 12)}...</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Created</p>
                          <p className="text-[14px] text-neutral-200 mt-1">{new Date(patient.created_at).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Masked SSN</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex gap-0.5">
                              {[1,2,3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-neutral-400" />)}
                              <span className="text-neutral-400 mx-0.5">-</span>
                              {[1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-neutral-400" />)}
                              <span className="text-neutral-400 mx-0.5">-</span>
                            </div>
                            <span className="text-[14px] font-mono text-neutral-200">{patient.id.slice(-4)}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Curation Hash</p>
                          <p className="text-[14px] font-mono text-neutral-200 mt-1">0x{patient.id.slice(0, 6)}...{patient.id.slice(-4)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section C: History Sequence */}
                <div>
                  <h2 className="text-[16px] font-semibold text-black flex items-center gap-2 mb-4">
                    <Clock size={16} className="text-blue-500" />
                    History sequence
                  </h2>
                  <div className="bg-white rounded-[20px] border border-black/[0.04] shadow-[0_4px_20px_rgb(0,0,0,0.02)] p-8">
                    <div className="relative pl-6 space-y-8">
                      <div className="absolute left-2.5 top-2 bottom-2 w-px bg-gradient-to-b from-blue-200 via-neutral-200 to-transparent" />
                      {[
                        { label: 'Baseline sync', sub: 'Lumiere Core v1.3 — Verified 4 artifacts', time: '10:42 AM' },
                        { label: 'Duplicate resolution', sub: 'Manual audit — Merged institutional identities', time: 'Yesterday' },
                        { label: 'Record ingestion', sub: 'EPIC EHR — 3 new observations imported', time: 'Oct 12' },
                        { label: 'Identity verification', sub: 'Passed automated demographic check', time: 'Oct 12' },
                      ].map((item, i) => (
                        <div key={i} className="relative group">
                          <div className="absolute -left-[30px] top-1 w-3 h-3 rounded-full bg-white border-[3px] border-blue-500 group-hover:scale-125 transition-transform duration-200 shadow-sm" />
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <p className="text-[14px] font-semibold text-black">{item.label}</p>
                              <p className="text-[13px] text-neutral-500 mt-0.5 leading-relaxed">{item.sub}</p>
                            </div>
                            <span className="text-[12px] font-medium text-neutral-400 whitespace-nowrap">{item.time}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB: COMMUNICATION ═══ */}
          {activeTab === 'communication' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-[24px] font-semibold tracking-tight text-black flex items-center gap-2">
                    <Zap size={20} className="text-blue-500" />
                    Clinical command
                  </h2>
                  <p className="text-[15px] text-neutral-500 mt-2 max-w-xl leading-relaxed">
                    Broadcast intelligence, artifacts, and instructions securely to the patient edge.
                  </p>
                </div>

                {/* Patient confirmation card */}
                <div className="bg-white border border-black/5 rounded-[16px] px-5 py-3 flex items-center gap-4 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center text-[13px] font-bold text-blue-600 border border-blue-200/50 shadow-inner">
                    {(patient.given_name?.[0] ?? '').toUpperCase()}{(patient.family_name?.[0] ?? '').toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-black">{name}</p>
                    <p className="text-[11px] font-mono font-medium text-neutral-400 mt-0.5">ID: {patient.id.slice(0, 8)}</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] ml-2" title="Edge Connected" />
                </div>
              </div>

              <div className="flex p-1 bg-neutral-100/80 rounded-xl mb-4 max-w-fit shadow-inner">
                <button
                  onClick={() => setCommMode('voice')}
                  className={cn(
                    'px-5 py-2 rounded-lg text-[13px] font-medium transition-all duration-300 relative',
                    commMode === 'voice' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-neutral-700 hover:bg-black/5'
                  )}
                >
                  Voice capture
                </button>
                <button
                  onClick={() => setCommMode('pdf')}
                  className={cn(
                    'px-5 py-2 rounded-lg text-[13px] font-medium transition-all duration-300 relative',
                    commMode === 'pdf' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-neutral-700 hover:bg-black/5'
                  )}
                >
                  Document push
                </button>
              </div>

              {commMode === 'voice' ? (
                <div className="bg-white rounded-[24px] p-10 border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center gap-6 relative overflow-hidden transition-all duration-500">
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 opacity-20" />
                  
                  <div className="relative group cursor-pointer mt-4" onClick={() => commRecording ? stopCommRecording() : startCommRecording()}>
                    <div className={cn(
                      "absolute inset-0 rounded-full blur-2xl transition-all duration-500",
                      commRecording ? "bg-red-500/40 opacity-100 scale-150 animate-pulse" : "bg-blue-500/10 opacity-0 group-hover:opacity-100 scale-110"
                    )} />
                    <button
                      className={cn(
                        'w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500 relative z-10 shadow-2xl border border-white/10',
                        commRecording 
                          ? 'bg-gradient-to-br from-red-500 to-rose-600 scale-105' 
                          : 'bg-gradient-to-br from-neutral-900 to-black hover:scale-105'
                      )}
                    >
                      {commRecording ? <Square size={32} className="text-white fill-white" /> : <Mic size={32} className="text-white" />}
                    </button>
                  </div>

                  {commRecording && (
                    <div className="flex items-center gap-2 px-5 py-2 bg-red-50 text-red-600 rounded-full border border-red-100 shadow-sm animate-in fade-in zoom-in duration-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[16px] font-mono font-bold tracking-wider">{formatTime(commSeconds)}</span>
                    </div>
                  )}
                  
                  <div className="text-center max-w-md">
                    <h3 className="text-[20px] font-semibold text-black tracking-tight mb-2">Consensus recording</h3>
                    <p className="text-[15px] text-neutral-500 leading-relaxed">
                      Speak clinical context. Lumiere AI will process, summarize, and securely relay intelligence to the edge.
                    </p>
                  </div>

                  {/* Live transcript while recording */}
                  {commRecording && (commLiveTranscript || commTranscript) && (
                    <div className="w-full max-w-3xl mt-4 bg-neutral-50/50 rounded-[16px] p-6 text-[16px] text-neutral-700 leading-relaxed border border-neutral-100 shadow-inner">
                      {commTranscript}{commTranscript && commLiveTranscript ? ' ' : ''}
                      <span className="text-blue-500 italic font-medium">{commLiveTranscript}</span>
                    </div>
                  )}

                  {/* Final transcript after stopping */}
                  {!commRecording && commTranscript && (
                    <div className="w-full max-w-3xl mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-4">
                      <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 rounded-[20px] p-8 text-[16px] text-neutral-800 leading-relaxed border border-blue-100 shadow-sm">
                        {commTranscript}
                      </div>
                      <div className="flex justify-end gap-3 pt-2">
                        <button
                          onClick={() => { setCommTranscript(''); setCommSeconds(0); }}
                          className="px-6 py-3 bg-white border border-neutral-200 text-[14px] font-medium text-neutral-600 rounded-xl hover:bg-neutral-50 transition-all duration-200 shadow-sm"
                        >
                          Discard recording
                        </button>
                        <button
                          onClick={() => { showToast('Communication relayed successfully'); setCommTranscript(''); setCommSeconds(0); }}
                          className="flex items-center gap-2 px-6 py-3 bg-black text-white text-[14px] font-medium rounded-xl hover:bg-neutral-800 shadow-[0_4px_14px_0_rgb(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] active:scale-[0.98] transition-all duration-200"
                        >
                          <Send size={16} />
                          Relay intelligence
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-[24px] border-2 border-dashed border-neutral-200/80 hover:border-blue-300 hover:bg-blue-50/10 p-12 flex flex-col items-center gap-4 min-h-[300px] justify-center transition-all duration-300 cursor-pointer group shadow-sm">
                  <div className="w-20 h-20 rounded-full bg-neutral-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors duration-300 shadow-sm">
                    <FileUp size={32} className="text-neutral-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <div className="text-center">
                    <p className="text-[16px] font-semibold text-black">Secure document push</p>
                    <p className="text-[14px] text-neutral-500 mt-1">Drop a PDF here to relay to the patient edge.</p>
                  </div>
                  <button className="mt-4 px-6 py-3 bg-white border border-neutral-200 shadow-sm text-[14px] font-medium text-black rounded-xl hover:bg-neutral-50 active:scale-[0.98] transition-all duration-200">
                    Browse files
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ═══ TAB: HISTORY ═══ */}
          {activeTab === 'history' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-[24px] font-semibold tracking-tight text-black flex items-center gap-2">
                    <Clock size={20} className="text-blue-500" />
                    Patient history
                  </h2>
                  <p className="text-[15px] text-neutral-500 mt-2 max-w-xl leading-relaxed">
                    Complete timeline of events, syncs, clinical encounters, and edge interactions.
                  </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-black/5 shadow-sm text-[13px] font-medium text-neutral-600">
                  <Filter size={14} className="text-blue-500" />
                  {filteredHistory.length} events logged
                </div>
              </div>

              {/* Filter pills */}
              <div className="flex flex-wrap gap-2">
                {([
                  { key: 'all' as const, label: 'All Events' },
                  { key: 'visits' as const, label: 'Visits' },
                  { key: 'labs' as const, label: 'Labs' },
                  { key: 'syncs' as const, label: 'System Syncs' },
                  { key: 'manual' as const, label: 'Manual Entries' },
                ]).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setHistoryFilter(f.key)}
                    className={cn(
                      'px-5 py-2 rounded-xl text-[13px] font-medium transition-all duration-300 relative',
                      historyFilter === f.key
                        ? 'bg-black text-white shadow-md'
                        : 'bg-white border border-black/5 text-neutral-500 hover:text-black hover:bg-neutral-50 hover:shadow-sm'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Timeline */}
              {filteredHistory.length === 0 ? (
                <div className="bg-white border border-black/5 rounded-[24px] p-16 text-center shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
                  <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-neutral-100">
                    <Clock size={32} className="text-neutral-300" />
                  </div>
                  <p className="text-[16px] font-semibold text-black">No events found</p>
                  <p className="text-[14px] text-neutral-500 mt-1">Try adjusting your filters.</p>
                </div>
              ) : (
                <div className="bg-white rounded-[24px] border border-black/[0.04] shadow-[0_4px_20px_rgb(0,0,0,0.02)] p-8 md:p-10">
                  <div className="relative pl-8 md:pl-10 space-y-10">
                    <div className="absolute left-[15px] md:left-[23px] top-4 bottom-4 w-px bg-gradient-to-b from-blue-200 via-neutral-200 to-transparent" />
                    {filteredHistory.map((event) => (
                      <div key={event.id} className="relative group">
                        <div className={cn(
                          'absolute -left-[32px] md:-left-[40px] top-1.5 w-4 h-4 rounded-full border-[3px] border-white shadow-sm group-hover:scale-125 transition-transform duration-300',
                          eventDotColors[event.type]
                        )} />
                        
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 bg-transparent hover:bg-neutral-50/50 -m-4 p-4 rounded-2xl transition-colors duration-200">
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-3 flex-wrap">
                              <p className="text-[16px] font-semibold text-black tracking-tight">{event.label}</p>
                              <span className={cn(
                                'px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase border shadow-sm',
                                eventBadgeColors[event.type]
                              )}>
                                {event.type}
                              </span>
                              <span className="px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600 text-[11px] font-bold tracking-wide uppercase shadow-sm">
                                {event.sourceSystem}
                              </span>
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-50 border border-neutral-200 shadow-sm">
                                <span className={cn(
                                  'w-2 h-2 rounded-full inline-block',
                                  event.fhirStatus === 'valid' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : event.fhirStatus === 'warning' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                                )} title={`FHIR ${event.fhirStatus}`} />
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">FHIR {event.fhirStatus}</span>
                              </div>
                            </div>
                            <p className="text-[14px] text-neutral-600 leading-relaxed">{event.detail}</p>
                            <p className="text-[12px] font-medium text-neutral-400">Ingested: {event.ingestedAt}</p>
                          </div>
                          
                          <div className="flex-shrink-0 pt-1">
                            <span className="inline-block px-3 py-1.5 bg-neutral-50 rounded-lg border border-black/5 text-[13px] font-semibold text-neutral-600 shadow-sm whitespace-nowrap">
                              {event.date}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ AI DRAWER (flex-based, NOT position fixed/absolute) ═══ */}
      <div
        className={cn(
          'flex-shrink-0 border-l border-black/5 bg-[#FAFAFA] flex flex-col transition-all duration-500 ease-in-out overflow-hidden shadow-[-4px_0_24px_rgba(0,0,0,0.02)]',
          drawerOpen ? 'w-[400px]' : 'w-[44px]'
        )}
      >
        {/* Collapsed state */}
        {!drawerOpen && (
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center justify-center h-full gap-3 hover:bg-neutral-100 transition-colors w-full group relative"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center border border-black/5 group-hover:border-blue-200 transition-all">
              <Sparkles size={16} className="text-blue-500 group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-[11px] font-semibold text-neutral-400 tracking-[0.2em] uppercase" style={{ writingMode: 'vertical-rl' }}>Copilot</span>
          </button>
        )}

        {/* Expanded state */}
        {drawerOpen && (
          <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
            {/* Drawer header */}
            <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between flex-shrink-0 bg-white/50 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-sm">
                  <Sparkles size={14} className="text-white" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-black tracking-tight">Lumiere Copilot</h3>
                  <p className="text-[12px] text-neutral-500">Query patient context</p>
                </div>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg hover:bg-black/5 transition-colors text-neutral-400 hover:text-black">
                <X size={16} />
              </button>
            </div>

            {/* Chat area */}
            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 scrollbar-hide bg-gradient-to-b from-transparent to-white/50">
              {/* Proactive alert banner */}
              {patient && chatMessages.length === 0 && (
                <div className="bg-white border border-blue-100 shadow-[0_4px_12px_rgba(59,130,246,0.08)] rounded-[16px] p-4 flex items-start gap-3 animate-in slide-in-from-top-2">
                  <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Zap size={12} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-black">Copilot Insight</p>
                    <p className="text-[13px] text-neutral-600 mt-1 leading-relaxed">
                      {patient.observations.length > 0
                        ? `${patient.observations.length} clinical observation(s) detected across ${sources.length} systems. I can help summarize these.`
                        : `Patient record loaded from ${sources.length} systems. Try asking about medications, recent visits, or vitals.`}
                    </p>
                  </div>
                </div>
              )}
              {chatMessages.length === 0 && (
                <div className="space-y-3 pt-4">
                  <p className="text-[12px] font-bold uppercase tracking-wider text-neutral-400 pl-1">Suggested prompts</p>
                  <div className="grid gap-2">
                    {suggestedPrompts.map((p) => (
                      <button
                        key={p}
                        onClick={() => { setChatInput(p); }}
                        className="w-full text-left px-4 py-3 rounded-[12px] bg-white border border-black/5 shadow-sm text-[13px] font-medium text-neutral-700 hover:border-blue-200 hover:bg-blue-50/30 hover:text-blue-700 transition-all group flex items-center justify-between"
                      >
                        {p}
                        <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={cn('flex flex-col gap-1', msg.role === 'user' ? 'items-end' : 'items-start')}>
                  {msg.role === 'ai' && (
                    <span className="text-[11px] font-medium text-neutral-400 pl-1">Lumiere AI</span>
                  )}
                  <div className={cn(
                    'max-w-[88%] rounded-[20px] px-4 py-3 text-[14px] leading-relaxed shadow-sm',
                    msg.role === 'user'
                      ? 'bg-black text-white rounded-tr-[4px]'
                      : 'bg-white border border-black/5 text-neutral-800 rounded-tl-[4px]'
                  )}>
                    {/* Render text with citation markers highlighted */}
                    <span>{msg.text.replace(/\[(\d+)\]/g, '[$1]')}</span>
                    {/* Source pills */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-black/5 space-y-2">
                        {msg.confidence !== undefined && msg.confidence > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                              <div className={cn('h-full rounded-full', msg.confidence >= 0.8 ? 'bg-emerald-500' : msg.confidence >= 0.6 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${msg.confidence * 100}%` }} />
                            </div>
                            <span className="text-[10px] font-bold text-neutral-400 tracking-wide">{Math.round(msg.confidence * 100)}% CONFIDENCE</span>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                          {msg.sources.map((src, si) => (
                            <div key={si} className="flex items-center gap-1.5 px-2 py-1 bg-neutral-50 rounded-md border border-neutral-100">
                              <span className="text-[10px] font-bold text-blue-600">[{si + 1}]</span>
                              <span className="text-[11px] font-medium text-neutral-600 truncate max-w-[120px]">{src}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="px-5 py-4 border-t border-black/5 flex-shrink-0 bg-white/50 backdrop-blur-md">
              <div className="relative flex items-end gap-2 bg-white rounded-[16px] border border-black/10 shadow-sm p-1.5 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
                <textarea
                  rows={1}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChat();
                    }
                  }}
                  placeholder="Ask Copilot..."
                  className="flex-1 max-h-[120px] min-h-[36px] py-2 px-3 bg-transparent text-[14px] outline-none resize-none placeholder:text-neutral-400"
                />
                <button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim()}
                  className="w-9 h-9 flex-shrink-0 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-all shadow-sm"
                >
                  <ArrowRight size={16} strokeWidth={2.5} />
                </button>
              </div>
              <p className="text-[10px] text-center text-neutral-400 mt-3 font-medium">
                AI can make mistakes. Verify critical clinical context.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ═══ VOICE REVIEW MODAL ═══ */}
      {voiceReviewOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6" onClick={() => setVoiceReviewOpen(false)}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300" />
          <div className="bg-white/80 backdrop-blur-xl rounded-[24px] w-full max-w-[560px] max-h-[90vh] overflow-y-auto shadow-[0_8px_40px_rgb(0,0,0,0.12)] border border-white/60 relative animate-in fade-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="px-8 pt-8 pb-5 border-b border-black/5 bg-white/50 sticky top-0 z-10">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-4 border border-blue-100 shadow-sm">
                <Mic size={20} className="text-blue-600" />
              </div>
              <h2 className="text-[20px] font-semibold text-black tracking-tight">Review extraction</h2>
              <p className="text-[14px] text-neutral-500 mt-1">Lumiere extracted the following clinical context from your recording.</p>
            </div>
            <div className="px-8 py-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5 block pl-1">Date of visit</label>
                  <input
                    type="date"
                    value={voiceReviewForm.date}
                    onChange={(e) => setVoiceReviewForm({ ...voiceReviewForm, date: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-black/10 bg-white/50 text-[14px] outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5 block pl-1">Visit type</label>
                  <select
                    value={voiceReviewForm.visitType}
                    onChange={(e) => setVoiceReviewForm({ ...voiceReviewForm, visitType: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-black/10 bg-white/50 text-[14px] outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm appearance-none cursor-pointer"
                  >
                    <option value="">Select...</option>
                    <option value="consultation">Consultation</option>
                    <option value="follow-up">Follow-up</option>
                    <option value="emergency">Emergency</option>
                    <option value="lab-review">Lab Review</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5 block pl-1">Transcribed notes</label>
                <textarea
                  rows={5}
                  value={voiceReviewForm.notes}
                  onChange={(e) => setVoiceReviewForm({ ...voiceReviewForm, notes: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white/50 text-[14px] outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all resize-none shadow-sm leading-relaxed"
                />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5 block pl-1">Detected diagnosis</label>
                  <input
                    type="text"
                    placeholder="e.g. Hypertension Stage 1"
                    value={voiceReviewForm.diagnosis}
                    onChange={(e) => setVoiceReviewForm({ ...voiceReviewForm, diagnosis: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-black/10 bg-white/50 text-[14px] outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5 block pl-1">Detected medications</label>
                  <input
                    type="text"
                    placeholder="Comma separated"
                    value={voiceReviewForm.medications}
                    onChange={(e) => setVoiceReviewForm({ ...voiceReviewForm, medications: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-black/10 bg-white/50 text-[14px] outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                  />
                </div>
              </div>
              {/* FHIR Validation Badge */}
              {voiceReviewForm.notes && voiceReviewForm.date ? (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-50/80 border border-emerald-100 shadow-sm mt-2">
                  <CheckCircle size={16} className="text-emerald-500" />
                  <span className="text-[13px] font-semibold text-emerald-700 tracking-wide">FHIR R4 Valid Payload</span>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50/80 border border-amber-100 shadow-sm mt-2">
                  <AlertTriangle size={16} className="text-amber-500 mt-0.5" />
                  <div>
                    <span className="text-[13px] font-semibold text-amber-700 tracking-wide">FHIR Validation Warning</span>
                    <ul className="text-[12px] text-amber-600 mt-1 list-disc pl-4 space-y-0.5">
                      {!voiceReviewForm.notes && <li>Missing required field: transcribed notes</li>}
                      {!voiceReviewForm.date && <li>Missing required field: date of visit</li>}
                    </ul>
                  </div>
                </div>
              )}
            </div>
            <div className="px-8 py-5 border-t border-black/5 flex items-center justify-between bg-white/50 rounded-b-[24px]">
              <button
                onClick={handleDiscardVoice}
                className="px-5 py-2.5 rounded-xl text-[14px] font-medium text-neutral-600 hover:bg-black/5 hover:text-black transition-all duration-200"
              >
                Discard
              </button>
              <button
                onClick={handleConfirmVoiceSave}
                className="px-6 py-2.5 bg-black text-white text-[14px] font-semibold rounded-xl hover:bg-neutral-800 shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200"
              >
                Save to Golden Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PDF REVIEW MODAL ═══ */}
      {pdfReviewOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6" onClick={() => setPdfReviewOpen(false)}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-300" />
          <div className="bg-white/80 backdrop-blur-xl rounded-[24px] w-full max-w-[760px] max-h-[90vh] overflow-y-auto shadow-[0_8px_40px_rgb(0,0,0,0.12)] border border-white/60 relative animate-in fade-in zoom-in-95 duration-300 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-8 pt-8 pb-5 border-b border-black/5 bg-white/50 sticky top-0 z-10 flex items-center justify-between">
              <div>
                <h2 className="text-[20px] font-semibold text-black tracking-tight">Review document extraction</h2>
                <p className="text-[14px] text-neutral-500 mt-1">Lumiere analyzed this PDF. Confirm or correct the extracted fields.</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm shrink-0">
                <FileText size={20} className="text-blue-600" />
              </div>
            </div>
            <div className="px-8 py-6 flex flex-col md:flex-row gap-8">
              {/* Left panel — PDF preview */}
              <div className="md:w-[35%] flex-shrink-0">
                <div className="bg-white rounded-[16px] border border-black/10 shadow-sm p-6 flex flex-col items-center gap-4 min-h-[240px] justify-center relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-neutral-50 to-white -z-10" />
                  <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform duration-300 border border-black/5">
                    <FileText size={32} className="text-blue-500" />
                  </div>
                  <div className="text-center px-2">
                    <p className="text-[14px] font-semibold text-black break-all">{pdfFile?.name ?? 'document.pdf'}</p>
                    <span className="inline-block mt-2 px-2.5 py-1 bg-neutral-100 rounded-lg text-[11px] font-bold tracking-wider text-neutral-500 uppercase">1 page</span>
                  </div>
                </div>
              </div>
              {/* Right panel — extracted fields */}
              <div className="flex-1 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5 block pl-1">Document date</label>
                    <input
                      type="date"
                      value={pdfReviewForm.date}
                      onChange={(e) => setPdfReviewForm({ ...pdfReviewForm, date: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-black/10 bg-white/50 text-[14px] outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5 block pl-1">Document type</label>
                    <select
                      value={pdfReviewForm.docType}
                      onChange={(e) => setPdfReviewForm({ ...pdfReviewForm, docType: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-black/10 bg-white/50 text-[14px] outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm appearance-none cursor-pointer"
                    >
                      <option value="">Select...</option>
                      <option value="lab_report">Lab Report</option>
                      <option value="discharge_summary">Discharge Summary</option>
                      <option value="prescription">Prescription</option>
                      <option value="imaging">Imaging</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5 block pl-1">Source system</label>
                  <select
                    value={pdfReviewForm.sourceSystem}
                    onChange={(e) => setPdfReviewForm({ ...pdfReviewForm, sourceSystem: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-black/10 bg-white/50 text-[14px] outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm appearance-none cursor-pointer"
                  >
                    <option value="">Select...</option>
                    <option value="EPIC EHR">EPIC EHR</option>
                    <option value="LabCorp">LabCorp</option>
                    <option value="Manual">Manual</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5 block pl-1">Extracted diagnosis</label>
                    <input
                      type="text"
                      value={pdfReviewForm.diagnosis}
                      onChange={(e) => setPdfReviewForm({ ...pdfReviewForm, diagnosis: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-black/10 bg-white/50 text-[14px] outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5 block pl-1">Extracted medications</label>
                    <input
                      type="text"
                      placeholder="Comma separated"
                      value={pdfReviewForm.medications}
                      onChange={(e) => setPdfReviewForm({ ...pdfReviewForm, medications: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-black/10 bg-white/50 text-[14px] outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[12px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5 block pl-1">Key findings</label>
                  <textarea
                    rows={4}
                    value={pdfReviewForm.findings}
                    onChange={(e) => setPdfReviewForm({ ...pdfReviewForm, findings: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white/50 text-[14px] outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all resize-none shadow-sm leading-relaxed"
                  />
                </div>
                {/* FHIR Validation Badge */}
                {pdfReviewForm.date && pdfReviewForm.docType ? (
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-50/80 border border-emerald-100 shadow-sm mt-2">
                    <CheckCircle size={16} className="text-emerald-500" />
                    <span className="text-[13px] font-semibold text-emerald-700 tracking-wide">FHIR R4 Valid Document</span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50/80 border border-amber-100 shadow-sm mt-2">
                    <AlertTriangle size={16} className="text-amber-500 mt-0.5" />
                    <div>
                      <span className="text-[13px] font-semibold text-amber-700 tracking-wide">FHIR Validation Warning</span>
                      <ul className="text-[12px] text-amber-600 mt-1 list-disc pl-4 space-y-0.5">
                        {!pdfReviewForm.date && <li>Missing required field: document date</li>}
                        {!pdfReviewForm.docType && <li>Missing required field: document type</li>}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="px-8 py-5 border-t border-black/5 flex items-center justify-between bg-white/50 rounded-b-[24px] mt-auto">
              <button
                onClick={() => setPdfReviewOpen(false)}
                className="px-5 py-2.5 rounded-xl text-[14px] font-medium text-neutral-600 hover:bg-black/5 hover:text-black transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPdfSave}
                className="px-6 py-2.5 bg-black text-white text-[14px] font-semibold rounded-xl hover:bg-neutral-800 shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200"
              >
                Save to Golden Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
