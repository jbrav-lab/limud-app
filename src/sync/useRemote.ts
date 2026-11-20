import { useCallback, useEffect, useState } from 'react';
import { PARENT_AUTH_KEY, syncEnabled } from './client';
import { allFamilyChildren, type ServerChild } from './family';
import { fetchChildProgress, type RemoteChild } from './progress';

/** Whether a parent is signed in on this phone (checked without loading the sync library). */
export function parentSignedIn(): boolean {
  if (!syncEnabled()) return false;
  try {
    return Boolean(localStorage.getItem(PARENT_AUTH_KEY));
  } catch {
    return false;
  }
}

/** The signed-in parent's family children, once `enabled` (after the PIN); empty when signed out or offline. */
export function useRemoteChildren(enabled: boolean): ServerChild[] {
  const [kids, setKids] = useState<ServerChild[]>([]);
  useEffect(() => {
    if (!enabled || !parentSignedIn()) return;
    let live = true;
    allFamilyChildren()
      .then((k) => live && setKids(k))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [enabled]);
  return kids;
}

export type RemoteState = 'off' | 'loading' | 'ok' | 'error';

/** A child's uploaded progress, for a signed-in parent ('off' otherwise). */
export function useRemoteProgress(childId: string): { state: RemoteState; data: RemoteChild | null; reload: () => void } {
  const on = parentSignedIn();
  const [state, setState] = useState<RemoteState>(on ? 'loading' : 'off');
  const [data, setData] = useState<RemoteChild | null>(null);
  const [n, setN] = useState(0);
  const reload = useCallback(() => setN((x) => x + 1), []);
  useEffect(() => {
    if (!on) return;
    let live = true;
    setState('loading');
    fetchChildProgress(childId)
      .then((r) => {
        if (!live) return;
        setData(r);
        setState('ok');
      })
      .catch(() => live && setState('error'));
    return () => {
      live = false;
    };
  }, [childId, n, on]);
  return { state, data, reload };
}
