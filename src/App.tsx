import { useEffect, useState } from 'react';
import { useData } from './engine/store';
import { applyTheme } from './themes';
import { TOPICS, topicById, unitById } from './topics';
import { Home } from './screens/Home';
import { Lesson } from './screens/Lesson';
import { Parent } from './screens/Parent';
import { Practice } from './screens/Practice';
import { Profiles } from './screens/Profiles';
import { ExamSetup, type ExamConfig } from './screens/ExamSetup';
import { ExamRun } from './screens/ExamRun';

type Route =
  | { s: 'profiles' }
  | { s: 'home' }
  | { s: 'lesson'; topicId: string }
  | { s: 'practice'; topicIds: string[]; title: string }
  | { s: 'parent' }
  | { s: 'examSetup' }
  | { s: 'exam'; config: ExamConfig; startedAt: number };

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
  const activeTheme = data.profiles.find((p) => p.id === pid)?.theme;
  useEffect(() => applyTheme(activeTheme), [activeTheme, pid]);

  const go = (r: Route, replace = false) => {
    if (replace) history.replaceState(r, '');
    else history.pushState(r, '');
    setRoute(r);
  };
  const back = () => history.back();

  const pickChild = (id: string) => {
    setPid(id);
    try {
      sessionStorage.setItem('pid', id);
    } catch {
      /* ignore */
    }
    go({ s: 'home' }, true);
  };

  const validPid = pid && data.profiles.some((p) => p.id === pid) ? pid : null;

  if (route.s === 'parent') return <Parent onBack={back} />;

  if (!validPid || route.s === 'profiles') return <Profiles onPick={pickChild} onParent={() => go({ s: 'parent' })} />;

  switch (route.s) {
    case 'home':
      return (
        <Home
          pid={validPid}
          onTopic={(id) => go({ s: 'lesson', topicId: id })}
          onMixed={(unitId) => {
            const ids = TOPICS.filter((t) => !unitId || t.unit === unitId).map((t) => t.id);
            go({ s: 'practice', topicIds: ids, title: unitId ? `תרגול מעורב – ${unitById(unitId).title}` : 'תרגול מעורב' });
          }}
          onSwitch={() => go({ s: 'profiles' }, true)}
          onParent={() => go({ s: 'parent' })}
          onExam={() => go({ s: 'examSetup' })}
        />
      );
    case 'examSetup':
      return <ExamSetup onBack={back} onStart={(config) => go({ s: 'exam', config, startedAt: Date.now() })} />;
    case 'exam':
      // history: home → examSetup → exam
      return <ExamRun key={route.startedAt} pid={validPid} config={route.config} onExit={() => history.go(-2)} onNew={back} />;
    case 'lesson':
      return <Lesson pid={validPid} topicId={route.topicId} onBack={back} onPractice={() => go({ s: 'practice', topicIds: [route.topicId], title: topicById(route.topicId)?.title ?? '' })} />;
    case 'practice':
      return <Practice key={route.topicIds.join()} pid={validPid} topicIds={route.topicIds} title={route.title} onExit={back} />;
  }
}
