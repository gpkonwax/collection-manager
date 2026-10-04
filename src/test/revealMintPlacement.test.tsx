import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { PackRevealDialog, type RevealCard } from '@/components/simpleassets/PackRevealDialog';

const demoCards: RevealCard[] = [
  { asset_id: 'demo-1', name: 'Card A', image: null, rarity: '', mintLabel: '#203' },
  { asset_id: 'demo-2', name: 'Card B', image: null, rarity: '', mintLabel: '#356' },
];

function renderDialog() {
  return render(
    <PackRevealDialog
      open
      onOpenChange={() => {}}
      packSymbol="GPK"
      packLabel="GPK Pack"
      packImage={null}
      accountName="tester"
      preOpenUnboxingIds={new Set()}
      onComplete={() => {}}
      demoCards={demoCards}
      onDemoCollect={() => {}}
    />,
  );
}

// jsdom can't run the real flip/animation timing; we just assert the mint pill
// is an overlay anchored to the top of the card wrapper, not a block beneath it.
describe('reveal mint label placement', () => {
  it('renders mint labels as top overlays inside the card wrapper', async () => {
    const { container } = renderDialog();
    await waitFor(() => {
      expect(container.textContent).toContain('#203');
    });
    const pills = Array.from(container.querySelectorAll('span')).filter((s) => s.textContent === '#203');
    expect(pills.length).toBe(1);
    const pillHolder = pills[0].parentElement!;
    expect(pillHolder.className).toContain('absolute');
    expect(pillHolder.className).toContain('top-1');
    expect(pillHolder.className).not.toContain('py-1 mt-2');
    // The overlay must live inside the card's relative wrapper, which also
    // contains the flip container (aspect-[2/3]).
    const wrapper = pillHolder.parentElement!;
    expect(wrapper.querySelector('.aspect-\\[2\\/3\\]')).not.toBeNull();
    expect(wrapper.className).toContain('relative');
  });
});
