import React from 'react';
import { render, screen } from '@testing-library/react';
import { AdminUsers } from './AdminUsers';

const h = vi.hoisted(() => ({
  entries: [] as any[],
  addEmail: vi.fn(async () => true),
  removeEmail: vi.fn(async () => true),
}));

vi.mock('./hooks/useAllowedEmails', () => ({
  useAllowedEmails: () => ({
    entries: h.entries,
    loading: false,
    error: null,
    clearError: () => {},
    addEmail: h.addEmail,
    removeEmail: h.removeEmail,
    reload: async () => {},
  }),
}));

beforeEach(() => {
  h.entries = [
    { email: 'owner@example.com', note: 'owner', isAdmin: true, addedAt: '2026-01-01' },
    { email: 'coach@example.com', note: 'U16 coach', isAdmin: false, addedAt: '2026-01-02' },
  ];
});

describe('AdminUsers', () => {
  test('lists everyone with access and flags admins', () => {
    render(<AdminUsers onBack={() => {}} currentEmail="owner@example.com" />);
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
    expect(screen.getByText('coach@example.com')).toBeInTheDocument();
    expect(screen.getByText('U16 coach')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  test('offers to remove other people', () => {
    render(<AdminUsers onBack={() => {}} currentEmail="owner@example.com" />);
    expect(screen.getByLabelText('Remove access for coach@example.com')).toBeInTheDocument();
  });

  test('does not offer to remove yourself, so an admin cannot lock themselves out', () => {
    render(<AdminUsers onBack={() => {}} currentEmail="owner@example.com" />);
    expect(screen.queryByLabelText('Remove access for owner@example.com')).not.toBeInTheDocument();
    expect(screen.getByText(/Can.t remove yourself/)).toBeInTheDocument();
  });

  test('matches your own address case-insensitively', () => {
    render(<AdminUsers onBack={() => {}} currentEmail="OWNER@example.com" />);
    expect(screen.queryByLabelText('Remove access for owner@example.com')).not.toBeInTheDocument();
  });

  test('shows an empty state when no one has access', () => {
    h.entries = [];
    render(<AdminUsers onBack={() => {}} currentEmail="owner@example.com" />);
    expect(screen.getByText('No one has access yet.')).toBeInTheDocument();
  });
});
