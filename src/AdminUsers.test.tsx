import { render, screen, fireEvent } from '@testing-library/react';
import { AdminUsers } from './AdminUsers';

const h = vi.hoisted(() => ({
  entries: [] as any[],
  addEmail: vi.fn(async () => true),
  removeEmail: vi.fn(async () => true),
  removeAgeGroup: vi.fn(async () => true),
}));

vi.mock('./hooks/useAllowedEmails', () => ({
  useAllowedEmails: () => ({
    entries: h.entries,
    loading: false,
    error: null,
    clearError: () => {},
    addEmail: h.addEmail,
    removeEmail: h.removeEmail,
    removeAgeGroup: h.removeAgeGroup,
    reload: async () => {},
  }),
}));

beforeEach(() => {
  h.entries = [
    { email: 'owner@example.com', note: 'owner', isAdmin: true, addedAt: '2026-01-01', ageGroups: [] },
    { email: 'coach@example.com', note: 'U16 coach', isAdmin: false, addedAt: '2026-01-02', ageGroups: ['U15', 'U16'] },
    { email: 'new@example.com', note: null, isAdmin: false, addedAt: '2026-01-03', ageGroups: [] },
  ];
  window.confirm = vi.fn(() => true);
  h.addEmail.mockClear();
  h.removeAgeGroup.mockClear();
});

describe('AdminUsers', () => {
  test('lists everyone with access and flags admins', () => {
    render(<AdminUsers onBack={() => {}} currentEmail="owner@example.com" />);
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('coach@example.com').length).toBeGreaterThan(0);
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

  test('shows each coach\'s age groups and who coaches each age group', () => {
    render(<AdminUsers onBack={() => {}} currentEmail="owner@example.com" />);
    const summary = screen.getByTestId('age-group-summary');
    expect(summary).toHaveTextContent('U15coach@example.com');
    expect(summary).toHaveTextContent('U16coach@example.com');
    expect(screen.getByText(/No age group yet/)).toBeInTheDocument();
  });

  test('adds a coach with an age group', async () => {
    render(<AdminUsers onBack={() => {}} currentEmail="owner@example.com" />);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'sam@example.com' } });
    fireEvent.change(screen.getByLabelText('Age group'), { target: { value: 'U15' } });
    fireEvent.click(screen.getByText('Add'));
    expect(h.addEmail).toHaveBeenCalledWith('sam@example.com', '', 'U15');
  });

  test('removes one age group from a coach after confirming', () => {
    render(<AdminUsers onBack={() => {}} currentEmail="owner@example.com" />);
    fireEvent.click(screen.getByLabelText('Remove U16 from coach@example.com'));
    expect(window.confirm).toHaveBeenCalled();
    expect(h.removeAgeGroup).toHaveBeenCalledWith('coach@example.com', 'U16');
  });
});
