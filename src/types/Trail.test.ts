import { describe, it, expect } from 'vitest';
import {
  isDirtPark,
  isBikePark,
  isTrail,
  isAnyTrailType,
  Trail,
  SingleTrail,
  BikePark,
  DirtPark,
} from './Trail';

const baseFields = {
  name: 'Test Trail',
  id: '1',
  creator: 'tester',
  url: '',
  instagram: '',
  latitude: 48.0,
  longitude: 11.5,
  spotcheck: '',
  approved: true,
  created_at: '2024-01-01',
};

const singleTrail: SingleTrail = { ...baseFields, type: 'trail' };
const bikePark: BikePark = { ...baseFields, type: 'bikepark' };
const dirtPark: DirtPark = { ...baseFields, type: 'dirtpark', pumptrack: true, dirtpark: false };

describe('isTrail', () => {
  it('returns true for a SingleTrail', () => expect(isTrail(singleTrail)).toBe(true));
  it('returns false for a BikePark', () => expect(isTrail(bikePark)).toBe(false));
  it('returns false for a DirtPark', () => expect(isTrail(dirtPark)).toBe(false));
});

describe('isBikePark', () => {
  it('returns true for a BikePark', () => expect(isBikePark(bikePark)).toBe(true));
  it('returns false for a SingleTrail', () => expect(isBikePark(singleTrail)).toBe(false));
  it('returns false for a DirtPark', () => expect(isBikePark(dirtPark)).toBe(false));
});

describe('isDirtPark', () => {
  it('returns true for a DirtPark', () => expect(isDirtPark(dirtPark)).toBe(true));
  it('returns false for a SingleTrail', () => expect(isDirtPark(singleTrail)).toBe(false));
  it('returns false for a BikePark', () => expect(isDirtPark(bikePark)).toBe(false));
});

describe('isAnyTrailType', () => {
  it('accepts all valid types', () => {
    expect(isAnyTrailType('trail')).toBe(true);
    expect(isAnyTrailType('bikepark')).toBe(true);
    expect(isAnyTrailType('dirtpark')).toBe(true);
  });

  it('rejects unknown strings', () => {
    expect(isAnyTrailType('park')).toBe(false);
    expect(isAnyTrailType('')).toBe(false);
    expect(isAnyTrailType('TRAIL')).toBe(false);
  });
});
