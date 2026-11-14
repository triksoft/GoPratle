import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiAssistant } from './AiAssistant';
import * as api from '@/lib/api';

describe('AiAssistant Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the Plan with AI area with sample prompt trigger', () => {
    render(<AiAssistant onApplyDetails={vi.fn()} />);

    expect(screen.getByRole('region', { name: /plan with ai/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/i need a dj and decorator/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate event details/i })).toBeInTheDocument();
  });

  it('populates textarea when clicking "Try sample brief"', () => {
    render(<AiAssistant onApplyDetails={vi.fn()} />);

    const sampleBtn = screen.getByRole('button', { name: /try sample brief/i });
    fireEvent.click(sampleBtn);

    const textarea = screen.getByPlaceholderText(/i need a dj and decorator/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain('Bangalore next Saturday');
  });

  it('shows loading state while processing and applies extracted details on success', async () => {
    const onApplyDetails = vi.fn();

    const mockExtracted = {
      eventName: "Rohan's Birthday",
      eventType: 'Birthday party',
      dateType: 'single' as const,
      startDate: '2026-11-20',
      location: 'Bangalore',
      venue: '',
      category: 'performer' as const,
      details: { performanceType: 'DJ', durationMinutes: '180', equipmentProvided: 'No, provider should bring it' },
      notes: ''
    };

    vi.spyOn(api, 'extractEventDetails').mockResolvedValueOnce({
      extracted: mockExtracted,
      missingFields: [],
      suggestedStep: 2
    });

    render(<AiAssistant onApplyDetails={onApplyDetails} />);

    const textarea = screen.getByPlaceholderText(/i need a dj and decorator/i);
    fireEvent.change(textarea, { target: { value: 'Need a DJ for birthday in Bangalore' } });

    const generateBtn = screen.getByRole('button', { name: /generate event details/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(onApplyDetails).toHaveBeenCalledWith(mockExtracted, 2);
    });

    expect(screen.getByText(/ai pre-filled your event requirement details!/i)).toBeInTheDocument();
  });

  it('handles quota limit 429 by displaying exact friendly message, retaining description, and offering a single continue manually button', async () => {
    const onContinueManually = vi.fn();

    const quotaError = new api.ApiError(
      'The AI assistant has temporarily reached its usage limit. Please complete the event form manually.',
      'AI_LIMIT_REACHED',
      429
    );
    vi.spyOn(api, 'extractEventDetails').mockRejectedValueOnce(quotaError);

    render(<AiAssistant onApplyDetails={vi.fn()} onContinueManually={onContinueManually} />);

    const testDescription = 'I need a decorator for an anniversary celebration.';
    const textarea = screen.getByPlaceholderText(/i need a dj and decorator/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: testDescription } });

    const generateBtn = screen.getByRole('button', { name: /generate event details/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/the ai assistant has temporarily reached its usage limit\. please complete the event form manually\./i)
      ).toBeInTheDocument();
    });

    // Retains typed text
    expect(textarea.value).toBe(testDescription);

    // Exactly one "Continue manually" button in the UI
    const continueButtons = screen.getAllByRole('button', { name: /continue manually/i });
    expect(continueButtons).toHaveLength(1);
    fireEvent.click(continueButtons[0]);
    expect(onContinueManually).toHaveBeenCalled();
  });

  it('displays friendly message for missing/unconfigured Gemini key without secrets', async () => {
    const configError = new api.ApiError(
      'The AI assistant is currently not configured. Please complete the event form manually.',
      'AI_CONFIG_MISSING',
      503
    );
    vi.spyOn(api, 'extractEventDetails').mockRejectedValueOnce(configError);

    render(<AiAssistant onApplyDetails={vi.fn()} />);

    const textarea = screen.getByPlaceholderText(/i need a dj and decorator/i);
    fireEvent.change(textarea, { target: { value: 'Wedding in Delhi' } });

    fireEvent.click(screen.getByRole('button', { name: /generate event details/i }));

    await waitFor(() => {
      expect(screen.getByText('AI Assistant Not Configured')).toBeInTheDocument();
      expect(
        screen.getByText(/the ai assistant is currently not configured\. please complete the event form manually\./i)
      ).toBeInTheDocument();
    });

    // Does not expose secrets or API keys
    expect(screen.queryByText(/key|secret|token/i)).not.toBeInTheDocument();
  });

  it('displays friendly retryable message on network timeout failure', async () => {
    const timeoutError = new api.ApiError(
      'The AI request timed out or encountered a network issue. You can retry or complete the form manually.',
      'AI_NETWORK_ERROR',
      504
    );
    vi.spyOn(api, 'extractEventDetails').mockRejectedValueOnce(timeoutError);

    render(<AiAssistant onApplyDetails={vi.fn()} />);

    const textarea = screen.getByPlaceholderText(/i need a dj and decorator/i);
    fireEvent.change(textarea, { target: { value: 'Tech summit in Pune' } });

    fireEvent.click(screen.getByRole('button', { name: /generate event details/i }));

    await waitFor(() => {
      expect(screen.getByText('Connection Timed Out')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry ai/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue manually/i })).toBeInTheDocument();
    });
  });

  it('displays friendly message for invalid AI response', async () => {
    const parseError = new api.ApiError(
      'The AI assistant could not structure the event details. Please complete the event form manually.',
      'AI_PARSE_FAILED',
      422
    );
    vi.spyOn(api, 'extractEventDetails').mockRejectedValueOnce(parseError);

    render(<AiAssistant onApplyDetails={vi.fn()} />);

    const textarea = screen.getByPlaceholderText(/i need a dj and decorator/i);
    fireEvent.change(textarea, { target: { value: 'Random unclear event' } });

    fireEvent.click(screen.getByRole('button', { name: /generate event details/i }));

    await waitFor(() => {
      expect(screen.getByText('Could Not Structure Brief')).toBeInTheDocument();
      expect(
        screen.getByText(/the ai assistant could not structure the event details\. please complete the event form manually\./i)
      ).toBeInTheDocument();
    });
  });
});
