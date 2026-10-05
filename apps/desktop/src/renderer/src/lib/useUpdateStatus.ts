import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateStatus } from '@muneem/contracts';
import { api } from '../api.js';

export const UPDATE_STATUS_KEY = ['updateStatus'] as const;

// Pushed on every change; polled too, because the install gate opens when the till goes quiet without an event.
export function useUpdateStatus() {
  const qc = useQueryClient();
  useEffect(() => api.events.on('update.status', (s) => qc.setQueryData<UpdateStatus>(UPDATE_STATUS_KEY, s)), [qc]);
  return useQuery({ queryKey: UPDATE_STATUS_KEY, queryFn: () => api.update.getStatus({}), refetchInterval: 60_000 });
}
