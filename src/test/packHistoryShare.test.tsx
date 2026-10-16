import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PackHistoryDialog } from '@/components/simpleassets/PackHistoryDialog';
import { clearPackHistory, PACK_HISTORY_ENVELOPE_TYPE, type PackHistoryEntry } from '@/lib/packOpenHistory';

// The dialog pulls in media/mirror helpers that jsdom can't run; the test only
// cares about which openings are listed after a JSON load.
vi.mock('@/components/simpleassets/IpfsMedia', () => ({
  IpfsMedia: ({ alt }: { alt: string }) => <span data-testid="media">{alt}</span>,
}));
vi.mock('@/lib/gpkPackMeta', () => ({ resolvePackArt: () => null }));
vi.mock('@/lib/thumbCache', () => ({ warmThumbs: () => Promise.resolve(), clearThumbs: () => Promise.resolve() }));
vi.mock('@/hooks/useIpfsMedia', () => ({ clearIpfsUrlCache: () => {} }));
vi.mock('@/lib/packOpenHistoryChain', () => ({
  exportPackHistoryFromChain: () => Promise.resolve({ entries: [], warnings: [] }),
  HistoryUnavailableError: class extends Error {},
}));
vi.mock('@/assets/simpleassets-logo.png', () => ({ default: 'sa.png' }));
vi.mock('@/assets/atomicassets-logo.png', () => ({ default: 'aa.png' }));

// jsdom's File has no .text(); the dialog reads files with it.
if (!File.prototype.text) {
  File.prototype.text = function text(this: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

const entry = (account: string, txId: string): PackHistoryEntry => ({
  txId,
  account,
  source: 'simpleassets',
  packId: 'GPK',
  packName: 'GPK Series 1 Pack',
  packImage: null,
  openedAt: 1700000000000,
  matchers: [],
  cards: [{ name: 'Nasty Nick', image: null, cardid: '1', side: 'a', variant: 'base' }],
});

const fileWith = (entries: PackHistoryEntry[]) =>
  new File(
    [JSON.stringify({ type: PACK_HISTORY_ENVELOPE_TYPE, version: 1, entries })],
    'history.json',
    { type: 'application/json' },
  );

const renderDialog = () =>
  render(
    <PackHistoryDialog
      open
      onOpenChange={() => {}}
      account="me.wam"
      onReplay={() => {}}
    />,
  );

const loadFile = async (file: File) => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
};

describe('pack history sharing', () => {
  beforeEach(() => {
    clearPackHistory();
  });

  it("shows another account's loaded JSON as a session-only shared view without saving it", async () => {
    renderDialog();
    await loadFile(fileWith([entry('friend.wam', 'tx-friend-1'), entry('friend.wam', 'tx-friend-2')]));

    // The shared banner appears and both of the friend's openings are listed.
    await screen.findByText(/Back to my history/);
    await waitFor(() => {
      expect(document.body.textContent).toContain('2 openings from the loaded file');
    });

    // Drill into the pack group: the entries carry the friend's account, and a
    // Replay button is offered for each.
    fireEvent.click(screen.getByText('2 packs opened'));
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Replay/ }).length).toBe(2);
    });

    // Nothing of the friend's history was merged into this device's store.
    const { getPackHistory } = await import('@/lib/packOpenHistory');
    expect(getPackHistory('friend.wam')).toHaveLength(0);
    expect(getPackHistory('me.wam')).toHaveLength(0);
  });

  it('returns to the device history via Back to my history', async () => {
    const { recordPackOpen } = await import('@/lib/packOpenHistory');
    recordPackOpen(entry('me.wam', 'tx-mine-1'));
    renderDialog();

    await waitFor(() => expect(document.body.textContent).toContain('1 pack opened'));
    await loadFile(fileWith([entry('friend.wam', 'tx-friend-1')]));
    await screen.findByText(/Back to my history/);
    await waitFor(() => expect(document.body.textContent).toContain('1 opening from the loaded file'));

    fireEvent.click(screen.getByText('Back to my history'));
    await waitFor(() => {
      expect(document.body.textContent).toContain('1/500 stored');
      expect(screen.queryByText('Back to my history')).toBeNull();
    });
  });
});
