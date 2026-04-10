

## Show card ID + quality in card info area (not on image)

### Change

**`src/components/simpleassets/SimpleAssetCard.tsx`**:

Add the cardid+quality label (e.g. "16a", "45b") into the `CardContent` section below the image, next to existing info like category and asset ID. No overlay on the image.

Insert it as a badge in the existing bottom row, before the `#{asset.id}` span:

```tsx
{asset.cardid && (
  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cheese/20 text-cheese">
    {asset.cardid}{asset.quality?.toLowerCase() || ''}
  </span>
)}
```

Place this inside the `flex items-center justify-between` div (around line 111), within the left-side `flex items-center gap-1` group alongside the category and source badges.

### Files touched
- `src/components/simpleassets/SimpleAssetCard.tsx`

