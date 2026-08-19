import { ReactNode } from 'react';
import { Box, Button, Card, CardContent, Typography } from '@mui/material';
import { ChevronRight as ChevronRightIcon } from '@mui/icons-material';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  onViewAll?: () => void;
  viewAllLabel?: string;
  height?: number;
  children: ReactNode;
}

export function ChartCard({
  title,
  subtitle,
  onViewAll,
  viewAllLabel = 'View data',
  height = 280,
  children,
}: ChartCardProps) {
  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        '&:hover': {
          borderColor: 'rgba(245, 200, 66, 0.45)',
        },
      }}
    >
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', pb: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1,
            mb: 1.5,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          {onViewAll && (
            <Button
              size="small"
              onClick={onViewAll}
              endIcon={<ChevronRightIcon sx={{ fontSize: 16 }} />}
              sx={{ flexShrink: 0, px: 1, minWidth: 0, fontSize: '0.75rem' }}
            >
              {viewAllLabel}
            </Button>
          )}
        </Box>
        <Box sx={{ flex: 1, minHeight: height, height }}>{children}</Box>
      </CardContent>
    </Card>
  );
}

export function ChartEmpty({ message = 'No data for this range' }: { message?: string }) {
  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'text.secondary',
        px: 2,
        textAlign: 'center',
      }}
    >
      <Typography variant="body2">{message}</Typography>
    </Box>
  );
}

interface TooltipRow {
  name?: string;
  value?: number | string;
  color?: string;
}

export function ChartTooltip({
  active,
  label,
  rows,
}: {
  active?: boolean;
  label?: string;
  rows?: TooltipRow[];
}) {
  if (!active || !rows?.length) return null;
  return (
    <Box
      sx={{
        bgcolor: '#fff',
        border: '1px solid rgba(245, 200, 66, 0.55)',
        borderRadius: 1.5,
        px: 1.5,
        py: 1,
        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        minWidth: 140,
      }}
    >
      {label && (
        <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
          {label}
        </Typography>
      )}
      {rows.map((row) => (
        <Box key={`${row.name}-${row.value}`} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: row.color || '#f5c842', flexShrink: 0 }} />
          <Typography variant="caption" color="text.secondary">
            {row.name}
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, ml: 'auto' }}>
            {typeof row.value === 'number' ? row.value.toLocaleString() : row.value}
          </Typography>
        </Box>
      ))}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, opacity: 0.75 }}>
        Click to view records
      </Typography>
    </Box>
  );
}
