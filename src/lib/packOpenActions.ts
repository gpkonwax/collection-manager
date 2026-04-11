import type { AtomicPack } from '@/hooks/useGpkAtomicPacks';

interface ActionAuth {
  actor: string;
  permission: string;
}

/**
 * Build the blockchain actions needed to open a pack based on its openMode.
 */
export function buildOpenPackActions(
  pack: AtomicPack,
  assetId: string,
  actor: string,
  auth: ActionAuth[],
) {
  const config = pack.packConfig;

  if (config.openMode === 'unbox_nft') {
    // 2-action flow: transfer to unbox.nft + call unbox
    const transferTo = config.transferTo || 'unbox.nft';
    const memo = config.transferMemo || 'open pack';
    const collectionName = config.collectionName || 'gpk.topps';

    return [
      {
        account: 'atomicassets',
        name: 'transfer',
        authorization: auth,
        data: {
          from: actor,
          to: transferTo,
          asset_ids: [assetId],
          memo,
        },
      },
      {
        account: transferTo,
        name: 'unbox',
        authorization: auth,
        data: {
          collection_name: collectionName,
          from: actor,
          box_id: pack.templateId,
        },
      },
    ];
  }

  // Default: single transfer action (gpkcrashpack, burnieunpack, atomicpacksx)
  return [
    {
      account: 'atomicassets',
      name: 'transfer',
      authorization: auth,
      data: {
        from: actor,
        to: pack.unpackContract,
        asset_ids: [assetId],
        memo: 'unbox',
      },
    },
  ];
}
