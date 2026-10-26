import type { RequirementForm } from '@/types/requirement';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

export async function createRequirement(form: RequirementForm) {
  const response = await fetch(`${apiUrl}/api/requirements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': form.clientSubmissionId },
    body: JSON.stringify(form)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message ?? 'We could not submit your requirement. Please try again.');
  return payload as { message: string; requirement: { _id: string }; duplicate?: boolean };
}
