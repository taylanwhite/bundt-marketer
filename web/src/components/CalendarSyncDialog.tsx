import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import { api } from '../api/client';
import { usePermissions } from '../contexts/PermissionContext';

interface CalendarSyncDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CalendarSyncDialog({ open, onClose }: CalendarSyncDialogProps) {
  const { permissions } = usePermissions();
  const [url, setUrl] = useState('');
  const [storeName, setStoreName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!open || !permissions.currentStoreId) return;
    setError('');
    setCopied(false);
    setLoading(true);
    api
      .get<{ url: string; storeName: string }>(`/stores/${permissions.currentStoreId}/calendar-feed`)
      .then((data) => {
        setUrl(data.url);
        setStoreName(data.storeName);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not create the calendar link.');
      })
      .finally(() => setLoading(false));
  }, [open, permissions.currentStoreId]);

  const copyLink = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError('Copy failed. Select the link and copy it yourself.');
    }
  };

  const resetLink = async () => {
    if (!permissions.currentStoreId) return;
    if (!window.confirm('This stops the old link. Anyone already subscribed will need the new one.')) {
      return;
    }
    setResetting(true);
    setError('');
    try {
      const data = await api.post<{ url: string; storeName: string }>(
        `/stores/${permissions.currentStoreId}/calendar-feed`,
        {},
      );
      setUrl(data.url);
      setStoreName(data.storeName);
      setCopied(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not reset the link.');
    } finally {
      setResetting(false);
    }
  };

  const isLocal = url.includes('localhost') || url.includes('127.0.0.1');

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SyncIcon sx={{ color: '#d4a017' }} />
        Add to Google Calendar
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Subscribe once. Google keeps {storeName || 'this store'}&apos;s events updated.
          Do not add the same link twice. That is what creates duplicates.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {isLocal && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Google cannot reach a localhost link. Use this after the app is on a public https URL.
          </Alert>
        )}

        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Do this on a computer. The Google Calendar phone app cannot add a URL.
        </Typography>
        <Box component="ol" sx={{ pl: 2.5, m: 0, mb: 2, '& li': { mb: 1 } }}>
          <Typography component="li" variant="body2">
            Tap <strong>Copy link</strong> below.
          </Typography>
          <Typography component="li" variant="body2">
            On a computer, open{' '}
            <Box
              component="a"
              href="https://calendar.google.com"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: 'inherit', fontWeight: 700 }}
            >
              calendar.google.com
            </Box>
            {' '}and sign in with the same Gmail you use on your phone.
          </Typography>
          <Typography component="li" variant="body2">
            If the left sidebar is hidden, click the three-line menu at the top left.
          </Typography>
          <Typography component="li" variant="body2">
            On the left, next to <strong>Other calendars</strong>, click <strong>Add other calendars</strong> (the +).
          </Typography>
          <Typography component="li" variant="body2">
            Click <strong>From URL</strong>.
          </Typography>
          <Typography component="li" variant="body2">
            Paste the link and click <strong>Add calendar</strong>.
          </Typography>
          <Typography component="li" variant="body2">
            Check that <strong>Market Pollen - {storeName || 'your store'}</strong> appears under Other calendars
            with the box checked.
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Events then show up on your phone automatically. The phone app does not need another setup.
          First load can take a few minutes; later changes usually land within a few hours.
          To stop it, hover the calendar name on the computer, click the three dots, and unsubscribe.
        </Typography>

        <TextField
          fullWidth
          size="small"
          label="Calendar link"
          value={loading ? 'Creating link…' : url}
          InputProps={{
            readOnly: true,
            endAdornment: (
              <IconButton aria-label="Copy calendar link" onClick={copyLink} disabled={!url || loading}>
                <CopyIcon fontSize="small" />
              </IconButton>
            ),
          }}
        />
        {copied && (
          <Typography variant="caption" sx={{ display: 'block', mt: 0.75, fontWeight: 600 }}>
            Copied. Paste it in the From URL box.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <Button color="secondary" onClick={resetLink} disabled={resetting || loading}>
          {resetting ? 'Resetting…' : 'Reset link'}
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} color="secondary">
            Close
          </Button>
          <Button variant="contained" onClick={copyLink} disabled={!url || loading} startIcon={<CopyIcon />}>
            Copy link
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
