import { useEffect, useState } from 'react';
import { useData } from './engine/store';
import { applyTheme } from './themes';
import { packIdOf, packInfo, packsForGrade, topicById, unitById } from './curricula';
import { Home } from './screens/Home';
import { Lesson } from './screens/Lesson';
import { Parent } from './screens/Parent';
import { Practice } from './screens/Practice';
import { Profiles } from './screens/Profiles';
import { Subjects, WithPacks } from './screens/Subjects';
import { ExamSetup, type ExamConfig } from './screens/ExamSetup';
import { ExamRun } from './screens/ExamRun';

type Route =
  | { s: 'profiles' }
  | { s: 'subjects' }
  | { s: 'home'; packId?: string }
  | { s: 'lesson'; topicId: string }
  | { s: 'practice'; topicIds: string[]; title: string }
  | { s: 'parent' }
  | { s: 'examSetup'; packId?: string }
  | { s: 'exam'; config: ExamConfig; startedAt: number };

/** Topic/pack ids a route needs. A route saved by an older app version may name ids that no longer exist. */
function routePackIds(r: Route): string[] | null {
  const topicIds = r.s === 'lesson' ? [r.topicId] : r.s === 'practice' ? r.topicIds : r.s === 'exam' ? r.config.topicIds : [];
  const direct = (r.s === 'home' || r.s === 'examSetup') && r.packId ? [r.packId] : [];
  const packs = [...new Set([...direct, ...topicIds.map(packIdOf)])];
  return packs.every((p) => packInfo(p)) ? packs : null;
}

/**
 * Navigation is kept in browser history so the Android back button works naturally.
 */
export default function App() {
  const data = useData();
  const [route, setRoute] = useState<Route>(() => (history.state as Route) ?? { s: 'profiles' });
  const [pid, setPid] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('pid');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!history.state) history.replaceState(route, '');
    const onPop = (e: PopStateEvent) => setRoute((e.state as Route) ?? { s: 'profiles' });
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollTo(0, 0);
  }, [route]);

  // The active child's color theme (kept on the profile picker and parent screens too).
  const profile = data.profiles.find((p) => p.id === pid);
  useEffect(() => applyTheme(profile?.theme), [profile?.theme, pid]);

  const go = (r: Route, replace = false) => {
    if (replace) history.replaceState(r, '');
    else history.pushState(r, '');
    setRoute(r);
  };
  const back = () => history.back();

  /** Where a child starts: straight into the subject if their grade has only one, else the subject list. */
  const startRoute = (grade: number): Route => {
    const packs = packsForGrade(grade);
    return packs.length === 1 ? { s: 'home', packId: packs[0].id } : { s: 'subjects' };
  };

  const pickChild = (id: string) => {
    setPid(id);
    try {
      sessionStorage.setItem('pid', id);
    } catch {
      /* ignore */
    }
    const grade = data.profiles.find((p) => p.id === id)?.grade ?? 5;
    go(startRoute(grade), true);
  };

  if (route.s === 'parent') return <Parent onBack={back} />;

  if (!profile || route.s === 'profiles') return <Profiles onPick={pickChild} onParent={() => go({ s: 'parent' })} />;
  const childId = profile.id;

  // Unknown ids (e.g. a screen left open from an older version) or a subject not in the child's grade → start over.
  const packIds = routePackIds(route);
  const homeless = (route.s === 'home' || route.s === 'examSetup') && (!route.packId || packInfo(route.packId)?.grade !== profile.grade);
  if (!packIds || homeless) {
    const r = startRoute(profile.grade);
    queueMicrotask(() => go(r, true));
    return null;
  }

  const multiSubject = packsForGrade(profile.grade).length > 1;
  const toProfiles = () => go({ s: 'profiles' }, true);
  const toParent = () => go({ s: 'parent' });

  switch (route.s) {
    case 'subjects':
      return <Subjects pid={childId} onPick={(packId) => go({ s: 'home', packId })} onSwitch={toProfiles} onParent={toParent} />;
    case 'home':
      return (
        <WithPacks ids={packIds}>
          {([pack]) => (
            <Home
              pid={childId}
              pack={pack}
              onTopic={(id) => go({ s: 'lesson', topicId: id })}
              onMixed={(unitId) => {
                const ids = pack.topics.filter((t) => !unitId || t.unit === unitId).map((t) => t.id);
                go({ s: 'practice', topicIds: ids, title: unitId ? `תרגול מעורב – ${unitById(unitId)?.title}` : `תרגול מעורב – ${pack.title}` });
              }}
              onSwitch={toProfiles}
              onParent={toParent}
              onExam={() => go({ s: 'examSetup', packId: pack.id })}
              onSubjects={multiSubject ? back : undefined}
            />
          )}
        </WithPacks>
      );
    case 'examSetup':
      return <WithPacks ids={packIds}>{([pack]) => <ExamSetup pack={pack} onBack={back} onStart={(config) => go({ s: 'exam', config, startedAt: Date.now() })} />}</WithPacks>;
    case 'exam':
      // history: home → examSetup → exam
      return (
        <WithPacks ids={packIds}>
          {() => <ExamRun key={route.startedAt} pid={childId} config={route.config} onExit={() => history.go(-2)} onNew={back} />}
        </WithPacks>
      );
    case 'lesson':
      return (
        <WithPacks ids={packIds}>
          {() => <Lesson pid={childId} topicId={route.topicId} onBack={back} onPractice={() => go({ s: 'practice', topicIds: [route.topicId], title: topicById(route.topicId)?.title ?? '' })} />}
        </WithPacks>
      );
    case 'practice':
      return <WithPacks ids={packIds}>{() => <Practice key={route.topicIds.join()} pid={childId} topicIds={route.topicIds} title={route.title} onExit={back} />}</WithPacks>;
  }
}
