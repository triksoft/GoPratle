'use client';

import { useEffect, useRef, useState } from 'react';
import { sendAiChatMessage } from '@/lib/api';
import { formatBudgetDisplay } from '@/lib/format';
import type { AiChatResponse, Category, ChatMessage } from '@/types/requirement';

type Props = {
  onApplyDetails: (
    data: AiChatResponse['extracted'],
    targetStep: number,
    contact?: { phone?: string; email?: string }
  ) => void;
  onContinueManually?: () => void;
  contact?: { phone?: string; email?: string };
};

const INITIAL_GREETING = 'Hi! I’m your GoPratle event assistant. What are you planning?';

const INITIAL_QUICK_REPLIES = [
  'Birthday party',
  'Wedding',
  'Corporate event',
  'Concert / performance',
  'Other'
];

const SAMPLE_BRIEF =
  'I need a DJ and decorator for a birthday party in Bangalore next Saturday for 100 guests with a budget of ₹80,000.';

interface ErrorState {
  title: string;
  message: string;
  code?: string;
  isRetryable: boolean;
}

function resolveFriendlyError(err: any): ErrorState {
  const code = err?.code;
  const status = err?.status;
  const rawMsg = String(err?.message || '').toLowerCase();

  // 1. Missing / unconfigured Gemini key
  if (code === 'AI_CONFIG_MISSING' || status === 503 || rawMsg.includes('not configured')) {
    return {
      title: 'AI Assistant Not Configured',
      message: 'The AI assistant is currently not configured. Please complete the event form manually.',
      code: 'AI_CONFIG_MISSING',
      isRetryable: false
    };
  }

  // 2. Quota / rate limit reached
  if (code === 'AI_LIMIT_REACHED' || status === 429 || rawMsg.includes('usage limit') || rawMsg.includes('quota')) {
    return {
      title: 'AI Usage Limit Reached',
      message: 'The AI assistant has temporarily reached its usage limit. Please complete the event form manually.',
      code: 'AI_LIMIT_REACHED',
      isRetryable: true
    };
  }

  // 3. Temporary network / timeout failure
  if (code === 'AI_NETWORK_ERROR' || status === 504 || rawMsg.includes('timed out') || rawMsg.includes('network')) {
    return {
      title: 'Connection Timed Out',
      message: 'The AI request timed out or encountered a network issue. You can retry or complete the form manually.',
      code: 'AI_NETWORK_ERROR',
      isRetryable: true
    };
  }

  // 4. Invalid AI response
  if (code === 'AI_PARSE_FAILED' || status === 422 || rawMsg.includes('could not structure')) {
    return {
      title: 'Could Not Structure Brief',
      message: 'The AI assistant could not structure the event details. Please complete the event form manually.',
      code: 'AI_PARSE_FAILED',
      isRetryable: true
    };
  }

  // Default provider fallback
  return {
    title: 'AI Assistant Temporarily Unavailable',
    message: err?.message || 'The AI assistant is temporarily unavailable. Please complete the event form manually.',
    code: code || 'AI_SERVICE_ERROR',
    isRetryable: true
  };
}

function getTodayDateStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getThisWeekendDateRange(): { start: string; end: string } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 is Sunday, 6 is Saturday
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
  const saturday = new Date(now);
  saturday.setDate(now.getDate() + (dayOfWeek === 6 ? 0 : daysUntilSaturday));
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);

  const format = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return { start: format(saturday), end: format(sunday) };
}

