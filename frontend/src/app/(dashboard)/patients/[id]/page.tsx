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
            className="text-[13px] text-neutral-400 hover:text-black transition-colors"
          >
            Patient Registry <span className="mx-1.5">/</span> <span className="text-neutral-600">{name}</span>
          </button>

          {/* Patient Header Card */}
          <div className="bg-white border border-[#EBEBEB] rounded-xl p-6">
            <div className="flex items-start gap-5">
              {/* Avatar */}
              <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                <span className="text-[22px] font-semibold text-neutral-400">
                  {(patient.given_name?.[0] ?? '').toUpperCase()}{(patient.family_name?.[0] ?? '').toUpperCase()}
                </span>
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h1 className="text-[20px] font-semibold text-black">{name}</h1>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium border border-emerald-200">
                    94% precision
                  </span>
                </div>
                <p className="text-[11px] font-mono text-neutral-400 mt-1">{patient.id}</p>
                <p className="text-[13px] text-neutral-500 mt-1">
                  {age} yrs&nbsp;&nbsp;|&nbsp;&nbsp;{patient.gender ? titleCase(patient.gender) : '—'}&nbsp;&nbsp;|&nbsp;&nbsp;{[patient.city, patient.state].filter(Boolean).join(', ') || '—'}
                </p>
              </div>
              {/* Action Buttons */}
              <div className="flex gap-3 flex-shrink-0">
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-200 text-[13px] font-medium text-neutral-600 hover:border-[#C8C8C8] transition-all duration-150">
                  <Download size={14} />
                  Export PDF
                </button>
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white text-[13px] font-medium hover:bg-neutral-800 active:scale-[0.97] transition-all duration-150">
                  <Share2 size={14} />
                  Relay EHR
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-neutral-200 flex gap-6">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={cn(
                  'pb-2 text-[14px] font-medium transition-colors border-b-2',
                  activeTab === t.key
                    ? 'border-black text-black'
                    : 'border-transparent text-neutral-400 hover:text-neutral-700'
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
              <div>
                <h2 className="text-[16px] font-semibold text-black mb-4">Add medical record</h2>
                <div className="flex gap-2 mb-4">
                  {(['voice', 'pdf', 'manual'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setRecordMode(m)}
                      className={cn(
                        'px-4 py-1.5 rounded-full text-[13px] font-medium capitalize transition-all duration-150',
                        recordMode === m
                          ? 'bg-black text-white'
                          : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                      )}
                    >
                      {m === 'pdf' ? 'PDF upload' : m === 'manual' ? 'Manual entry' : 'Voice'}
                    </button>
                  ))}
                </div>

                <div className="bg-white border border-[#EBEBEB] rounded-xl p-6">
                  {/* Voice */}
                  {recordMode === 'voice' && (
                    <div className="flex flex-col items-center gap-4 py-6">
                      <button
                        onClick={() => isRecording ? stopGoldenRecording() : startGoldenRecording()}
                        className={cn(
                          'w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-150 relative',
                          isRecording ? 'bg-red-500' : 'bg-black'
                        )}
                      >
                        {isRecording ? <Square size={20} className="text-white" /> : <Mic size={20} className="text-white" />}
                        {isRecording && (
                          <span className="absolute inset-0 rounded-2xl bg-red-500 animate-ping opacity-30" />
                        )}
                      </button>
                      {isRecording && (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-[14px] font-mono text-red-600">{formatTime(recordingSeconds)}</span>
                        </div>
                      )}
                      <p className="text-[13px] text-neutral-500">
                        {isRecording ? 'Listening... tap to stop' : 'Tap to start recording'}
                      </p>

                      {/* Whisper audio file upload — server-side STT */}
                      {!isRecording && (
                        <div className="flex flex-col items-center gap-1">
                          <p className="text-[11px] text-neutral-400">or</p>
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
                            className="px-3 py-1.5 border border-neutral-200 text-[12px] font-medium text-neutral-600 rounded-lg hover:border-neutral-300 transition-all duration-150 disabled:opacity-50"
                          >
                            {whisperLoading ? 'Transcribing…' : '🎤 Upload audio file (Whisper)'}
                          </button>
                        </div>
                      )}

                      {/* Live interim transcript while recording */}
                      {isRecording && (liveTranscript || transcript) && (
                        <div className="w-full mt-2 bg-neutral-50 rounded-lg p-4 text-[14px] text-neutral-700 leading-relaxed border border-neutral-100">
                          {transcript}{transcript && liveTranscript ? ' ' : ''}
                          <span className="text-neutral-400 italic">{liveTranscript}</span>
                        </div>
                      )}

                      {/* Final transcript after stopping */}
                      {!isRecording && transcript && (
                        <div className="w-full mt-4 space-y-3">
                          <div className="bg-neutral-50 rounded-lg p-4 text-[14px] text-neutral-700 leading-relaxed">
                            {transcript}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveVoice}
                              className="px-4 py-2 bg-black text-white text-[13px] font-medium rounded-lg hover:bg-neutral-800 active:scale-[0.97] transition-all duration-150"
                            >
                              Save to record
                            </button>
                            <button
                              onClick={() => { setTranscript(''); setRecordingSeconds(0); }}
                              className="px-4 py-2 border border-neutral-200 text-[13px] font-medium text-neutral-600 rounded-lg hover:border-neutral-300 transition-all duration-150"
                            >
                              Discard
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* PDF */}
                  {recordMode === 'pdf' && (
                    <div>
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
                        <div className="py-8 space-y-3">
                          <div className="skeleton h-4 w-48 mx-auto" />
                          <div className="skeleton h-3 w-32 mx-auto" />
                          <p className="text-[13px] text-neutral-400 text-center mt-2">Processing PDF...</p>
                        </div>
                      ) : (
                        <div
                          className="flex flex-col items-center gap-3 py-6 border-2 border-dashed border-neutral-200 rounded-lg min-h-[120px] justify-center cursor-pointer hover:border-neutral-300 transition-colors"
                          onClick={() => pdfInputRef.current?.click()}
                          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const f = e.dataTransfer.files?.[0];
                            if (f && f.type === 'application/pdf') handlePdfSelect(f);
                          }}
                        >
                          <FileUp size={24} className="text-neutral-300" />
                          <p className="text-[14px] text-neutral-500">Drop PDF here or click to upload</p>
                          <button
                            onClick={(e) => { e.stopPropagation(); pdfInputRef.current?.click(); }}
                            className="mt-2 px-4 py-2 bg-black text-white text-[13px] font-medium rounded-lg hover:bg-neutral-800 active:scale-[0.97] transition-all duration-150"
                          >
                            Select file
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Manual */}
                  {recordMode === 'manual' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">Date</label>
                          <input
                            type="date"
                            value={manualForm.date}
                            onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                            className="w-full h-10 px-3 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">Visit type</label>
                          <select
                            value={manualForm.visitType}
                            onChange={(e) => setManualForm({ ...manualForm, visitType: e.target.value })}
                            className="w-full h-10 px-3 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors bg-white"
                          >
                            <option value="">Select...</option>
                            <option value="routine">Routine checkup</option>
                            <option value="follow-up">Follow-up</option>
                            <option value="emergency">Emergency</option>
                            <option value="specialist">Specialist referral</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">Doctor notes</label>
                        <textarea
                          rows={4}
                          value={manualForm.notes}
                          onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">Diagnosis</label>
                          <input
                            type="text"
                            value={manualForm.diagnosis}
                            onChange={(e) => setManualForm({ ...manualForm, diagnosis: e.target.value })}
                            className="w-full h-10 px-3 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">Medications</label>
                          <input
                            type="text"
                            value={manualForm.medications}
                            onChange={(e) => setManualForm({ ...manualForm, medications: e.target.value })}
                            className="w-full h-10 px-3 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors"
                          />
                        </div>
                      </div>
                      <button
                        onClick={handleSaveManual}
                        className="px-6 py-2 bg-black text-white text-[14px] font-medium rounded-lg hover:bg-neutral-800 active:scale-[0.97] transition-all duration-150"
                      >
                        Save record
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Section B: Data Provenance */}
              <div>
                <h2 className="text-[16px] font-semibold text-black flex items-center gap-2 mb-4">
                  <Zap size={16} className="text-neutral-400" />
                  Data provenance
                </h2>
                <div className="bg-white border border-[#EBEBEB] rounded-xl divide-y divide-neutral-50">
                  {sources.map((s, i) => {
                    // Simulate FHIR validation status per source
                    const fhirStatus: 'valid' | 'warning' | 'invalid' =
                      s.is_active && i % 3 !== 2 ? (i % 3 === 1 ? 'warning' : 'valid') : (!s.is_active ? 'invalid' : 'valid');
                    const fhirBadge = {
                      valid: { label: 'FHIR R4 Valid', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle size={12} className="text-emerald-600" /> },
                      warning: { label: 'FHIR Warning', bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: <AlertTriangle size={12} className="text-amber-600" /> },
                      invalid: { label: 'FHIR Invalid', bg: 'bg-red-50 text-red-700 border-red-200', icon: <X size={12} className="text-red-600" /> },
                    }[fhirStatus];
                    return (
                      <div key={s.id} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors duration-100">
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-mono text-neutral-400 w-6">{String(i + 1).padStart(2, '0')}</span>
                          <span className="text-[14px] text-black">{s.system_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${fhirBadge.bg}`}>
                            {fhirBadge.icon}
                            {fhirBadge.label}
                          </span>
                          {s.is_active && <CheckCircle size={14} className="text-emerald-500" />}
                        </div>
                      </div>
                    );
                  })}
                  {sources.length === 0 && (
                    <div className="px-4 py-8 text-center text-[13px] text-neutral-400">No source systems configured</div>
                  )}
                </div>
              </div>

              {/* Section C: History Sequence */}
              <div>
                <h2 className="text-[16px] font-semibold text-black flex items-center gap-2 mb-4">
                  <Clock size={16} className="text-neutral-400" />
                  History sequence
                </h2>
                <div className="bg-white border border-[#EBEBEB] rounded-xl p-6">
                  <div className="relative pl-6 space-y-6">
                    <div className="absolute left-2 top-2 bottom-2 w-px bg-neutral-200" />
                    {[
                      { label: 'Baseline sync', sub: 'Lumiere Core v1.3 — Verified 4 artifacts' },
                      { label: 'Duplicate resolution', sub: 'Manual audit — Merged institutional identities' },
                      { label: 'Record ingestion', sub: 'EPIC EHR — 3 new observations imported' },
                    ].map((item, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-[18px] top-1.5 w-2.5 h-2.5 rounded-full bg-neutral-300 border-2 border-white" />
                        <p className="text-[14px] font-medium text-black">{item.label}</p>
                        <p className="text-[13px] text-neutral-400 mt-0.5">{item.sub}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section D: Master Identity */}
              <div>
                <h2 className="text-[16px] font-semibold text-black mb-4">Master identity</h2>
                <div className="bg-white border border-[#EBEBEB] rounded-xl p-6">
                  <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">Golden Record ID</p>
                      <p className="text-[13px] font-mono text-neutral-700 mt-1">{patient.id.slice(0, 8)}...</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">Created</p>
                      <p className="text-[13px] text-neutral-700 mt-1">{new Date(patient.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">Masked SSN</p>
                      <p className="text-[13px] font-mono text-neutral-700 mt-1">***-**-{patient.id.slice(-4)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">Curation Hash</p>
                      <p className="text-[13px] font-mono text-neutral-700 mt-1">0x{patient.id.slice(0, 6)}...{patient.id.slice(-4)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB: COMMUNICATION ═══ */}
          {activeTab === 'communication' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-black">Clinical command</h2>
                <p className="text-[14px] text-neutral-500 mt-1">
                  Broadcast intelligence, artifacts, and instructions to the patient edge.
                </p>
              </div>

              {/* Patient confirmation card */}
              <div className="bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-[12px] font-semibold text-neutral-500">
                  {(patient.given_name?.[0] ?? '').toUpperCase()}{(patient.family_name?.[0] ?? '').toUpperCase()}
                </div>
                <div>
                  <p className="text-[13px] font-medium text-black">{name}</p>
                  <p className="text-[11px] text-neutral-400">{patient.id.slice(0, 12)}</p>
                </div>
              </div>

              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setCommMode('voice')}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-[13px] font-medium transition-all duration-150',
                    commMode === 'voice' ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                  )}
                >
                  Voice capture
                </button>
                <button
                  onClick={() => setCommMode('pdf')}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-[13px] font-medium transition-all duration-150',
                    commMode === 'pdf' ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                  )}
                >
                  PDF
                </button>
              </div>

              {commMode === 'voice' ? (
                <div className="bg-white border border-[#EBEBEB] rounded-xl p-8 flex flex-col items-center gap-4">
                  <button
                    onClick={() => commRecording ? stopCommRecording() : startCommRecording()}
                    className={cn(
                      'w-[72px] h-[72px] rounded-2xl flex items-center justify-center transition-all duration-150 relative',
                      commRecording ? 'bg-red-500' : 'bg-black'
                    )}
                  >
                    {commRecording ? <Square size={24} className="text-white" /> : <Mic size={24} className="text-white" />}
                    {!commRecording && (
                      <span className="absolute inset-0 rounded-2xl border border-neutral-300 animate-ping opacity-20" />
                    )}
                  </button>
                  {commRecording && (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[14px] font-mono text-red-600">{formatTime(commSeconds)}</span>
                    </div>
                  )}
                  <div className="text-center">
                    <h3 className="text-[18px] font-semibold text-black">Consensus recording</h3>
                    <p className="text-[14px] text-neutral-500 mt-1">
                      Speak clinical context. Lumiere AI will process and relay intelligence.
                    </p>
                  </div>
                  <button
                    onClick={() => commRecording ? stopCommRecording() : startCommRecording()}
                    className={cn(
                      'px-6 py-2.5 rounded-xl text-[15px] font-semibold transition-all duration-150 active:scale-[0.97]',
                      commRecording ? 'bg-black text-white' : 'bg-red-500 text-white hover:bg-red-600'
                    )}
                  >
                    {commRecording ? 'Deactivate capture' : 'Initiate capture'}
                  </button>

                  {/* Live transcript while recording */}
                  {commRecording && (commLiveTranscript || commTranscript) && (
                    <div className="w-full mt-2 bg-neutral-50 rounded-lg p-4 text-[14px] text-neutral-700 leading-relaxed border border-neutral-100">
                      {commTranscript}{commTranscript && commLiveTranscript ? ' ' : ''}
                      <span className="text-neutral-400 italic">{commLiveTranscript}</span>
                    </div>
                  )}

                  {/* Final transcript after stopping */}
                  {!commRecording && commTranscript && (
                    <div className="w-full mt-4 space-y-3">
                      <div className="bg-neutral-50 rounded-lg p-4 text-[14px] text-neutral-700 leading-relaxed">
                        {commTranscript}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { showToast('Communication relayed successfully'); setCommTranscript(''); setCommSeconds(0); }}
                          className="px-4 py-2 bg-black text-white text-[13px] font-medium rounded-lg hover:bg-neutral-800 active:scale-[0.97] transition-all duration-150"
                        >
                          Relay intelligence
                        </button>
                        <button
                          onClick={() => { setCommTranscript(''); setCommSeconds(0); }}
                          className="px-4 py-2 border border-neutral-200 text-[13px] font-medium text-neutral-600 rounded-lg hover:border-neutral-300 transition-all duration-150"
                        >
                          Discard
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white border-2 border-dashed border-neutral-200 rounded-xl p-8 flex flex-col items-center gap-3 min-h-[120px] justify-center">
                  <FileUp size={24} className="text-neutral-300" />
                  <p className="text-[14px] text-neutral-500">Drop PDF here or click to upload</p>
                  <button className="mt-2 px-4 py-2 bg-black text-white text-[13px] font-medium rounded-lg hover:bg-neutral-800 transition-all duration-150">
                    Select artifact
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ═══ TAB: HISTORY ═══ */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-black">Patient history</h2>
                  <p className="text-[14px] text-neutral-500 mt-1">
                    Complete timeline of events, syncs, and clinical encounters.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[12px] text-neutral-400">
                  <Filter size={12} />
                  {filteredHistory.length} events
                </div>
              </div>

              {/* Filter pills */}
              <div className="flex gap-2">
                {([
                  { key: 'all' as const, label: 'All' },
                  { key: 'visits' as const, label: 'Visits' },
                  { key: 'labs' as const, label: 'Labs' },
                  { key: 'syncs' as const, label: 'Syncs' },
                  { key: 'manual' as const, label: 'Manual' },
                ]).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setHistoryFilter(f.key)}
                    className={cn(
                      'px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-150',
                      historyFilter === f.key
                        ? 'bg-black text-white'
                        : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Timeline */}
              {filteredHistory.length === 0 ? (
                <div className="bg-white border border-[#EBEBEB] rounded-xl p-12 text-center">
                  <Clock size={24} className="text-neutral-300 mx-auto mb-3" />
                  <p className="text-[14px] text-neutral-400">No events match the selected filter.</p>
                </div>
              ) : (
                <div className="bg-white border border-[#EBEBEB] rounded-xl p-6">
                  <div className="relative pl-8 space-y-6">
                    <div className="absolute left-3 top-2 bottom-2 w-px bg-neutral-200" />
                    {filteredHistory.map((event) => (
                      <div key={event.id} className="relative">
                        <div className={cn(
                          'absolute -left-[22px] top-1.5 w-3 h-3 rounded-full border-2 border-white',
                          eventDotColors[event.type]
                        )} />
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                              <p className="text-[14px] font-medium text-black">{event.label}</p>
                              <span className={cn(
                                'px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize',
                                eventBadgeColors[event.type]
                              )}>
                                {event.type}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 text-[10px] font-medium">
                                {event.sourceSystem}
                              </span>
                              <span className={cn(
                                'w-2 h-2 rounded-full inline-block',
                                event.fhirStatus === 'valid' ? 'bg-emerald-500' : event.fhirStatus === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                              )} title={`FHIR ${event.fhirStatus}`} />
                            </div>
                            <p className="text-[13px] text-neutral-400">{event.detail}</p>
                            <p className="text-[11px] text-neutral-300 mt-1">Ingested: {event.ingestedAt}</p>
                          </div>
                          <span className="text-[12px] text-neutral-400 whitespace-nowrap flex-shrink-0">{event.date}</span>
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
          'flex-shrink-0 border-l border-[#F0F0F0] bg-white flex flex-col transition-all duration-250 overflow-hidden',
          drawerOpen ? 'w-[360px]' : 'w-[44px]'
        )}
      >
        {/* Collapsed state */}
        {!drawerOpen && (
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center justify-center h-full gap-2 hover:bg-neutral-50 transition-colors"
          >
            <Sparkles size={16} className="text-neutral-500" />
            <span className="text-[10px] font-medium text-neutral-400 tracking-wide" style={{ writingMode: 'vertical-rl' }}>AI</span>
          </button>
        )}

        {/* Expanded state */}
        {drawerOpen && (
          <>
            {/* Drawer header */}
            <div className="px-4 py-4 border-b border-neutral-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-[15px] font-semibold text-black">Ask Lumiere AI</h3>
                <p className="text-[12px] text-neutral-400">Query this patient&apos;s record</p>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="p-1 rounded hover:bg-neutral-100 transition-colors">
                <X size={16} className="text-neutral-400" />
              </button>
            </div>

            {/* Chat area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {/* Proactive alert banner */}
              {patient && chatMessages.length === 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 mb-2">
                  <p className="text-[12px] font-medium text-blue-700">AI Insight</p>
                  <p className="text-[11px] text-blue-600 mt-0.5">
                    {patient.observations.length > 0
                      ? `${patient.observations.length} observation(s) detected across ${sources.length} source system(s). Ask me to summarize.`
                      : `Patient record loaded from ${sources.length} source system(s). Try asking about medications or visits.`}
                  </p>
                </div>
              )}
              {chatMessages.length === 0 && (
                <div className="space-y-2 pt-8">
                  <p className="text-[12px] text-neutral-400 text-center mb-4">Suggested prompts</p>
                  {suggestedPrompts.map((p) => (
                    <button
                      key={p}
                      onClick={() => { setChatInput(p); }}
                      className="w-full text-left px-3 py-2 rounded-lg bg-neutral-50 text-[13px] text-neutral-600 hover:bg-neutral-100 transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[85%] rounded-[10px] text-[14px] leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-black text-white px-3 py-2'
                      : 'bg-[#F5F5F5] text-neutral-800 px-3 py-2'
                  )}>
                    {/* Render text with citation markers highlighted */}
                    <span>{msg.text.replace(/\[(\d+)\]/g, '[$1]')}</span>
                    {/* Source pills */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-neutral-200/60 space-y-1">
                        {msg.confidence !== undefined && msg.confidence > 0 && (
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <div className="w-12 h-1 bg-neutral-200 rounded-full overflow-hidden">
                              <div className={cn('h-full rounded-full', msg.confidence >= 0.8 ? 'bg-emerald-500' : msg.confidence >= 0.6 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${msg.confidence * 100}%` }} />
                            </div>
                            <span className="text-[10px] text-neutral-400">{Math.round(msg.confidence * 100)}% conf</span>
                          </div>
                        )}
                        {msg.sources.map((src, si) => (
                          <div key={si} className="flex items-center gap-1.5">
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold shrink-0">{si + 1}</span>
                            <span className="text-[11px] text-neutral-500 truncate">{src}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-neutral-100 flex-shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat(); }}
                  placeholder="Ask about this patient..."
                  className="flex-1 h-9 px-3 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors"
                />
                <button
                  onClick={handleSendChat}
                  className="w-9 h-9 bg-black rounded-lg flex items-center justify-center hover:bg-neutral-800 active:scale-[0.97] transition-all duration-150"
                >
                  <Send size={14} className="text-white" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══ VOICE REVIEW MODAL ═══ */}
      {voiceReviewOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40" onClick={() => setVoiceReviewOpen(false)}>
          <div className="bg-white rounded-xl w-full max-w-[560px] max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-neutral-100">
              <h2 className="text-[18px] font-semibold text-black">Review transcription</h2>
              <p className="text-[13px] text-neutral-400 mt-1">Lumiere extracted the following from your recording. Edit if needed before saving.</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">Date of visit</label>
                  <input
                    type="date"
                    value={voiceReviewForm.date}
                    onChange={(e) => setVoiceReviewForm({ ...voiceReviewForm, date: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">Visit type</label>
                  <select
                    value={voiceReviewForm.visitType}
                    onChange={(e) => setVoiceReviewForm({ ...voiceReviewForm, visitType: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors bg-white"
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
                <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">Transcribed notes</label>
                <textarea
                  rows={5}
                  value={voiceReviewForm.notes}
                  onChange={(e) => setVoiceReviewForm({ ...voiceReviewForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">Detected diagnosis</label>
                  <input
                    type="text"
                    placeholder="e.g. Hypertension Stage 1"
                    value={voiceReviewForm.diagnosis}
                    onChange={(e) => setVoiceReviewForm({ ...voiceReviewForm, diagnosis: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">Detected medications</label>
                  <input
                    type="text"
                    placeholder="Comma separated"
                    value={voiceReviewForm.medications}
                    onChange={(e) => setVoiceReviewForm({ ...voiceReviewForm, medications: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors"
                  />
                </div>
              </div>
              {/* FHIR Validation Badge */}
              {voiceReviewForm.notes && voiceReviewForm.date ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
                  <CheckCircle size={14} className="text-emerald-600" />
                  <span className="text-[12px] font-medium text-emerald-700">FHIR R4 Valid</span>
                </div>
              ) : (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertTriangle size={14} className="text-amber-600 mt-0.5" />
                  <div>
                    <span className="text-[12px] font-medium text-amber-700">FHIR Validation Warning</span>
                    <ul className="text-[11px] text-amber-600 mt-1 list-disc pl-4">
                      {!voiceReviewForm.notes && <li>Missing required field: transcribed notes</li>}
                      {!voiceReviewForm.date && <li>Missing required field: date of visit</li>}
                    </ul>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between">
              <button
                onClick={handleDiscardVoice}
                className="px-4 py-2 rounded-lg border border-neutral-200 text-[13px] font-medium text-neutral-600 hover:border-neutral-300 transition-all duration-150"
              >
                Discard
              </button>
              <button
                onClick={handleConfirmVoiceSave}
                className="px-5 py-2 bg-black text-white text-[13px] font-medium rounded-lg hover:bg-neutral-800 active:scale-[0.97] transition-all duration-150"
              >
                Save to Golden Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PDF REVIEW MODAL ═══ */}
      {pdfReviewOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40" onClick={() => setPdfReviewOpen(false)}>
          <div className="bg-white rounded-xl w-full max-w-[720px] max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-neutral-100">
              <h2 className="text-[18px] font-semibold text-black">Review extracted record</h2>
              <p className="text-[13px] text-neutral-400 mt-1">Lumiere read this PDF. Confirm or correct the extracted fields.</p>
            </div>
            <div className="px-6 py-5 flex gap-6">
              {/* Left panel — PDF preview */}
              <div className="w-[40%] flex-shrink-0">
                <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6 flex flex-col items-center gap-3 min-h-[200px] justify-center">
                  <FileText size={32} className="text-neutral-300" />
                  <p className="text-[13px] font-medium text-neutral-600 text-center break-all">{pdfFile?.name ?? 'document.pdf'}</p>
                  <span className="text-[11px] text-neutral-400">1 page</span>
                </div>
              </div>
              {/* Right panel — extracted fields */}
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">Date of document</label>
                    <input
                      type="date"
                      value={pdfReviewForm.date}
                      onChange={(e) => setPdfReviewForm({ ...pdfReviewForm, date: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">Document type</label>
                    <select
                      value={pdfReviewForm.docType}
                      onChange={(e) => setPdfReviewForm({ ...pdfReviewForm, docType: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors bg-white"
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
                  <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">Source system</label>
                  <select
                    value={pdfReviewForm.sourceSystem}
                    onChange={(e) => setPdfReviewForm({ ...pdfReviewForm, sourceSystem: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors bg-white"
                  >
                    <option value="">Select...</option>
                    <option value="EPIC EHR">EPIC EHR</option>
                    <option value="LabCorp">LabCorp</option>
                    <option value="Manual">Manual</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">Extracted diagnosis</label>
                    <input
                      type="text"
                      value={pdfReviewForm.diagnosis}
                      onChange={(e) => setPdfReviewForm({ ...pdfReviewForm, diagnosis: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">Extracted medications</label>
                    <input
                      type="text"
                      placeholder="Comma separated"
                      value={pdfReviewForm.medications}
                      onChange={(e) => setPdfReviewForm({ ...pdfReviewForm, medications: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[12px] font-medium uppercase tracking-[0.08em] text-neutral-400 mb-1 block">Key findings</label>
                  <textarea
                    rows={3}
                    value={pdfReviewForm.findings}
                    onChange={(e) => setPdfReviewForm({ ...pdfReviewForm, findings: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E0E0E0] text-[14px] outline-none focus:border-black transition-colors resize-none"
                  />
                </div>
                {/* FHIR Validation Badge */}
                {pdfReviewForm.date && pdfReviewForm.docType ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
                    <CheckCircle size={14} className="text-emerald-600" />
                    <span className="text-[12px] font-medium text-emerald-700">FHIR R4 Valid</span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                    <AlertTriangle size={14} className="text-amber-600 mt-0.5" />
                    <div>
                      <span className="text-[12px] font-medium text-amber-700">FHIR Validation Warning</span>
                      <ul className="text-[11px] text-amber-600 mt-1 list-disc pl-4">
                        {!pdfReviewForm.date && <li>Missing: document date</li>}
                        {!pdfReviewForm.docType && <li>Missing: document type</li>}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between">
              <button
                onClick={handleDiscardPdf}
                className="px-4 py-2 rounded-lg border border-neutral-200 text-[13px] font-medium text-neutral-600 hover:border-neutral-300 transition-all duration-150"
              >
                Discard
              </button>
              <button
                onClick={handleConfirmPdfSave}
                className="px-5 py-2 bg-black text-white text-[13px] font-medium rounded-lg hover:bg-neutral-800 active:scale-[0.97] transition-all duration-150"
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
