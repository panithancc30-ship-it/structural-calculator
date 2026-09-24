import { useRef } from 'react';
import { useAppModule, type AppModule } from '../state/appStore';

const MODULES: { value: AppModule; label: string }[] = [
  { value: 'beam', label: 'ออกแบบคาน' },
  { value: 'column', label: 'ออกแบบเสา' },
  { value: 'footing', label: 'ออกแบบฐานราก' },
  { value: 'pilecap', label: 'ฐานรากเสาเข็ม' },
];

export type ViewMode = 'design' | 'sheet';

export function downloadJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface Props {
  subtitle: string;
  view: ViewMode;
  onView: (view: ViewMode) => void;
  onSave: () => void;
  /** คืนข้อความผิดพลาด หรือ null ถ้าเปิดสำเร็จ */
  onLoad: (data: unknown) => string | null;
  onReset: () => void;
  printDisabled: boolean;
}

export function Topbar({ subtitle, view, onView, onSave, onLoad, onReset, printDisabled }: Props) {
  const module = useAppModule((s) => s.module);
  const setModule = useAppModule((s) => s.setModule);
  const fileRef = useRef<HTMLInputElement>(null);

  const openFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const error = onLoad(JSON.parse(await file.text()));
      if (error) alert(error);
    } catch {
      alert('อ่านไฟล์ไม่ได้ — ต้องเป็นไฟล์ .json ที่บันทึกจากโปรแกรมนี้');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <header className="topbar">
      <div className="brand">
        <h1>ออกแบบโครงสร้าง คสล. — WSD</h1>
        <span>{subtitle}</span>
      </div>
      <nav className="module-tabs" aria-label="หัวข้อออกแบบ">
        {MODULES.map((m) => (
          <button
            key={m.value}
            type="button"
            className={module === m.value ? 'active' : ''}
            aria-current={module === m.value ? 'page' : undefined}
            onClick={() => setModule(m.value)}
          >
            {m.label}
          </button>
        ))}
      </nav>
      <div className="actions">
        <div className="seg dark" role="group" aria-label="มุมมอง">
          <button type="button" className={view === 'design' ? 'active' : ''} onClick={() => onView('design')}>
            ออกแบบ
          </button>
          <button type="button" className={view === 'sheet' ? 'active' : ''} onClick={() => onView('sheet')}>
            ตัวอย่าง A4
          </button>
        </div>
        <button type="button" className="btn" onClick={onSave}>
          บันทึกไฟล์
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          เปิดไฟล์
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => openFile(e.target.files?.[0])} />
        <button type="button" className="btn" onClick={() => confirm('ล้างข้อมูลทั้งหมดกลับเป็นค่าเริ่มต้น?') && onReset()}>
          ล้างข้อมูล
        </button>
        <button type="button" className="btn primary" onClick={() => window.print()} disabled={printDisabled}>
          พิมพ์ / PDF (A4)
        </button>
      </div>
    </header>
  );
}
