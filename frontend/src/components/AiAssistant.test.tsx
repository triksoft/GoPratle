import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiAssistant } from './AiAssistant';
import * as api from '@/lib/api';
import type { AiChatResponse } from '@/types/requirement';

describe('AiAssistant Guided Chat Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the guided chat with initial greeting and quick reply choices', () => {
    render(<AiAssistant onApplyDetails={vi.fn()} />);

    expect(screen.getByRole('region', { name: /plan with ai/i })).toBeInTheDocument();
    expect(
      screen.getByText(/hi! i’m your gopratle event assistant\. what are you planning\?/i)
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /birthday party/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /wedding/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /corporate event/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /concert \/ performance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /other/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pick from calendar/i })).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText(/type your event brief or answer here/i)
    ).toBeInTheDocument();
  });

  it('sends message when clicking a quick-reply choice and displays assistant response', async () => {
    const mockResponse: AiChatResponse = {
      assistantMessage: 'Great! What date and city are you planning this birthday party for?',
      quickReplies: ['Next Saturday in Bangalore', 'Next month in Mumbai'],
      extracted: {
        eventType: 'Birthday party',
        category: 'planner',
        details: {}
      },
      missingFields: ['startDate', 'location'],
      isReadyForReview: false,
      suggestedStep: 1
    };

    const spySend = vi.spyOn(api, 'sendAiChatMessage').mockResolvedValueOnce(mockResponse);

    render(<AiAssistant onApplyDetails={vi.fn()} />);

    const birthdayBtn = screen.getByRole('button', { name: /birthday party/i });
    fireEvent.click(birthdayBtn);

    expect(spySend).toHaveBeenCalledTimes(1);
    expect(spySend).toHaveBeenCalledWith(
      [
        { role: 'assistant', content: 'Hi! I’m your GoPratle event assistant. What are you planning?' },
        { role: 'user', content: 'Birthday party' }
      ],
      undefined
    );

    await waitFor(() => {
      expect(
        screen.getByText(/great! what date and city are you planning this birthday party for\?/i)
      ).toBeInTheDocument();
    });

    // Renders updated quick replies
    expect(screen.getByRole('button', { name: /next saturday in bangalore/i })).toBeInTheDocument();
  });

  it('shows "Review details in form" button and does NOT submit requirement to POST /api/requirements', async () => {
    const onApplyDetails = vi.fn();
    const createReqSpy = vi.spyOn(api, 'createRequirement').mockResolvedValue({
      message: 'Created',
      requirement: { _id: 'dummy' }
    });

    const mockExtracted = {
      eventName: "Rohan's 30th Birthday",
      eventType: 'Birthday party',
      dateType: 'single' as const,
      startDate: '2026-11-20',
      location: 'Bangalore',
      venue: 'Sky Lounge',
      category: 'performer' as const,
      details: { performanceType: 'DJ', durationMinutes: '180', equipmentProvided: 'No, provider should bring it' },
      notes: ''
    };

    const mockResponse: AiChatResponse = {
      assistantMessage: 'I have all your details! Click Review details in form below to proceed.',
      quickReplies: [],
      extracted: mockExtracted,
      missingFields: [],
      isReadyForReview: true,
      suggestedStep: 1
    };

    vi.spyOn(api, 'sendAiChatMessage').mockResolvedValueOnce(mockResponse);

    render(<AiAssistant onApplyDetails={onApplyDetails} />);

    const birthdayBtn = screen.getByRole('button', { name: /birthday party/i });
    fireEvent.click(birthdayBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /review details in form/i })).toBeInTheDocument();
    });

    const reviewBtn = screen.getByRole('button', { name: /review details in form/i });
    fireEvent.click(reviewBtn);

    // Pre-fills form
    expect(onApplyDetails).toHaveBeenCalledWith(mockExtracted, 1);

    // Explicitly displays review notice
    expect(screen.getByRole('status')).toHaveTextContent(
      /details added to the form/i
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      /please review and post your requirement/i
    );

    // MUST NOT call createRequirement
    expect(createReqSpy).not.toHaveBeenCalled();
  });

  it('preserves and displays budget range without corrupting into large numbers', async () => {
    const mockExtracted = {
      eventName: 'Grand Wedding',
      eventType: 'Wedding',
      category: 'planner' as const,
      details: {
        budget: '₹1,00,000 – ₹3,00,000',
        guestCount: '250',
        planningScope: 'Full planning'
      }
    };

    const mockResponse: AiChatResponse = {
      assistantMessage: 'Captured budget range!',
      quickReplies: [],
      extracted: mockExtracted,
      missingFields: [],
      isReadyForReview: true,
      suggestedStep: 1
    };

    vi.spyOn(api, 'sendAiChatMessage').mockResolvedValueOnce(mockResponse);

    render(<AiAssistant onApplyDetails={vi.fn()} />);

    const weddingBtn = screen.getByRole('button', { name: /wedding/i });
    fireEvent.click(weddingBtn);

    await waitFor(() => {
      expect(screen.getByText(/budget: ₹1,00,000 – ₹3,00,000/i)).toBeInTheDocument();
    });

    // Does not corrupt into concatenated numbers
    expect(screen.queryByText(/1,00,00,03,00,000/)).not.toBeInTheDocument();
  });

  describe('Inline Accessible Date Picker (Pick from calendar)', () => {
    it('opens date picker and submits single-date selection into conversation', async () => {
      const sendSpy = vi.spyOn(api, 'sendAiChatMessage').mockResolvedValueOnce({
        assistantMessage: 'Date noted.',
        quickReplies: [],
        extracted: {},
        missingFields: [],
        isReadyForReview: false,
        suggestedStep: 1
      });

      render(<AiAssistant onApplyDetails={vi.fn()} />);

      const pickCalendarBtn = screen.getByRole('button', { name: /pick from calendar/i });
      fireEvent.click(pickCalendarBtn);

      expect(screen.getByRole('region', { name: /pick event date from calendar/i })).toBeInTheDocument();

      const dateInput = screen.getByLabelText(/^event date$/i);
      fireEvent.change(dateInput, { target: { value: '2026-11-20' } });

      fireEvent.click(screen.getByRole('button', { name: /set date/i }));

      await waitFor(() => {
        expect(sendSpy).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ role: 'user', content: '2026-11-20' })
          ]),
          undefined
        );
      });
    });

    it('submits date-range selection and validates start before end date', async () => {
      const sendSpy = vi.spyOn(api, 'sendAiChatMessage').mockResolvedValueOnce({
        assistantMessage: 'Date range noted.',
        quickReplies: [],
        extracted: {},
        missingFields: [],
        isReadyForReview: false,
        suggestedStep: 1
      });

      render(<AiAssistant onApplyDetails={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /pick from calendar/i }));

      // Switch to date range mode
      fireEvent.click(screen.getByRole('button', { name: /date range/i }));

      const startInput = screen.getByLabelText(/start date/i);
      const endInput = screen.getByLabelText(/end date/i);

      // Invalidate with end date before start date
      fireEvent.change(startInput, { target: { value: '2026-11-25' } });
      fireEvent.change(endInput, { target: { value: '2026-11-20' } });

      fireEvent.click(screen.getByRole('button', { name: /set date/i }));

      expect(screen.getByText(/end date must be on or after start date/i)).toBeInTheDocument();
      expect(sendSpy).not.toHaveBeenCalled();

      // Fix valid date range
      fireEvent.change(endInput, { target: { value: '2026-11-27' } });
      fireEvent.click(screen.getByRole('button', { name: /set date/i }));

      await waitFor(() => {
        expect(sendSpy).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ role: 'user', content: '2026-11-25 to 2026-11-27' })
          ]),
          undefined
        );
      });
    });

    it('populates dates using quick helper buttons "Today" and "This weekend"', () => {
      render(<AiAssistant onApplyDetails={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /pick from calendar/i }));

      const todayBtn = screen.getByRole('button', { name: /^today$/i });
      fireEvent.click(todayBtn);

      const singleInput = screen.getByLabelText(/^event date$/i) as HTMLInputElement;
      expect(singleInput.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const weekendBtn = screen.getByRole('button', { name: /^this weekend$/i });
      fireEvent.click(weekendBtn);

      const startInput = screen.getByLabelText(/start date/i) as HTMLInputElement;
      const endInput = screen.getByLabelText(/end date/i) as HTMLInputElement;
      expect(startInput.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(endInput.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(endInput.value >= startInput.value).toBe(true);
    });
  });

  it('displays the demo support fallback panel when clicking "Need help"', () => {
    render(<AiAssistant onApplyDetails={vi.fn()} />);

    const helpButtons = screen.getAllByRole('button', { name: /need help/i });
    fireEvent.click(helpButtons[0]);

    expect(
      screen.getByText(/need help planning your event\? our team can help you complete your brief\./i)
    ).toBeInTheDocument();
    expect(screen.getByText(/demo support:/i)).toBeInTheDocument();
    expect(screen.getByText('+91 90000 00000')).toBeInTheDocument();
  });

  it('handles quota limit 429 by displaying exact friendly message, demo support, and continue manually', async () => {
    const onContinueManually = vi.fn();

    const quotaError = new api.ApiError(
      'The AI assistant has temporarily reached its usage limit. Please complete the event form manually.',
      'AI_LIMIT_REACHED',
      429
    );
    vi.spyOn(api, 'sendAiChatMessage').mockRejectedValueOnce(quotaError);

    render(<AiAssistant onApplyDetails={vi.fn()} onContinueManually={onContinueManually} />);

    const input = screen.getByPlaceholderText(/type your event brief or answer here/i);
    fireEvent.change(input, { target: { value: 'Anniversary celebration' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/the ai assistant has temporarily reached its usage limit\. please complete the event form manually\./i)
      ).toBeInTheDocument();
    });

    // Shows fallback demo support panel
    expect(
      screen.getByText(/need help planning your event\? our team can help you complete your brief\./i)
    ).toBeInTheDocument();
    expect(screen.getByText(/demo support:/i)).toBeInTheDocument();
    expect(screen.getByText('+91 90000 00000')).toBeInTheDocument();

    // Offers continue manually
    const continueBtn = screen.getByRole('button', { name: /continue manually/i });
    fireEvent.click(continueBtn);
    expect(onContinueManually).toHaveBeenCalled();
  });

  it('displays friendly message for missing/unconfigured Gemini key without secrets', async () => {
    const configError = new api.ApiError(
      'The AI assistant is currently not configured. Please complete the event form manually.',
      'AI_CONFIG_MISSING',
      503
    );
    vi.spyOn(api, 'sendAiChatMessage').mockRejectedValueOnce(configError);

    render(<AiAssistant onApplyDetails={vi.fn()} />);

    const input = screen.getByPlaceholderText(/type your event brief or answer here/i);
    fireEvent.change(input, { target: { value: 'Wedding in Delhi' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText('AI Assistant Not Configured')).toBeInTheDocument();
      expect(
        screen.getByText(/the ai assistant is currently not configured\. please complete the event form manually\./i)
      ).toBeInTheDocument();
    });

    // Does not expose secrets or API keys
    expect(screen.queryByText(/key|secret|token/i)).not.toBeInTheDocument();
  });

  it('displays friendly retryable message on network timeout failure with Retry button', async () => {
    const timeoutError = new api.ApiError(
      'The AI request timed out or encountered a network issue. You can retry or complete the form manually.',
      'AI_NETWORK_ERROR',
      504
    );
    vi.spyOn(api, 'sendAiChatMessage').mockRejectedValueOnce(timeoutError);

    render(<AiAssistant onApplyDetails={vi.fn()} />);

    const input = screen.getByPlaceholderText(/type your event brief or answer here/i);
    fireEvent.change(input, { target: { value: 'Tech summit in Pune' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText('Connection Timed Out')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^retry$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue manually/i })).toBeInTheDocument();
    });
  });
});
