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

  it('sends typed message from the input field', async () => {
    const mockResponse: AiChatResponse = {
      assistantMessage: 'Got it. Approximately how many guests are you expecting?',
      quickReplies: ['50 guests', '100 guests', '200+ guests'],
      extracted: {
        eventType: 'Corporate summit',
        location: 'Hyderabad',
        category: 'planner'
      },
      missingFields: ['guestCount'],
      isReadyForReview: false,
      suggestedStep: 1
    };

    const spySend = vi.spyOn(api, 'sendAiChatMessage').mockResolvedValueOnce(mockResponse);

    render(<AiAssistant onApplyDetails={vi.fn()} />);

    const input = screen.getByPlaceholderText(/type your event brief or answer here/i);
    fireEvent.change(input, { target: { value: 'Corporate summit in Hyderabad next month' } });

    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(spySend).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(
        screen.getByText(/approximately how many guests are you expecting\?/i)
      ).toBeInTheDocument();
    });
  });

  it('shows "Review event details" button and pre-fills form on click', async () => {
    const onApplyDetails = vi.fn();

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
      assistantMessage: 'I have all the details! Click Review event details below to proceed.',
      quickReplies: [],
      extracted: mockExtracted,
      missingFields: [],
      isReadyForReview: true,
      suggestedStep: 2
    };

    vi.spyOn(api, 'sendAiChatMessage').mockResolvedValueOnce(mockResponse);

    render(<AiAssistant onApplyDetails={onApplyDetails} />);

    const birthdayBtn = screen.getByRole('button', { name: /birthday party/i });
    fireEvent.click(birthdayBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /review event details/i })).toBeInTheDocument();
    });

    const reviewBtn = screen.getByRole('button', { name: /review event details/i });
    fireEvent.click(reviewBtn);

    expect(onApplyDetails).toHaveBeenCalledWith(mockExtracted, 2);
    expect(screen.getByText(/ai pre-filled your event requirement details!/i)).toBeInTheDocument();
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
