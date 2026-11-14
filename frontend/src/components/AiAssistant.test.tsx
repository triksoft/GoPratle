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

  it('handles quota limit 429 by displaying exact friendly message, retaining description, and offering continue manually', async () => {
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

    // Offers "Continue manually" action
    const continueBtn = screen.getAllByRole('button', { name: /continue manually/i })[0];
    fireEvent.click(continueBtn);
    expect(onContinueManually).toHaveBeenCalled();
  });
});
