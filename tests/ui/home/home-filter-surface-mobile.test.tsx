import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { HomeLibraryFilters } from '../../../app/widgets/home-library/model/home-library-filters';
import { HomeFilterSurface } from '../../../app/features/home-tag-filter/ui/HomeFilterSurface';
import { createHomeLibraryFilters } from '../../../app/widgets/home-library/model/home-library-filters';

vi.mock('~/shared/ui/drawer', () => ({
  Drawer: ({ children, open }: { children: ReactNode; open?: boolean }) => (
    open ? <div data-testid="mock-drawer">{children}</div> : null
  ),
  DrawerContent: ({ children }: { children: ReactNode }) => (
    <section aria-label="Filters" role="dialog">{children}</section>
  ),
  DrawerDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DrawerFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
  DrawerHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
  DrawerTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

const originalMatchMedia = window.matchMedia;

function useMobileMediaQuery() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });
}

function ControlledMobileFilterSurface() {
  const [filters, setFilters] = useState<HomeLibraryFilters>(
    createHomeLibraryFilters({ query: 'Action' }),
  );
  const [open, setOpen] = useState(true);

  return (
    <>
      <output data-testid="filters">{JSON.stringify(filters)}</output>
      <button onClick={() => setOpen(true)} type="button">
        Reopen filters
      </button>
      <HomeFilterSurface
        contentTypes={[]}
        filters={filters}
        genres={[]}
        onFiltersChange={setFilters}
        onOpenChange={setOpen}
        open={open}
      />
    </>
  );
}

describe('mobile home filter surface', () => {
  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: originalMatchMedia,
    });
  });

  test('keeps mobile filters as draft until apply and resets metadata while preserving query', async () => {
    useMobileMediaQuery();
    const user = userEvent.setup();

    render(<ControlledMobileFilterSurface />);

    expect(screen.getByTestId('filters')).toHaveTextContent('"query":"Action"');
    expect(screen.getByTestId('filters')).toHaveTextContent('"includeTags":[]');

    await user.type(screen.getByLabelText('Require tags'), 'Drama{Enter}');

    expect(screen.getByTestId('filters')).toHaveTextContent('"includeTags":[]');

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.getByTestId('filters')).toHaveTextContent('"includeTags":["drama"]');
    expect(screen.queryByRole('dialog', { name: 'Filters' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reopen filters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getByTestId('filters')).toHaveTextContent('"query":"Action"');
    expect(screen.getByTestId('filters')).toHaveTextContent('"includeTags":[]');
  });
});
