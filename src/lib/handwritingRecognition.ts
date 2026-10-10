export interface HandwritingRecognitionResult { text: string; confidence: number }

export async function recognizeHandwriting(image: string): Promise<HandwritingRecognitionResult> {
  const response = await fetch('/functions/v1/recognize-handwriting', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image }),
  });
  if (!response.ok) throw new Error('Recognition is unavailable. Type the text instead.');
  const result = await response.json() as Partial<HandwritingRecognitionResult>;
  return { text: typeof result.text === 'string' ? result.text.trim() : '', confidence: typeof result.confidence === 'number' ? result.confidence : 0 };
}