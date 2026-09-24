import { BeamModule } from './components/BeamModule';
import { ColumnModule } from './components/column/ColumnModule';
import { FootingModule } from './components/footing/FootingModule';
import { PileCapModule } from './components/pilecap/PileCapModule';
import { useAppModule } from './state/appStore';

export default function App() {
  const module = useAppModule((s) => s.module);
  if (module === 'column') return <ColumnModule />;
  if (module === 'footing') return <FootingModule />;
  if (module === 'pilecap') return <PileCapModule />;
  return <BeamModule />;
}
