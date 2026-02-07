import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterPanel } from '../FilterPanel';
import type { Tables } from '@/integrations/supabase/types';

// Mock the HistogramSlider component
type HistogramSliderMockProps = {
  label: string;
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
};

vi.mock('../HistogramSlider', () => ({
  HistogramSlider: ({ label, value, onValueChange }: HistogramSliderMockProps) => (
    <div data-testid={`histogram-${label}`}>
      <input
        type="range"
        value={value[0]}
        onChange={(e) => onValueChange([parseInt(e.target.value, 10), value[1]])}
        data-testid={`slider-${label}-min`}
      />
      <input
        type="range"
        value={value[1]}
        onChange={(e) => onValueChange([value[0], parseInt(e.target.value, 10)])}
        data-testid={`slider-${label}-max`}
      />
    </div>
  ),
}));

type SolarPanel = Tables<'solar_panels'> & {
  user_verified_overrides?: string[] | null;
  flag_count?: number;
  pending_flags?: number;
};

const basePanel: SolarPanel = {
  id: 'base',
  name: 'Base Panel',
  manufacturer: 'Base',
  asin: null,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
  description: null,
  flag_count: null,
  image_url: null,
  length_cm: null,
  manual_overrides: null,
  missing_fields: null,
  pending_flags: null,
  piece_count: 1,
  price_usd: null,
  user_verified_overrides: null,
  voltage: null,
  wattage: null,
  web_url: null,
  weight_kg: null,
  width_cm: null,
};

const mockPanels: SolarPanel[] = [
  {
    ...basePanel,
    id: '1',
    name: 'Test Panel 1',
    manufacturer: 'Test Corp',
    wattage: 200,
    voltage: 20,
    length_cm: 100,
    width_cm: 50,
    weight_kg: 5,
    price_usd: 100,
    piece_count: 1,
  },
  {
    ...basePanel,
    id: '2',
    name: 'Test Panel 2',
    manufacturer: 'Another Corp',
    wattage: 400,
    voltage: 40,
    length_cm: 150,
    width_cm: 75,
    weight_kg: 10,
    price_usd: 200,
    piece_count: 2,
  },
];

const mockFilters = {
  wattageRange: [100, 500] as [number, number],
  voltageRange: [15, 50] as [number, number],
  priceRange: [50, 250] as [number, number],
  weightRange: [3, 12] as [number, number],
  lengthRange: [80, 170] as [number, number],
  widthRange: [40, 80] as [number, number],
  pricePerWattRange: [0.3, 0.8] as [number, number],
  wattsPerKgRange: [20, 50] as [number, number],
  wattsPerSqMRange: [100, 250] as [number, number],
  showFavoritesOnly: false,
  showIncomplete: false,
};

const mockBounds = {
  wattage: { min: 100, max: 500 },
  voltage: { min: 15, max: 50 },
  price: { min: 50, max: 250 },
  weight: { min: 3, max: 12 },
  length: { min: 80, max: 170 },
  width: { min: 40, max: 80 },
  pricePerWatt: { min: 0.3, max: 0.8 },
  wattsPerKg: { min: 20, max: 50 },
  wattsPerSqM: { min: 100, max: 250 },
};

describe('FilterPanel Component', () => {
  const defaultProps = {
    filters: mockFilters,
    bounds: mockBounds,
    panels: mockPanels,
    favoritePanelIds: new Set<string>(),
    unitSystem: 'metric' as const,
    onFilterChange: vi.fn(),
    onReset: vi.fn(),
    onUnitSystemChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render filter panel with title', () => {
    render(<FilterPanel {...defaultProps} />);
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('should render filter sliders for key properties', () => {
    render(<FilterPanel {...defaultProps} />);
    
    // Check that histograms are rendered (they use data-testid)
    expect(screen.getByTestId('histogram-Price (USD)')).toBeInTheDocument();
    expect(screen.getByTestId('histogram-Length (cm)')).toBeInTheDocument();
  });

  it('should render unit system toggle buttons', () => {
    render(<FilterPanel {...defaultProps} />);
    
    const metricButton = screen.getByRole('button', { name: /metric/i });
    const imperialButton = screen.getByRole('button', { name: /imperial/i });
    
    expect(metricButton).toBeInTheDocument();
    expect(imperialButton).toBeInTheDocument();
  });

  it('should call onUnitSystemChange when unit button is clicked', () => {
    render(<FilterPanel {...defaultProps} />);
    
    const imperialButton = screen.getByRole('button', { name: /imperial/i });
    fireEvent.click(imperialButton);
    
    expect(defaultProps.onUnitSystemChange).toHaveBeenCalledWith('imperial');
  });

  it('should render reset button', () => {
    render(<FilterPanel {...defaultProps} />);
    
    const resetButton = screen.getByRole('button', { name: /reset/i });
    expect(resetButton).toBeInTheDocument();
  });

  it('should call onReset when reset button is clicked', () => {
    render(<FilterPanel {...defaultProps} />);
    
    const resetButton = screen.getByRole('button', { name: /reset/i });
    fireEvent.click(resetButton);
    
    expect(defaultProps.onReset).toHaveBeenCalled();
  });

  it('should render checkbox for show incomplete data', () => {
    render(<FilterPanel {...defaultProps} />);
    
    expect(screen.getByLabelText(/show panels with incomplete data/i)).toBeInTheDocument();
  });

  it('should call onFilterChange when incomplete checkbox is toggled', () => {
    render(<FilterPanel {...defaultProps} />);
    
    const incompleteCheckbox = screen.getByLabelText(/show panels with incomplete data/i);
    fireEvent.click(incompleteCheckbox);
    
    expect(defaultProps.onFilterChange).toHaveBeenCalledWith({
      ...mockFilters,
      showIncomplete: true,
    });
  });

  it('should show applied filters count when provided', () => {
    const props = {
      ...defaultProps,
      appliedFiltersCount: { count: 3, appliedFilters: ['Wattage', 'Price', 'Weight'] },
    };
    
    render(<FilterPanel {...props} />);
    
    expect(screen.getByText(/3 applied/i)).toBeInTheDocument();
  });

  it('should show "More Filters" button', () => {
    render(<FilterPanel {...defaultProps} />);
    
    const moreFiltersButton = screen.getByText(/more filters/i);
    expect(moreFiltersButton).toBeInTheDocument();
  });
});
