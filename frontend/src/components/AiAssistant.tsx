'use client';

import { useEffect, useRef, useState } from 'react';
import { sendAiChatMessage } from '@/lib/api';
import type { AiChatResponse, Category, ChatMessage } from '@/types/requirement';

type Props = {
  onApplyDetails: (data: AiChatResponse['extracted'], targetStep: number) => void;
  onContinueManually?: () => void;
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

export function AiAssistant({ onApplyDetails, onContinueManually }: Props) {
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

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, error, showSupportPanel]);

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

    if (trimmed.toLowerCase() === 'need help' || trimmed.toLowerCase() === 'need help?') {
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

    try {
      const response = await sendAiChatMessage(nextMessages, extractedDetails || undefined);

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: response.assistantMessage }
      ]);
      setQuickReplies(response.quickReplies && response.quickReplies.length > 0 ? response.quickReplies : []);
      if (response.extracted) {
        setExtractedDetails(response.extracted);
      }
      setIsReadyForReview(Boolean(response.isReadyForReview));
      setSuggestedStep(response.suggestedStep || 1);
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
      // Retry with the current conversation history up to the last user message
      const lastIndex = messages.lastIndexOf(lastUserMessage);
      const subMessages = messages.slice(0, lastIndex + 1);
      setLoading(true);
      setError(null);
      sendAiChatMessage(subMessages, extractedDetails || undefined)
        .then(response => {
          setMessages([
            ...subMessages,
            { role: 'assistant', content: response.assistantMessage }
          ]);
          setQuickReplies(response.quickReplies && response.quickReplies.length > 0 ? response.quickReplies : []);
          if (response.extracted) {
            setExtractedDetails(response.extracted);
          }
          setIsReadyForReview(Boolean(response.isReadyForReview));
          setSuggestedStep(response.suggestedStep || 1);
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

  const handleReviewDetails = () => {
    if (!extractedDetails) return;
    onApplyDetails(extractedDetails, suggestedStep);
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

      {/* Applied Notice */}
      {appliedNotice && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>
              <strong>AI pre-filled your event requirement details!</strong> Review and edit any field below.
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

      {/* Chat Messages Stream */}
      <div className="mt-4 flex max-h-80 flex-col gap-3 overflow-y-auto rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 sm:p-5">
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

        <div ref={messagesEndRef} />
      </div>

      {/* Extracted Details / Review Action Banner */}
      {extractedDetails && (isReadyForReview || extractedDetails.eventType || extractedDetails.eventName) && (
        <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                {isReadyForReview ? 'Ready to Review Details' : 'Details Captured So Far'}
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
              </div>
            </div>

            <button
              type="button"
              onClick={handleReviewDetails}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Review event details →
            </button>
          </div>
        </div>
      )}

      {/* Quick Reply Chips */}
      {!loading && quickReplies.length > 0 && (
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