export function AiAssistant({ onApplyDetails, onContinueManually, contact }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: INITIAL_GREETING }
  ]);
  const [quickReplies, setQuickReplies] = useState<string[]>(INITIAL_QUICK_REPLIES);
  const [extractedDetails, setExtractedDetails] = useState<AiChatResponse['extracted'] | null>(null);
  const [isReadyForReview, setIsReadyForReview] = useState(false);
  const [suggestedStep, setSuggestedStep] = useState(1);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [showSupportPanel, setShowSupportPanel] = useState(false);
  const [appliedNotice, setAppliedNotice] = useState(false);

  // Issue 1: Internal container scroll state
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  // Issue 3: Inline Date Picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'single' | 'range'>('single');
  const [singleDate, setSingleDate] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [datePickerError, setDatePickerError] = useState('');

  // Local Contact Details Step
  const [showContactPanel, setShowContactPanel] = useState(false);
  const [contactPhone, setContactPhone] = useState(contact?.phone || '');
  const [contactEmail, setContactEmail] = useState(contact?.email || '');
  const [contactError, setContactError] = useState('');

  useEffect(() => {
    if (contact?.phone && !contactPhone) setContactPhone(contact.phone);
    if (contact?.email && !contactEmail) setContactEmail(contact.email);
  }, [contact]);

  const hasContactPhone = Boolean(contactPhone && contactPhone.trim());
  const hasContactEmail = Boolean(contactEmail && contactEmail.trim());
  const cleanContactPhone = (contactPhone || '').replace(/\D/g, '');
  const isPhoneValid =
    !hasContactPhone ||
    (/^[+]?[\d\s\-().]{7,25}$/.test(contactPhone.trim()) &&
      cleanContactPhone.length >= 7 &&
      cleanContactPhone.length <= 15);
  const isEmailValid =
    !hasContactEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((contactEmail || '').trim());
  const isContactComplete =
    (hasContactPhone || hasContactEmail) && isPhoneValid && isEmailValid;

  const scrollChatToBottom = (smooth = true) => {
    const container = chatContainerRef.current;
    if (!container) return;
    if (smooth && typeof container.scrollTo === 'function') {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    } else {
      container.scrollTop = container.scrollHeight;
    }
    setIsScrolledUp(false);
  };

  const handleContainerScroll = () => {
    const container = chatContainerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    setIsScrolledUp(distanceFromBottom > 60);
  };

  // Only auto-scroll internal container when messages arrive, without jumping the outer page
  useEffect(() => {
    if (!isScrolledUp) {
      scrollChatToBottom(true);
    }
  }, [messages, loading, showContactPanel]);

  const handleManualRedirect = () => {
    if (onContinueManually) {
      onContinueManually();
    }
    const formElement = document.getElementById('requirement-form');
    if (typeof formElement?.scrollIntoView === 'function') {
      formElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    const lower = trimmed.toLowerCase();
    if (lower === 'add contact details' || lower === 'contact details') {
      setShowContactPanel(true);
      return;
    }

    if (
      lower === 'review details in form' ||
      lower === 'continue to review' ||
      lower === 'review event details' ||
      lower === 'review in form'
    ) {
      handleReviewDetails();
      return;
    }

    // Check if the user selected the "Pick from calendar" chip
    if (lower.includes('pick from calendar') || lower === 'calendar') {
      setShowDatePicker(true);
      return;
    }

    if (lower === 'need help' || lower === 'need help?') {
      setShowSupportPanel(true);
      return;
    }

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: trimmed }
    ];

    setMessages(nextMessages);
    setInputText('');
    setLoading(true);
    setError(null);
    setAppliedNotice(false);
    setShowDatePicker(false);
    setIsScrolledUp(false);

    try {
      // Exclude local non-Gemini messages from history sent to Gemini
      const geminiHistory = nextMessages.filter(
        m => m.content !== 'Great — I have your event details. How should our team contact you?'
      );
      const response = await sendAiChatMessage(geminiHistory, extractedDetails || undefined);

      if (response.extracted) {
        setExtractedDetails(response.extracted);
      }
      setIsReadyForReview(Boolean(response.isReadyForReview));
      setSuggestedStep(response.suggestedStep || 4);

      if (response.isReadyForReview) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: response.assistantMessage },
          {
            role: 'assistant',
            content: 'Great — I have your event details. How should our team contact you?'
          }
        ]);
        setShowContactPanel(true);
        setQuickReplies(
          isContactComplete ? ['Review details in form'] : ['Add contact details']
        );
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: response.assistantMessage }
        ]);
        setQuickReplies(response.quickReplies && response.quickReplies.length > 0 ? response.quickReplies : []);
      }
    } catch (err: any) {
      const friendly = resolveFriendlyError(err);
      setError(friendly);
      setShowSupportPanel(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryLastMessage = () => {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
      const lastIndex = messages.lastIndexOf(lastUserMessage);
      const subMessages = messages.slice(0, lastIndex + 1);
      const geminiSubMessages = subMessages.filter(
        m => m.content !== 'Great — I have your event details. How should our team contact you?'
      );
      setLoading(true);
      setError(null);
      sendAiChatMessage(geminiSubMessages, extractedDetails || undefined)
        .then(response => {
          if (response.extracted) {
            setExtractedDetails(response.extracted);
          }
          setIsReadyForReview(Boolean(response.isReadyForReview));
          setSuggestedStep(response.suggestedStep || 4);

          if (response.isReadyForReview) {
            setMessages([
              ...subMessages,
              { role: 'assistant', content: response.assistantMessage },
              {
                role: 'assistant',
                content: 'Great — I have your event details. How should our team contact you?'
              }
            ]);
            setShowContactPanel(true);
            setQuickReplies(
              isContactComplete ? ['Review details in form'] : ['Add contact details']
            );
          } else {
            setMessages([
              ...subMessages,
              { role: 'assistant', content: response.assistantMessage }
            ]);
            setQuickReplies(response.quickReplies && response.quickReplies.length > 0 ? response.quickReplies : []);
          }
        })
        .catch(err => {
          const friendly = resolveFriendlyError(err);
          setError(friendly);
          setShowSupportPanel(true);
        })
        .finally(() => setLoading(false));
    } else {
      handleSendMessage(INITIAL_QUICK_REPLIES[0]);
    }
  };

  // Review details action: validates contact info and navigates to Step 4 Review
  const handleReviewDetails = () => {
    if (!extractedDetails) return;
    setContactError('');

    if (!hasContactPhone && !hasContactEmail) {
      setShowContactPanel(true);
      setContactError('Enter at least a phone number or email address so we can contact you.');
      return;
    }
    if (hasContactPhone && !isPhoneValid) {
      setShowContactPanel(true);
      setContactError('Please enter a valid phone number (7-15 digits).');
      return;
    }
    if (hasContactEmail && !isEmailValid) {
      setShowContactPanel(true);
      setContactError('Please enter a valid email address.');
      return;
    }

    onApplyDetails(
      extractedDetails,
      4,
      {
        phone: contactPhone.trim(),
        email: contactEmail.trim()
      }
    );
    setAppliedNotice(true);
    handleManualRedirect();
  };

  const handleResetChat = () => {
    setMessages([{ role: 'assistant', content: INITIAL_GREETING }]);
    setQuickReplies(INITIAL_QUICK_REPLIES);
    setExtractedDetails(null);
    setIsReadyForReview(false);
    setSuggestedStep(1);
    setInputText('');
    setError(null);
    setShowSupportPanel(false);
    setAppliedNotice(false);
    setShowDatePicker(false);
    setShowContactPanel(false);
    setContactError('');
    setIsScrolledUp(false);
  };

  // Issue 3: Inline Date Picker actions
  const handleConfirmDate = () => {
    setDatePickerError('');
    if (pickerMode === 'single') {
      if (!singleDate) {
        setDatePickerError('Please select a date.');
        return;
      }
      handleSendMessage(singleDate);
    } else {
      if (!rangeStart) {
        setDatePickerError('Please select a start date.');
        return;
      }
      if (!rangeEnd) {
        setDatePickerError('Please select an end date.');
        return;
      }
      if (rangeEnd < rangeStart) {
        setDatePickerError('End date must be on or after start date.');
        return;
      }
      handleSendMessage(`${rangeStart} to ${rangeEnd}`);
    }
    setShowDatePicker(false);
  };

  const handleSelectToday = () => {
    const today = getTodayDateStr();
    setPickerMode('single');
    setSingleDate(today);
    setDatePickerError('');
  };

  const handleSelectThisWeekend = () => {
    const weekend = getThisWeekendDateRange();
    setPickerMode('range');
    setRangeStart(weekend.start);
    setRangeEnd(weekend.end);
    setDatePickerError('');
  };

  return (
    <div
      role="region"
      aria-label="Plan with AI"
      className="card border-indigo-100 bg-gradient-to-b from-indigo-50/50 via-white to-white shadow-soft"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100/70 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">
              Plan with AI Event Assistant
            </h2>
            <p className="text-xs text-slate-500">
              Conversational planning with instant form pre-filling.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSupportPanel(prev => !prev)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
          >
            Need help?
          </button>
          <button
            type="button"
            onClick={handleResetChat}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
          >
            Reset chat
          </button>
          <button
            type="button"
            onClick={handleManualRedirect}
            className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
          >
            Skip to manual form ↓
          </button>
        </div>
      </div>

      {/* Applied Notice: explicitly tells user details are added and must be reviewed before final posting */}
      {appliedNotice && (
        <div
          role="status"
          className="mt-4 flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-900"
        >
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-indigo-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>
              <strong>Details added to the form.</strong> Please review and post your requirement below.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAppliedNotice(false)}
            className="font-semibold hover:underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Issue 1: Chat Messages Stream with internal scrolling and jump-to-latest button */}
      <div className="relative mt-4">
        <div
          ref={chatContainerRef}
          onScroll={handleContainerScroll}
          className="flex max-h-80 flex-col gap-3 overflow-y-auto rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 sm:p-5"
        >
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white shadow-xs">
                  AI
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-xs ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-2.5">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
                AI
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-none border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-xs">
                <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-500" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-600" style={{ animationDelay: '300ms' }} />
                <span className="ml-1 text-xs text-slate-400">GoPratle assistant is thinking...</span>
              </div>
            </div>
          )}

          {/* Local Contact Details Panel in Chat */}
          {showContactPanel && (
            <div
              role="region"
              aria-label="Contact details"
              className="mt-1 rounded-2xl border border-indigo-200 bg-white p-4 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    How should our team contact you?
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Enter at least one contact method.
                  </p>
                </div>
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                  Direct Contact
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="chat-contact-phone" className="block text-[11px] font-medium text-slate-600 mb-1">
                    Phone number
                  </label>
                  <input
                    id="chat-contact-phone"
                    type="tel"
                    value={contactPhone}
                    onChange={e => {
                      setContactPhone(e.target.value);
                      setContactError('');
                    }}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label htmlFor="chat-contact-email" className="block text-[11px] font-medium text-slate-600 mb-1">
                    Email address
                  </label>
                  <input
                    id="chat-contact-email"
                    type="email"
                    value={contactEmail}
                    onChange={e => {
                      setContactEmail(e.target.value);
                      setContactError('');
                    }}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {contactError && (
                <div role="alert" className="text-[11px] font-medium text-rose-600">
                  {contactError}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                <span className="text-[11px] text-slate-400">
                  {isContactComplete ? '✓ Contact method provided' : 'Phone, email, or both required'}
                </span>

                {isContactComplete && (
                  <button
                    type="button"
                    onClick={handleReviewDetails}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <span>Continue to review →</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Floating Jump-to-Latest Button */}
        {isScrolledUp && (
          <button
            type="button"
            onClick={() => scrollChatToBottom(true)}
            className="absolute bottom-3 right-4 z-10 inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition hover:bg-indigo-700"
          >
            <span>↓ Jump to latest</span>
          </button>
        )}
      </div>

      {/* Extracted Details Card */}
      {extractedDetails && (isReadyForReview || extractedDetails.eventType || extractedDetails.eventName) && (
        <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                {isReadyForReview ? 'Ready to Review in Form' : 'Details Captured for Form'}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-700">
                {extractedDetails.eventName && (
                  <span className="inline-flex items-center rounded-md bg-white px-2 py-0.5 font-medium border border-indigo-100">
                    {extractedDetails.eventName}
                  </span>
                )}
                {extractedDetails.eventType && (
                  <span className="inline-flex items-center rounded-md bg-white px-2 py-0.5 font-medium border border-indigo-100">
                    Type: {extractedDetails.eventType}
                  </span>
                )}
                {extractedDetails.startDate && (
                  <span className="inline-flex items-center rounded-md bg-white px-2 py-0.5 font-medium border border-indigo-100">
                    Date: {extractedDetails.startDate}
                    {extractedDetails.dateType === 'range' && extractedDetails.endDate
                      ? ` to ${extractedDetails.endDate}`
                      : ''}
                  </span>
                )}
                {extractedDetails.location && (
                  <span className="inline-flex items-center rounded-md bg-white px-2 py-0.5 font-medium border border-indigo-100">
                    City: {extractedDetails.location}
                  </span>
                )}
                {extractedDetails.category && (
                  <span className="inline-flex items-center rounded-md bg-indigo-600 px-2 py-0.5 font-semibold text-white">
                    Category: {extractedDetails.category}
                  </span>
                )}
                {extractedDetails.details?.budget && (
                  <span className="inline-flex items-center rounded-md bg-white px-2 py-0.5 font-medium border border-indigo-100">
                    Budget: {formatBudgetDisplay(extractedDetails.details.budget)}
                  </span>
                )}
              </div>
            </div>

            {isContactComplete ? (
              <button
                type="button"
                onClick={handleReviewDetails}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Review details in form →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowContactPanel(true);
                  scrollChatToBottom(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Add contact details →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Issue 3: Inline Accessible Date Picker */}
      {showDatePicker && (
        <div
          role="region"
          aria-label="Pick event date from calendar"
          className="mt-3 rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">Select Event Date</span>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 text-[11px] font-medium">
              <button
                type="button"
                onClick={() => {
                  setPickerMode('single');
                  setDatePickerError('');
                }}
                className={`rounded-md px-2.5 py-1 transition ${
                  pickerMode === 'single'
                    ? 'bg-white font-semibold text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Single date
              </button>
              <button
                type="button"
                onClick={() => {
                  setPickerMode('range');
                  setDatePickerError('');
                }}
                className={`rounded-md px-2.5 py-1 transition ${
                  pickerMode === 'range'
                    ? 'bg-white font-semibold text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Date range
              </button>
            </div>
          </div>

          {pickerMode === 'single' ? (
            <div>
              <label htmlFor="inline-single-date" className="block text-[11px] font-medium text-slate-600 mb-1">
                Event date
              </label>
              <input
                id="inline-single-date"
                type="date"
                value={singleDate}
                onChange={e => {
                  setSingleDate(e.target.value);
                  setDatePickerError('');
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="inline-start-date" className="block text-[11px] font-medium text-slate-600 mb-1">
                  Start date
                </label>
                <input
                  id="inline-start-date"
                  type="date"
                  value={rangeStart}
                  onChange={e => {
                    setRangeStart(e.target.value);
                    setDatePickerError('');
                  }}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label htmlFor="inline-end-date" className="block text-[11px] font-medium text-slate-600 mb-1">
                  End date
                </label>
                <input
                  id="inline-end-date"
                  type="date"
                  value={rangeEnd}
                  onChange={e => {
                    setRangeEnd(e.target.value);
                    setDatePickerError('');
                  }}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 shadow-xs focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
          )}

          {datePickerError && (
            <p className="text-[11px] font-medium text-rose-600">{datePickerError}</p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={handleSelectToday}
                className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                Today
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={handleSelectThisWeekend}
                className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                This weekend
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDatePicker(false)}
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDate}
                className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700"
              >
                Set date
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Reply Chips */}
      {!loading && (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Suggested replies:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {quickReplies.map((reply, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSendMessage(reply)}
                className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-medium text-indigo-700 shadow-xs transition hover:bg-indigo-50 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {reply}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowDatePicker(true)}
              className="rounded-full border border-indigo-300 bg-indigo-50/70 px-3 py-1 text-xs font-semibold text-indigo-800 shadow-xs transition hover:bg-indigo-100"
            >
              Pick from calendar 📅
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage(SAMPLE_BRIEF)}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Try sample brief
            </button>
            <button
              type="button"
              onClick={() => setShowSupportPanel(true)}
              className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 transition hover:bg-amber-100"
            >
              Need help?
            </button>
          </div>
        </div>
      )}

      {/* Input Row */}
      <form
        className="mt-4 flex gap-2"
        onSubmit={e => {
          e.preventDefault();
          handleSendMessage(inputText);
        }}
      >
        <input
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="Type your event brief or answer here (e.g. DJ in Bangalore next Saturday)..."
          disabled={loading}
          className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 shadow-xs transition placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !inputText.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          <span>Send</span>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </form>

      {/* Error & Fallback Panel */}
      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-xs text-rose-800 space-y-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-rose-950">{error.title}</p>
              <p className="mt-0.5">{error.message}</p>
            </div>
            {error.code && (
              <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-mono text-rose-700">
                {error.code}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {error.isRetryable && (
              <button
                type="button"
                onClick={handleRetryLastMessage}
                disabled={loading}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-rose-700 disabled:opacity-50"
              >
                Retry
              </button>
            )}
            <button
              type="button"
              onClick={handleManualRedirect}
              className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-900 shadow-xs transition hover:bg-rose-50"
            >
              Continue manually
            </button>
          </div>
        </div>
      )}

      {/* Fallback Support Panel */}
      {showSupportPanel && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 sm:p-5 text-slate-800 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-amber-200/80 text-amber-800">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="text-sm font-semibold text-amber-950">
                Need help planning your event? Our team can help you complete your brief.
              </h3>
              <p className="text-xs text-amber-900">
                <span className="font-semibold text-amber-950">Demo support:</span>{' '}
                <a
                  href="tel:+919000000000"
                  className="font-bold underline text-amber-950 hover:text-amber-800"
                >
                  +91 90000 00000
                </a>
              </p>
              <p className="text-[11px] text-amber-700 pt-0.5">
                Note: This is an event-assistant demo contact line. You can also skip AI and post your requirement directly.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSupportPanel(false)}
              className="text-amber-600 hover:text-amber-800 text-xs font-semibold"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 flex items-center justify-end border-t border-amber-200/60 pt-2.5">
            <button
              type="button"
              onClick={handleManualRedirect}
              className="inline-flex items-center gap-1 rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-amber-700"
            >
              Continue with manual form →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
