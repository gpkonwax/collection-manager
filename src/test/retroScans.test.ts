import { describe, it, expect } from 'vitest';
import { getRetroFront, getRetroBack, listAllRetroScanUrls } from '@/lib/retroScans';

const card = (cardid: string, side: string, quality = 'base') => ({ cardid, side, quality });

describe('retro 1985 scans', () => {
  it('maps base fronts for Series 1 and 2', () => {
    expect(getRetroFront(card('1', 'a'))?.fallback).toBe('https://geepeekay.com/gallery/os1/os1_1a.jpg');
    expect(getRetroFront(card('83', 'b'))?.fallback).toBe('https://geepeekay.com/gallery/os2/os2_83b.jpg');
    expect(getRetroFront(card('1', 'a'))?.src).toBe('https://gpk-data.pages.dev/retro/os1/os1_1a.jpg');
  });
  it('never applies to non-base, side c or later series', () => {
    expect(getRetroFront(card('1', 'a', 'prism'))).toBeNull();
    expect(getRetroFront(card('60', 'c'))).toBeNull();
    expect(getRetroFront(card('84', 'a'))).toBeNull();
  });
  it('maps backs, skipping ambiguous or missing ones', () => {
    expect(getRetroBack(card('5', 'b'))).toMatchObject({ landscape: true, fallback: 'https://geepeekay.com/gallery/os1/backs/os1_back_5ab.jpg' });
    expect(getRetroBack(card('29', 'a'))).toBeNull();
    expect(getRetroBack(card('29', 'b'))?.fallback).toContain('os1_back_29b.jpg');
    expect(getRetroBack(card('55', 'a'))).toMatchObject({ landscape: true });
    expect(getRetroBack(card('55', 'a'))?.fallback).toContain('os2_back_55ll.jpg');
    expect(getRetroBack(card('44', 'b'))?.fallback).toContain('os2_back_43_44ll.jpg');
    for (const n of ['42', '46', '47', '48', '50']) expect(getRetroBack(card(n, 'a'))).toBeNull();
  });
  it('lists 240 unique scan files', () => {
    expect(listAllRetroScanUrls()).toHaveLength(240);
  });
});
