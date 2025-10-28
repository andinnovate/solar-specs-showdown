import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Ruler, Zap, Layers, Layout } from "lucide-react";
import { UnitSystem, formatDimensions, formatArea } from "@/lib/unitConversions";
import { Tables } from "@/integrations/supabase/types";

type SolarPanel = Tables<"solar_panels"> & {
  user_verified_overrides?: string[] | null;
  flag_count?: number;
  pending_flags?: number;
};

interface VisualComparisonProps {
  panels: SolarPanel[];
  unitSystem: UnitSystem;
  onPanelHover?: (panelId: string | null) => void;
  hoveredPanelId?: string | null;
}

interface PanelVisual {
  panel: SolarPanel;
  width: number;
  height: number;
  x: number;
  y: number;
  scale: number;
}

type ViewMode = 'overlap' | 'stack';

export const VisualComparison = ({ panels, unitSystem, onPanelHover, hoveredPanelId: externalHoveredId }: VisualComparisonProps) => {
  const [internalHoveredId, setInternalHoveredId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('overlap');
  
  // Use external hover state if provided, otherwise use internal state
  const hoveredPanelId = externalHoveredId !== undefined ? externalHoveredId : internalHoveredId;

  // Color palette for different panels
  const panelColors = [
    { fill: '#3b82f6', stroke: '#1d4ed8', hoverFill: '#2563eb', hoverStroke: '#1e40af' }, // Blue
    { fill: '#10b981', stroke: '#047857', hoverFill: '#059669', hoverStroke: '#065f46' }, // Emerald
    { fill: '#f59e0b', stroke: '#d97706', hoverFill: '#d97706', hoverStroke: '#b45309' }, // Amber
    { fill: '#ef4444', stroke: '#dc2626', hoverFill: '#dc2626', hoverStroke: '#b91c1c' }, // Red
    { fill: '#8b5cf6', stroke: '#7c3aed', hoverFill: '#7c3aed', hoverStroke: '#6d28d9' }, // Violet
    { fill: '#06b6d4', stroke: '#0891b2', hoverFill: '#0891b2', hoverStroke: '#0e7490' }, // Cyan
    { fill: '#84cc16', stroke: '#65a30d', hoverFill: '#65a30d', hoverStroke: '#4d7c0f' }, // Lime
    { fill: '#f97316', stroke: '#ea580c', hoverFill: '#ea580c', hoverStroke: '#c2410c' }, // Orange
  ];

  // Calculate the visual representation data
  const visualData = useMemo(() => {
    if (panels.length === 0) return { panels: [], containerWidth: 0, containerHeight: 0 };

    // Define container dimensions (in pixels)
    const containerWidth = 800;
    const padding = 40;
    
    // Calculate dynamic height based on view mode
    let containerHeight = 400; // Default for overlap mode

    // Find the largest panel to determine scaling
    const maxLength = Math.max(...panels.map(p => p.length_cm));
    const maxWidth = Math.max(...panels.map(p => p.width_cm));

    // Calculate scale factor to fit within container
    const scaleX = (containerWidth - padding * 2) / maxLength;
    const scaleY = (containerHeight - padding * 2) / maxWidth;
    const scale = Math.min(scaleX, scaleY, 2); // Max scale of 2 to prevent panels from being too large
    
    // Calculate dynamic height for stack mode
    if (viewMode === 'stack') {
      const verticalSpacing = 20;
      const totalHeight = panels.reduce((acc, panel) => {
        const panelHeight = panel.width_cm * scale;
        return acc + panelHeight + verticalSpacing;
      }, padding) + padding; // Add final padding
      
      containerHeight = Math.max(400, totalHeight); // Minimum 400px
    }

    // Arrange panels based on view mode
    const panelVisuals: PanelVisual[] = [];
    
    // Calculate panel dimensions in pixels
    // Filter out panels with missing dimensions
    const panelsWithValidDimensions = panels.filter(panel => 
      panel.length_cm && panel.width_cm && panel.length_cm > 0 && panel.width_cm > 0
    );
    
    if (panelsWithValidDimensions.length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layout className="w-5 h-5" />
              Visual Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-muted-foreground py-8">
              <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No panels with valid dimensions available for visual comparison</p>
            </div>
          </CardContent>
        </Card>
      );
    }
    
    const panelsWithDimensions = panelsWithValidDimensions.map(panel => ({
      panel,
      width: panel.length_cm! * scale,
      height: panel.width_cm! * scale,
      scale,
      aspectRatio: (panel.length_cm! * scale) / (panel.width_cm! * scale)
    }));
    
    let orderedPanels;
    
    if (viewMode === 'stack') {
      // Sort by length (left-to-right dimension) from small to large
      orderedPanels = panelsWithDimensions.sort((a, b) => a.panel.length_cm! - b.panel.length_cm!);
    } else {
      // For overlap mode, sort by total area (largest to smallest) so smallest panels appear on top
      orderedPanels = panelsWithDimensions.sort((a, b) => {
        const areaA = a.panel.length_cm! * a.panel.width_cm!;
        const areaB = b.panel.length_cm! * b.panel.width_cm!;
        return areaB - areaA; // Largest area first (bottom layer), smallest last (top layer)
      });
    }
    
    // Position panels based on view mode
    if (viewMode === 'overlap') {
      // Position panels with 95% vertical overlap for slight differentiation
      const baseX = padding;
      const baseY = padding;
      const verticalOffset = 10; // Small offset for 95% overlap
      
      orderedPanels.forEach(({ panel, width, height, scale }, index) => {
        // Panels positioned with slight vertical offset for 95% overlap
        // Smallest panels (top of sorted array) get smallest offset
        const x = baseX;
        const y = baseY + (index * verticalOffset);
        
        panelVisuals.push({
          panel,
          width,
          height,
          x,
          y,
          scale
        });
      });
    } else {
      // Stack panels vertically with spacing, ordered by length
      let currentY = padding;
      const verticalSpacing = 20;
      
      orderedPanels.forEach(({ panel, width, height, scale }, index) => {
        const x = padding;
        const y = currentY;
        
        panelVisuals.push({
          panel,
          width,
          height,
          x,
          y,
          scale
        });
        
        // Move to next position for stacking
        currentY += height + verticalSpacing;
      });
    }

    return {
      panels: panelVisuals,
      containerWidth,
      containerHeight
    };
  }, [panels, viewMode]);

  const handlePanelHover = (panelId: string | null) => {
    if (onPanelHover) {
      onPanelHover(panelId);
    } else {
      setInternalHoveredId(panelId);
    }
  };

  if (panels.length === 0) {
    return null;
  }

  // Handle case where visualData is a JSX element (no valid dimensions)
  if (typeof visualData !== 'object' || !('panels' in visualData)) {
    return visualData as React.ReactElement;
  }

  return (
    <Card className="mt-6 max-w-full overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Ruler className="w-5 h-5" />
            Visual Size Comparison
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'overlap' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('overlap')}
              className="flex items-center gap-2"
            >
              <Layers className="w-4 h-4" />
              Overlap
            </Button>
            <Button
              variant={viewMode === 'stack' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('stack')}
              className="flex items-center gap-2"
            >
              <Layout className="w-4 h-4" />
              Stack
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* SVG Container */}
          <div className="border rounded-lg p-4 bg-gradient-to-br from-gray-50 to-gray-100">
            <div 
              className="relative"
              onMouseLeave={() => {
                handlePanelHover(null);
              }}
            >
              {/* Invisible hover overlay divs - positioned to match SVG exactly */}
              {visualData.panels.map(({ panel, width, height, x, y }) => (
                <div
                  key={`hover-${panel.id}`}
                  className="absolute cursor-pointer"
                  style={{
                    left: `${x}px`,
                    top: `${y}px`,
                    width: `${width}px`,
                    height: `${height}px`,
                    zIndex: 10,
                  }}
                  onMouseEnter={() => handlePanelHover(panel.id)}
                  onMouseLeave={() => handlePanelHover(null)}
                />
              ))}
              
              <svg
                width={visualData.containerWidth}
                height={visualData.containerHeight}
                style={{ maxWidth: '100%', height: 'auto' }}
              >
              {visualData.panels.map(({ panel, width, height, x, y }, index) => {
                const isHovered = hoveredPanelId === panel.id;
                const isHighlighted = hoveredPanelId && hoveredPanelId !== panel.id;
                
                // Get color for this panel (cycle through palette)
                const colorIndex = index % panelColors.length;
                const colors = panelColors[colorIndex];
                
                return (
                  <g key={panel.id}>
                    {/* Panel Rectangle */}
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill={isHovered ? colors.hoverFill : isHighlighted ? '#e5e7eb' : colors.fill}
                      fillOpacity={isHovered ? 0.9 : isHighlighted ? 0.3 : 0.7}
                      stroke={isHovered ? colors.hoverStroke : colors.stroke}
                      strokeWidth={isHovered ? 4 : 2}
                      strokeOpacity={isHovered ? 1 : 0.8}
                      rx="4"
                      className="transition-all duration-200"
                    />
                    
                    {/* Panel Label */}
                    <text
                      x={x + width / 2}
                      y={y + height / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-xs font-medium fill-white pointer-events-none"
                      style={{ 
                        fontSize: Math.min(width, height) / 8,
                        textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                        fontWeight: '600'
                      }}
                    >
                      {panel.manufacturer}
                    </text>
                    
                    {/* Wattage Badge */}
                    <text
                      x={x + width / 2}
                      y={y + height / 2 + (Math.min(width, height) / 6)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-xs font-bold fill-white pointer-events-none"
                      style={{ 
                        fontSize: Math.min(width, height) / 10,
                        textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                        fontWeight: '700'
                      }}
                    >
                      {panel.wattage ? `${panel.wattage}W` : 'N/A'}
                    </text>
                  </g>
                );
              })}
              
              {/* Grid Lines for Reference */}
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#d1d5db" strokeWidth="0.5" opacity="0.3"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" opacity="0.2"/>
            </svg>
            </div>
          </div>

          {/* Panel Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {visualData.panels.map(({ panel, width, height, scale }, index) => {
              const isHovered = hoveredPanelId === panel.id;
              const colorIndex = index % panelColors.length;
              const colors = panelColors[colorIndex];
              
              return (
                <div
                  key={panel.id}
                  className={`p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                    isHovered 
                      ? 'shadow-lg border-opacity-100' 
                      : 'border-opacity-60 hover:border-opacity-80'
                  }`}
                  style={{
                    borderColor: colors.stroke,
                    backgroundColor: isHovered ? `${colors.fill}15` : 'white', // 15 = ~8% opacity
                  }}
                  onMouseEnter={() => handlePanelHover(panel.id)}
                  onMouseLeave={() => handlePanelHover(null)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full border-2"
                        style={{ 
                          backgroundColor: colors.fill,
                          borderColor: colors.stroke
                        }}
                      />
                      <div className="font-medium text-sm">{panel.name}</div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      <Zap className="w-3 h-3 mr-1" />
                      {panel.wattage ? `${panel.wattage}W` : 'N/A'}
                    </Badge>
                  </div>
                  
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>
                      <span className="font-medium">Dimensions:</span> {panel.length_cm && panel.width_cm ? formatDimensions(panel.length_cm, panel.width_cm, unitSystem) : 'N/A'}
                    </div>
                    <div>
                      <span className="font-medium">Area:</span> {panel.length_cm && panel.width_cm ? formatArea(panel.length_cm, panel.width_cm, unitSystem) : 'N/A'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="text-xs text-muted-foreground bg-gray-50 p-3 rounded-lg">
            <div className="font-medium mb-2">Visual Guide:</div>
            <div className="space-y-1">
              <div>• Panel rectangles show actual length/width proportions</div>
              <div>• Each panel has a unique color for easy identification</div>
              <div>• Panels can overlap when size differences are significant</div>
              <div>• Hover over panels to highlight and see details</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
